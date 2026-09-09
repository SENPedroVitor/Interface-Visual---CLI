"""FastAPI Backend Server and WebSocket Stream for Waddle Agent OS."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ..runtime.agent_runtime import AgentRuntime
from ..core.event_bus import Event, global_event_bus
from ..tools.registry import global_tool_registry


runtime = AgentRuntime(event_bus=global_event_bus, tool_registry=global_tool_registry)
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


@app.post('/api/agents', status_code=201)
async def create_agent(req: AgentRequest) -> dict[str, Any]:
    try:
        agent = runtime.create_agent(req.name, req.role, req.description)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await global_event_bus.emit('agent.created', {'agent': agent}, source=agent['name'])
    return agent


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


@app.get("/api/history")
async def get_history(limit: int = 50) -> dict[str, Any]:
    return {
        "runs": runtime.database.list_runs(limit=limit),
        "recent_events": runtime.database.list_recent_events(limit=limit),
    }


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
