from .dummy import DummyBackend
from .repl import ReplBackend

BACKENDS = {
    "dummy": DummyBackend(),
    "codex": ReplBackend(name="codex", command_env="CODEX_CMD", default_cmd="codex"),
    "qwen": ReplBackend(name="qwen", command_env="QWEN_CMD", default_cmd="qwen"),
}
