import json
import typer

from .history import HistoryStore

app = typer.Typer()


@app.command("list-sessions")
def list_sessions():
    store = HistoryStore.open()
    if not store:
        raise typer.Exit(code=1)
    typer.echo(json.dumps(store.list_sessions()))


@app.command("list-events")
def list_events(session_id: int):
    store = HistoryStore.open()
    if not store:
        raise typer.Exit(code=1)
    typer.echo(json.dumps(store.list_events(session_id)))


if __name__ == "__main__":
    app()
