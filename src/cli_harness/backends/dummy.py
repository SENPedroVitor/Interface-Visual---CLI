from .base import BackendBase


class DummyBackend:
    """A trivial backend for testing and examples."""
    name = "dummy"

    def list_models(self) -> list[str]:
        return ["tiny-dummy", "small-dummy"]

    def send_message(self, message: str, model: str | None = None) -> dict:
        model = model or "tiny-dummy"
        return {"model": model, "reply": f"(dummy response to '{message}' from {model})"}
