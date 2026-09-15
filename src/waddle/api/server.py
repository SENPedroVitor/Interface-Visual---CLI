"""FastAPI Backend Server and WebSocket Stream for Waddle Agent OS."""
from __future__ import annotations

import asyncio
import logging
import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from ..runtime.agent_runtime import AgentRuntime
from ..runtime.routine_scheduler import RoutineScheduler
from ..core.event_bus import Event, global_event_bus
from ..providers import ProviderRegistry
from ..tools.registry import global_tool_registry
from ..security.credentials import CredentialStoreError, get_default_credential_store
from ..terminal import CliSessionManager, SessionEvent


load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)

runtime = AgentRuntime(event_bus=global_event_bus, tool_registry=global_tool_registry)
provider_registry = ProviderRegistry()
active_websockets: set[WebSocket] = set()
scheduler = RoutineScheduler(runtime)
routine_run_tasks: set[asyncio.Task[Any]] = set()
objective_tasks: set[asyncio.Task[Any]] = set()
logger = logging.getLogger(__name__)
credential_store = get_default_credential_store()
_project_root = Path(__file__).resolve().parents[3]
_full_computer_access = os.getenv("WADDLE_COMPUTER_ACCESS", "").strip().lower() in {
    "full", "unrestricted", "danger-full-access"
}
_default_terminal_workspace = _project_root.anchor if _full_computer_access else str(_project_root)
_configured_terminal_workspace = os.getenv("WADDLE_TERMINAL_WORKSPACE", "").strip()
_terminal_workspace = Path(
    _configured_terminal_workspace or _default_terminal_workspace
).expanduser().resolve()
terminal_sessions = CliSessionManager(
    authorized_workspace=_terminal_workspace,
    sandbox_mode="danger-full-access" if _full_computer_access else "read-only",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup event bus listener to broadcast to all connected WebSockets
    async def broadcast_event(event: Event) -> None:
        if not active_websockets:
            return
        dead = set()
        payload = event.to_dict()
        for ws in list(active_websockets):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.add(ws)
        active_websockets.difference_update(dead)

    global_event_bus.subscribe("*", broadcast_event)
    scheduler.start()
    app.state.routine_scheduler = scheduler
    yield
    for task in (*routine_run_tasks, *objective_tasks):
        task.cancel()
    if routine_run_tasks or objective_tasks:
        await asyncio.gather(*routine_run_tasks, *objective_tasks, return_exceptions=True)
    routine_run_tasks.clear()
    objective_tasks.clear()
    await scheduler.stop()
    for item in terminal_sessions.list_sessions():
        if item.running:
            try:
                terminal_sessions.stop_session(item.session_id, reason="runtime shutdown")
            except (KeyError, RuntimeError):
                pass
    active_websockets.clear()


app = FastAPI(title="Waddle Agent OS API", version="0.2.0", lifespan=lifespan)

_default_cors_origins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5174",
]
_configured_cors = [origin.strip() for origin in (os.getenv("WADDLE_CORS_ORIGINS") or "").split(",") if origin.strip()]


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return validation details without reflecting credential-like inputs."""
    safe_errors = []
    sensitive_fields = {"api_key", "authorization", "password", "secret", "token"}
    for error in exc.errors():
        safe_error = dict(error)
        location = [str(item) for item in error.get("loc", ())]
        if any(field in sensitive_fields for field in location):
            safe_error["input"] = "[REDACTED]"
            safe_error.pop("ctx", None)
        safe_errors.append(safe_error)
    return JSONResponse(status_code=422, content={"detail": safe_errors})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_cors or _default_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def reject_cross_origin_mutations(request: Request, call_next):
    """Block browser CSRF attempts while keeping direct local API clients usable."""
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = (request.headers.get("origin") or "").strip()
        if origin and origin not in (_configured_cors or _default_cors_origins):
            return JSONResponse(status_code=403, content={"detail": "Origin não autorizado."})
    return await call_next(request)


def _websocket_origin_allowed(websocket: WebSocket) -> bool:
    """Require browser WebSockets to come from the configured local UI."""
    origin = (websocket.headers.get("origin") or "").strip()
    # Browser clients always send Origin.  Rejecting an absent origin closes the
    # historical loophole where an arbitrary local page could read event history.
    return bool(origin) and origin in (_configured_cors or _default_cors_origins)


@app.get("/health")
async def health() -> dict[str, Any]:
    """Non-secret readiness probe for local orchestration and process managers."""
    database_ok = False
    runtime_ok = False
    try:
        runtime.database.list_routines(limit=1)
        database_ok = True
    except Exception:
        pass
    try:
        runtime_ok = bool(runtime.get_agent("Quinta"))
    except Exception:
        pass
    # Provider availability is informative only: local fallback/runtime remains
    # ready when optional cloud CLIs or credentials are absent.
    providers: dict[str, bool] = {}
    try:
        providers = {str(item["id"]): bool(item.get("available")) for item in provider_registry.list_providers()}
    except Exception:
        providers = {}
    payload = {
        "status": "ok" if database_ok and runtime_ok else "degraded",
        "ready": database_ok and runtime_ok,
        "checks": {"database": database_ok, "runtime": runtime_ok, "providers": providers},
    }
    if not payload["ready"]:
        raise HTTPException(status_code=503, detail=payload)
    return payload


class ObjectiveRequest(BaseModel):
    objective: str
    parameters: Optional[dict[str, Any]] = None
    agent_name: Optional[str] = None
    group_id: Optional[str] = None


class CredentialRequest(BaseModel):
    api_key: str = Field(default="", max_length=4096)
    name: str = Field(default="", max_length=60)
    model: str = Field(default="", max_length=160)
    base_url: str = Field(default="", max_length=500)


class AgentRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    role: str
    description: str = Field(default='', max_length=240)
    provider_id: str = Field(default='ollama', max_length=24)
    soul: Optional[str] = None
    skills: Optional[list[str]] = None
    memory: Optional[list[dict[str, Any]]] = None
    avatar_config: Optional[dict[str, Any]] = None
    workspace_path: Optional[str] = Field(default=None, max_length=500)
    # `model_config` is a reserved attribute name on pydantic's BaseModel
    # (it holds the model's own ConfigDict) — the field is renamed at the
    # Python level but keeps its `model_config` wire name via alias, so the
    # frontend payload and the rest of the stack (AgentRuntime, SQLite
    # column, etc.) are unaffected.
    model_settings: Optional[dict[str, Any]] = Field(default=None, alias="model_config")


class AgentUpdateRequest(BaseModel):
    role: Optional[str] = None
    description: Optional[str] = None
    provider_id: Optional[str] = None
    soul: Optional[str] = None
    skills: Optional[list[str]] = None
    memory: Optional[list[dict[str, Any]]] = None
    avatar_config: Optional[dict[str, Any]] = None
    workspace_path: Optional[str] = Field(default=None, max_length=500)
    model_settings: Optional[dict[str, Any]] = Field(default=None, alias="model_config")


class GroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: str = Field(default='', max_length=240)
    members: list[str] = Field(default_factory=list)
    avatar_icon: str = Field(default='users', max_length=32)


class GroupUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=64)
    description: Optional[str] = Field(default=None, max_length=240)
    members: Optional[list[str]] = None
    avatar_icon: Optional[str] = Field(default=None, max_length=32)


class BackupImportRequest(BaseModel):
    data: dict[str, Any]


class RoutineRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    agent_name: str = Field(min_length=1, max_length=32)
    prompt: str = Field(min_length=1, max_length=500)
    schedule: str = Field(min_length=1, max_length=120)


class RoutineUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    prompt: Optional[str] = Field(default=None, min_length=1, max_length=500)
    schedule: Optional[str] = Field(default=None, min_length=1, max_length=120)
    status: Optional[str] = None


class TerminalSessionRequest(BaseModel):
    provider: str = Field(min_length=1, max_length=16)
    agent_name: Optional[str] = Field(default=None, max_length=32)
    cwd: Optional[str] = Field(default=None, max_length=500)
    timeout_seconds: Optional[float] = Field(default=None, gt=0, le=3600)


class TerminalInputRequest(BaseModel):
    text: str = Field(max_length=32_000)


@app.post('/api/agents', status_code=201)
async def create_agent(req: AgentRequest) -> dict[str, Any]:
    try:
        agent = runtime.create_agent(
            name=req.name,
            role=req.role,
            description=req.description,
            provider_id=req.provider_id,
            soul=req.soul or "",
            skills=req.skills,
            memory=req.memory,
            avatar_config=req.avatar_config,
            model_config=req.model_settings,
            workspace_path=req.workspace_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await global_event_bus.emit('agent.created', {'agent': agent}, source=agent['name'])
    return agent


@app.patch('/api/agents/{agent_name}')
async def update_agent(agent_name: str, req: AgentUpdateRequest) -> dict[str, Any]:
    try:
        # by_alias=True: re-export model_settings under its wire name
        # (model_config), which is what runtime.update_agent_details and
        # the "model_config" membership check below expect.
        data = req.model_dump(exclude_unset=True, by_alias=True)
        # Check if basic update or full update
        if any(k in data for k in ("soul", "skills", "memory", "avatar_config", "model_config", "workspace_path")):
            agent = runtime.update_agent_details(agent_name, data)
        else:
            role = data.get("role") or (runtime.get_agent(agent_name).role if runtime.get_agent(agent_name) else "Executor")
            desc = data.get("description", "")
            prov = data.get("provider_id", "ollama")
            agent = runtime.update_agent(agent_name, role, desc, prov)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await global_event_bus.emit('agent.updated', {'agent': agent}, source=agent['name'])
    return agent


@app.get('/api/agents/{agent_name}/details')
async def get_agent_details(agent_name: str) -> dict[str, Any]:
    try:
        return runtime.get_agent_details(agent_name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.patch('/api/agents/{agent_name}/details')
async def update_agent_details_endpoint(agent_name: str, req: AgentUpdateRequest) -> dict[str, Any]:
    try:
        data = req.model_dump(exclude_unset=True, by_alias=True)
        updated = runtime.update_agent_details(agent_name, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await global_event_bus.emit('agent.updated', {'agent': updated}, source=agent_name)
    return updated


@app.get("/api/providers/{provider_id}/models")
async def get_provider_models(provider_id: str) -> dict[str, Any]:
    models = provider_registry.list_provider_models(provider_id)
    return {"provider_id": provider_id, "models": models}


@app.get("/api/groups")
async def get_groups() -> list[dict[str, Any]]:
    return runtime.list_groups()


@app.post("/api/groups", status_code=201)
async def create_group(req: GroupRequest) -> dict[str, Any]:
    group = runtime.create_group(
        name=req.name,
        description=req.description,
        members=req.members,
        avatar_icon=req.avatar_icon,
    )
    await global_event_bus.emit('group.created', {'group': group}, source="system")
    return group


@app.patch("/api/groups/{group_id}")
async def update_group(group_id: str, req: GroupUpdateRequest) -> dict[str, Any]:
    updated = runtime.update_group(
        group_id=group_id,
        name=req.name,
        description=req.description,
        members=req.members,
        avatar_icon=req.avatar_icon,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
    await global_event_bus.emit('group.updated', {'group': updated}, source="system")
    return updated


@app.delete("/api/groups/{group_id}")
async def delete_group(group_id: str) -> dict[str, Any]:
    deleted = runtime.delete_group(group_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")
    await global_event_bus.emit('group.deleted', {'group_id': group_id}, source="system")
    return {"status": "deleted", "group_id": group_id}


@app.get("/api/backup/export")
async def export_backup() -> dict[str, Any]:
    return runtime.export_backup()


@app.post("/api/backup/import")
async def import_backup(req: BackupImportRequest) -> dict[str, Any]:
    res = runtime.import_backup(req.data)
    await global_event_bus.emit('backup.imported', res, source="system")
    return res


@app.get("/api/status")
async def get_status() -> dict[str, Any]:
    return {
        "status": "stopped" if runtime._is_stopped else "active",
        "computer_access": "full" if _full_computer_access else "workspace",
        "terminal_workspace": str(_terminal_workspace),
        "active_run_id": runtime._active_run_id,
        "agents": runtime.list_agents(),
        "tasks": runtime.task_manager.list_tasks(),
        "tools_count": len(runtime.tool_registry.list_tools()),
    }


@app.get("/api/agents")
async def get_agents() -> list[dict[str, Any]]:
    return runtime.list_agents()


@app.get("/api/tasks")
async def get_tasks(status: Optional[str] = None) -> list[dict[str, Any]]:
    return runtime.task_manager.list_tasks(status=status)


@app.get("/api/tools")
async def get_tools() -> list[dict[str, Any]]:
    return runtime.tool_registry.list_tools()


def _redact_terminal_text(text: str) -> str:
    """Prevent common API-token shapes from reaching the browser stream."""
    value = str(text or "")
    value = re.sub(r"\b(sk-[A-Za-z0-9_-]{12,})\b", "[REDACTED_KEY]", value)
    value = re.sub(r"\b(ant-[A-Za-z0-9_-]{12,})\b", "[REDACTED_KEY]", value)
    value = re.sub(r"(Bearer\s+)[A-Za-z0-9._-]+", r"\1[REDACTED]", value, flags=re.IGNORECASE)
    return value


def _terminal_event_payload(event: SessionEvent) -> dict[str, Any]:
    return {
        "type": "terminal",
        "session_id": event.session_id,
        "provider": event.provider,
        "kind": event.kind,
        "text": _redact_terminal_text(event.text),
        "exit_code": event.exit_code,
        "timestamp": event.timestamp,
    }


@app.get("/api/terminal/sessions")
async def list_terminal_sessions() -> list[dict[str, Any]]:
    return [
        {
            "session_id": item.session_id,
            "provider": item.provider,
            "cwd": item.cwd,
            "running": item.running,
            "started_at": item.started_at,
            "output_bytes": item.output_bytes,
        }
        for item in terminal_sessions.list_sessions()
    ]


@app.post("/api/terminal/sessions", status_code=201)
async def create_terminal_session(req: TerminalSessionRequest) -> dict[str, Any]:
    provider = req.provider.strip().lower()
    if req.agent_name:
        agent = runtime.get_agent(req.agent_name)
        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado.")
        configured_provider = (agent.provider_id or "").strip().lower()
        if configured_provider in {"codex", "claude"} and configured_provider != provider:
            raise HTTPException(status_code=422, detail="O provedor não corresponde ao agente selecionado.")
        if req.cwd is None and agent.workspace_path:
            req.cwd = agent.workspace_path
    try:
        session_id = terminal_sessions.start_session(
            provider,
            cwd=req.cwd,
            timeout_seconds=req.timeout_seconds,
        )
        session = next(item for item in terminal_sessions.list_sessions() if item.session_id == session_id)
    except (ValueError, PermissionError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "session_id": session.session_id,
        "provider": session.provider,
        "cwd": session.cwd,
        "running": session.running,
        "websocket": f"/ws/terminal/{session.session_id}",
    }


@app.post("/api/terminal/sessions/{session_id}/input")
async def send_terminal_input(session_id: str, req: TerminalInputRequest) -> dict[str, Any]:
    try:
        terminal_sessions.send_input(session_id, req.text)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.") from exc
    except (RuntimeError, TypeError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"ok": True, "session_id": session_id}


@app.post("/api/terminal/sessions/{session_id}/stop")
async def stop_terminal_session(session_id: str) -> dict[str, Any]:
    try:
        terminal_sessions.stop_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.") from exc
    return {"ok": True, "session_id": session_id}


@app.get("/api/providers")
async def get_providers() -> list[dict[str, object]]:
    return provider_registry.list_providers()


@app.get("/api/credentials")
async def list_credentials() -> list[dict[str, Any]]:
    """Return provider configuration state without returning any secret."""
    try:
        return credential_store.list_public()
    except CredentialStoreError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Credential store listing failed")
        raise HTTPException(status_code=503, detail="Armazenamento de credenciais indisponível.") from exc


@app.put("/api/credentials/{provider_id}")
@app.post("/api/credentials/{provider_id}")
async def save_credential(provider_id: str, req: CredentialRequest) -> dict[str, Any]:
    """Create or replace one provider key; the key never enters the response or event bus."""
    try:
        if not req.api_key.strip() and provider_id.strip().lower() != "ollama":
            raise ValueError("A API key não pode ficar vazia para este provedor.")
        return credential_store.set(
            provider_id,
            req.api_key,
            name=req.name,
            model=req.model,
            base_url=req.base_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except CredentialStoreError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Credential store write failed")
        raise HTTPException(status_code=503, detail="Armazenamento de credenciais indisponível.") from exc


@app.delete("/api/credentials/{provider_id}")
async def delete_credential(provider_id: str) -> dict[str, Any]:
    try:
        credential_store.delete(provider_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except CredentialStoreError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Credential store delete failed")
        raise HTTPException(status_code=503, detail="Armazenamento de credenciais indisponível.") from exc
    return {"provider_id": provider_id.strip().lower(), "configured": False}


@app.post("/api/credentials/{provider_id}/test")
async def test_credential(provider_id: str) -> dict[str, Any]:
    """Check that a credential entry is readable without returning its secret.

    Network calls are intentionally not performed here: provider-specific
    connectivity belongs to the normal model request path and may cost money.
    """
    try:
        config = credential_store.get_config(provider_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except CredentialStoreError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not config:
        raise HTTPException(status_code=404, detail="Integração não encontrada.")
    return {"ok": True, "detail": "Integração armazenada e disponível para uso."}


@app.get("/api/routines")
async def get_routines(agent_name: Optional[str] = None, limit: int = 50) -> list[dict[str, Any]]:
    return runtime.database.list_routines(agent_name=agent_name, limit=limit)


@app.post("/api/routines", status_code=201)
async def create_routine(req: RoutineRequest) -> dict[str, Any]:
    try:
        routine = runtime.create_routine(req.agent_name, req.name, req.prompt, req.schedule)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await global_event_bus.emit('routine.created', {'routine': routine}, source=req.agent_name)
    return routine


@app.get("/api/routines/{routine_id}")
async def get_routine(routine_id: str) -> dict[str, Any]:
    routine = runtime.get_routine(routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail='Rotina não encontrada.')
    return {**routine, "runs": runtime.database.list_routine_runs(routine_id)}


@app.patch("/api/routines/{routine_id}")
async def update_routine(routine_id: str, req: RoutineUpdateRequest) -> dict[str, Any]:
    try:
        routine = runtime.update_routine(
            routine_id, name=req.name, prompt=req.prompt, schedule=req.schedule, status=req.status
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not routine:
        raise HTTPException(status_code=404, detail='Rotina não encontrada.')
    await global_event_bus.emit('routine.updated', {'routine': routine}, source=routine['agent_name'])
    return routine


@app.delete("/api/routines/{routine_id}")
async def delete_routine(routine_id: str) -> dict[str, Any]:
    routine = runtime.get_routine(routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail='Rotina não encontrada.')
    runtime.delete_routine(routine_id)
    await global_event_bus.emit('routine.deleted', {'routine_id': routine_id}, source=routine['agent_name'])
    return {"success": True}


@app.post("/api/routines/{routine_id}/run")
async def run_routine_now(routine_id: str) -> dict[str, Any]:
    """"Test run": submits the routine's own prompt as a real objective to its
    agent right now, through the same runtime.run_objective path a normal chat
    message takes — not a simulated/fake action."""
    routine = runtime.get_routine(routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail='Rotina não encontrada.')
    triggered_at = datetime.now(timezone.utc).isoformat()
    run = runtime.database.save_routine_run(
        run_id=f"run-{uuid.uuid4().hex[:10]}", routine_id=routine_id, status="triggered", triggered_at=triggered_at
    )
    task = asyncio.create_task(_execute_manual_routine_run(routine, run), name=f"routine-run:{run['id']}")
    routine_run_tasks.add(task)
    task.add_done_callback(_finish_manual_routine_task)
    await global_event_bus.emit('routine.run_triggered', {'routine': routine, 'run': run}, source=routine['agent_name'])
    return run


async def _execute_manual_routine_run(routine: dict[str, Any], run: dict[str, Any]) -> None:
    """Run a manually-triggered routine and persist its complete lifecycle.

    The API responds immediately with ``triggered`` while this supervised task
    carries the execution to a terminal state. Exceptions are persisted and
    emitted so a background task can never fail silently.
    """
    run_id = run["id"]
    routine_id = routine["id"]
    source = routine["agent_name"]
    mark_active = getattr(runtime, "mark_routine_run_active", None)
    mark_finished = getattr(runtime, "mark_routine_run_finished", None)
    if callable(mark_active):
        mark_active(run_id)
    try:
        runtime.database.update_routine_run(run_id, "running")
        result = await runtime.run_objective(routine["prompt"], None, source)
        result_status = result.get("status") if isinstance(result, dict) else None
        terminal_status = result_status if result_status in {"failed", "cancelled"} else "completed"
        updated = runtime.database.update_routine_run(run_id, terminal_status)
        await global_event_bus.emit(
            f"routine.run_{terminal_status}",
            {"routine_id": routine_id, "run": updated or {**run, "status": terminal_status}},
            source=source,
        )
    except asyncio.CancelledError:
        updated = runtime.database.update_routine_run(run_id, "cancelled")
        await global_event_bus.emit(
            "routine.run_cancelled",
            {"routine_id": routine_id, "run": updated or {**run, "status": "cancelled"}},
            source=source,
        )
        raise
    except Exception as exc:
        logger.exception("Manual routine run %s failed", run_id)
        updated = runtime.database.update_routine_run(run_id, "failed")
        await global_event_bus.emit(
            "routine.run_failed",
            {
                "routine_id": routine_id,
                "run": updated or {**run, "status": "failed"},
                "error": str(exc),
            },
            source=source,
        )
    finally:
        if callable(mark_finished):
            mark_finished(run_id)


def _finish_manual_routine_task(task: asyncio.Task[Any]) -> None:
    """Release a supervised task and consume any unexpected exception."""
    routine_run_tasks.discard(task)
    if task.cancelled():
        return
    try:
        task.exception()
    except Exception:
        logger.exception("Unexpected error while finalizing a manual routine task")


def _finish_objective_task(task: asyncio.Task[Any]) -> None:
    objective_tasks.discard(task)
    if task.cancelled():
        return
    try:
        error = task.exception()
    except Exception:
        logger.exception("Could not inspect background objective task")
        return
    if error is not None:
        logger.error("Background objective failed", exc_info=(type(error), error, error.__traceback__))


@app.get("/api/history")
async def get_history(limit: int = 50) -> dict[str, Any]:
    return {
        "runs": runtime.database.list_runs(limit=limit),
        "recent_events": runtime.database.list_recent_events(limit=limit),
        "messages": runtime.database.list_messages(limit=limit),
        "artifacts": runtime.database.list_artifacts(limit=limit),
        "routines": runtime.database.list_routines(limit=limit),
    }


@app.get("/api/agents/{agent_name}/history")
async def get_agent_history(agent_name: str, limit: int = 100) -> dict[str, Any]:
    if not runtime.get_agent(agent_name):
        raise HTTPException(status_code=404, detail='Agente não encontrado.')
    return {"messages": runtime.database.list_messages(agent_name=agent_name, limit=limit)}


def _resolve_objective_group(group_id: str) -> tuple[dict[str, Any], list[str]]:
    """Validate the persisted group before starting a background objective.

    Group execution is intentionally one runtime run coordinated by Quinta;
    the member list is carried as private planning metadata so the manager can
    scope its discussion without creating one duplicate run per member.
    """
    group = runtime.database.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")

    members: list[str] = []
    seen: set[str] = set()
    for raw_name in group.get("members") or []:
        name = str(raw_name).strip()
        key = name.casefold()
        if name and key not in seen:
            members.append(name)
            seen.add(key)
    if not members:
        raise HTTPException(status_code=422, detail="O grupo precisa ter ao menos um agente.")

    missing = [name for name in members if runtime.get_agent(name) is None]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Agentes do grupo não encontrados: {', '.join(missing)}.",
        )
    return group, members


@app.post("/api/objectives")
async def submit_objective(req: ObjectiveRequest) -> dict[str, Any]:
    agent_name = req.agent_name
    parameters = dict(req.parameters or {})
    group: Optional[dict[str, Any]] = None
    if req.group_id:
        group, members = _resolve_objective_group(req.group_id)
        # Quinta is the coordinator for a squad.  Members are planning scope,
        # not independent API submissions.
        agent_name = "Quinta"
        parameters["_group_members"] = members
        parameters["_group_id"] = req.group_id
    elif agent_name and not runtime.get_agent(agent_name):
        raise HTTPException(status_code=404, detail='Agente não encontrado.')
    # Start execution as background task in the running loop
    task = asyncio.create_task(runtime.run_objective(req.objective, parameters, agent_name), name="objective-run")
    objective_tasks.add(task)
    task.add_done_callback(_finish_objective_task)
    return {
        "message": "Objective submitted and processing started.",
        "objective": req.objective,
        "agent_name": agent_name or "Quinta",
        "group_id": group["id"] if group else None,
    }


@app.post("/api/kill-switch")
async def trigger_kill_switch() -> dict[str, Any]:
    scheduler.pause()
    result = await runtime.stop_all(reason="Stop All activated via API")
    for task in (*routine_run_tasks, *objective_tasks):
        task.cancel()
    return result


@app.post("/api/resume")
async def resume_runtime() -> dict[str, Any]:
    """Explicitly resume agents and scheduled routines after a kill switch."""
    result = await runtime.resume_all()
    scheduler.resume()
    await global_event_bus.emit("runtime.resumed", result, source="runtime")
    return result


@app.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
    if not _websocket_origin_allowed(websocket):
        await websocket.close(code=1008, reason="Origin não autorizado.")
        return
    await websocket.accept()
    active_websockets.add(websocket)
    try:
        # Send initial backlog of recent events
        history = global_event_bus.get_history(limit=30)
        await websocket.send_json({"type": "history_sync", "events": history})

        # Keep connection alive listening for ping / commands
        while True:
            data = await websocket.receive_text()
            # Allow client to ping or send quick commands
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        active_websockets.discard(websocket)
    except Exception:
        active_websockets.discard(websocket)


@app.websocket("/ws/terminal/{session_id}")
async def websocket_terminal_endpoint(websocket: WebSocket, session_id: str):
    """Stream one local Codex/Claude session and accept bounded stdin."""
    if not _websocket_origin_allowed(websocket):
        await websocket.close(code=1008, reason="Origin não autorizado.")
        return
    try:
        session = next(item for item in terminal_sessions.list_sessions() if item.session_id == session_id)
    except StopIteration:
        await websocket.close(code=1008, reason="Sessão não encontrada.")
        return

    await websocket.accept()
    loop = asyncio.get_running_loop()
    events: asyncio.Queue[SessionEvent] = asyncio.Queue(maxsize=200)

    def on_event(event: SessionEvent) -> None:
        if event.session_id != session_id:
            return
        payload = event
        try:
            loop.call_soon_threadsafe(events.put_nowait, payload)
        except (RuntimeError, asyncio.QueueFull):
            pass

    terminal_sessions.add_callback(on_event)

    async def stream_events() -> None:
        while True:
            event = await events.get()
            await websocket.send_json(_terminal_event_payload(event))
            if event.kind == "exited":
                return

    sender = asyncio.create_task(stream_events(), name=f"terminal-stream:{session_id}")
    try:
        await websocket.send_json({
            "type": "terminal_session",
            "session_id": session.session_id,
            "provider": session.provider,
            "cwd": session.cwd,
            "running": session.running,
        })
        while True:
            message = await websocket.receive_json()
            if not isinstance(message, dict):
                continue
            message_type = str(message.get("type") or "").strip().lower()
            if message_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif message_type == "input":
                text = message.get("text", "")
                if not isinstance(text, str) or len(text) > 32_000:
                    await websocket.send_json({"type": "error", "text": "Entrada inválida ou grande demais."})
                    continue
                try:
                    terminal_sessions.send_input(session_id, text)
                except (KeyError, RuntimeError, TypeError) as exc:
                    await websocket.send_json({"type": "error", "text": _redact_terminal_text(str(exc))})
            elif message_type == "stop":
                try:
                    terminal_sessions.stop_session(session_id)
                except KeyError:
                    break
            else:
                await websocket.send_json({"type": "error", "text": "Mensagem de terminal desconhecida."})
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Terminal websocket failed for %s", session_id)
    finally:
        terminal_sessions.remove_callback(on_event)
        sender.cancel()
        await asyncio.gather(sender, return_exceptions=True)


from pathlib import Path
from fastapi.staticfiles import StaticFiles

web_dist = Path(__file__).resolve().parents[3] / "web" / "dist"
if web_dist.exists():
    app.mount("/", StaticFiles(directory=str(web_dist), html=True), name="web")


def start():
    import uvicorn
    import sys
    from pathlib import Path
    src_path = str(Path(__file__).resolve().parents[2])
    # Keep the local default private, while allowing container/process managers
    # to bind the API explicitly (for example WADDLE_API_HOST=0.0.0.0).
    host = os.getenv("WADDLE_API_HOST", "127.0.0.1").strip() or "127.0.0.1"
    try:
        port = int(os.getenv("WADDLE_API_PORT", "8000"))
    except ValueError:
        port = 8000
    uvicorn.run("waddle.api.server:app", host=host, port=port, reload=False, app_dir=src_path)


if __name__ == "__main__":
    start()
