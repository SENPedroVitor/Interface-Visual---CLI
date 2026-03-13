import typer
from typing import Optional
from .backends import BACKENDS
from .config import get_env_value, set_env_value

app = typer.Typer()


@app.command()
def configure(key: str, value: str):
    """Save a key/value into .env (local project .env)."""
    set_env_value(key, value)
    typer.echo(f"Saved {key} into .env")


@app.command()
def list_backends():
    """List available backend adapters."""
    for name in BACKENDS:
        typer.echo(f"- {name}")


@app.command()
def list_models(backend: str = typer.Option("dummy")):
    """List models from a backend."""
    b = BACKENDS.get(backend)
    if not b:
        raise typer.BadParameter("Unknown backend")
    for m in b.list_models():
        typer.echo(m)


@app.command()
def test_backend(backend: str = typer.Option("dummy"), message: str = "hello"):
    """Send a test message to a backend and print the result."""
    b = BACKENDS.get(backend)
    if not b:
        raise typer.BadParameter("Unknown backend")
    resp = b.send_message(message)
    typer.echo(resp)


@app.command()
def chat(
    backend: str = typer.Option("dummy"),
    model: Optional[str] = None,
    message: Optional[str] = None,
):
    """Interactive chat REPL or single-message mode with a backend."""
    b = BACKENDS.get(backend)
    if not b:
        raise typer.BadParameter("Unknown backend")

    if getattr(b, "is_repl", False):
        if message:
            raise typer.BadParameter("REPL backends do not support --message.")
        exit_code = b.run_repl()
        raise typer.Exit(code=exit_code)

    if message:
        resp = b.send_message(message, model=model)
        typer.echo(resp)
        raise typer.Exit()

    typer.echo("Entering interactive chat (Ctrl-C to quit). Type messages and press Enter.")
    try:
        while True:
            msg = typer.prompt("You")
            resp = b.send_message(msg, model=model)
            typer.echo(f"AI: {resp.get('reply')}")
    except (KeyboardInterrupt, EOFError):
        typer.echo("\nBye")


if __name__ == "__main__":
    app()
