"""FastAPI Backend Server and WebSocket Stream for Waddle Agent OS."""
from __future__ import annotations

import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ..runtime.agent_runtime import AgentRuntime
from ..core.event_bus import Event, global_event_bus
from ..providers import ProviderRegistry
from ..tools.registry import global_tool_registry


runtime = AgentRuntime(event_bus=global_event_bus, tool_registry=global_tool_registry)
provider_registry = ProviderRegistry()
active_websockets: set[WebSocket] = set()


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
    yield
    active_websockets.clear()


app = FastAPI(title="Waddle Agent OS API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ObjectiveRequest(BaseModel):
    objective: str
    parameters: Optional[dict[str, Any]] = None
    agent_name: Optional[str] = None


class AgentRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    role: str
    description: str = Field(default='', max_length=240)
    provider_id: str = Field(default='ollama', max_length=24)
    soul: Optional[str] = None
    skills: Optional[list[str]] = None
    memory: Optional[list[dict[str, Any]]] = None
    avatar_config: Optional[dict[str, Any]] = None
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
        if any(k in data for k in ("soul", "skills", "memory", "avatar_config", "model_config")):
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


@app.get("/api/providers")
async def get_providers() -> list[dict[str, object]]:
    return provider_registry.list_providers()


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
    asyncio.create_task(runtime.run_objective(routine["prompt"], None, routine["agent_name"]))
    await global_event_bus.emit('routine.run_triggered', {'routine': routine, 'run': run}, source=routine['agent_name'])
    return run


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


@app.post("/api/objectives")
async def submit_objective(req: ObjectiveRequest) -> dict[str, Any]:
    if req.agent_name and not runtime.get_agent(req.agent_name):
        raise HTTPException(status_code=404, detail='Agente não encontrado.')
    # Start execution as background task in the running loop
    asyncio.create_task(runtime.run_objective(req.objective, req.parameters, req.agent_name))
    return {
        "message": "Objective submitted and processing started.",
        "objective": req.objective,
    }


@app.post("/api/kill-switch")
async def trigger_kill_switch() -> dict[str, Any]:
    result = await runtime.stop_all(reason="Stop All activated via API")
    return result


@app.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
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
    uvicorn.run("waddle.api.server:app", host="127.0.0.1", port=8000, reload=False, app_dir=src_path)


if __name__ == "__main__":
    start()
