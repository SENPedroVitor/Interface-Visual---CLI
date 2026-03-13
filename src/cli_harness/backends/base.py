from typing import Protocol, Any


class BackendBase(Protocol):
    name: str

    def list_models(self) -> list[str]:
        ...

    def send_message(self, message: str, model: str | None = None) -> dict[str, Any]:
        ...
