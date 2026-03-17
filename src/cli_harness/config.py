from pathlib import Path
from dotenv import load_dotenv, set_key
import os


# config.py lives in <root>/src/cli_harness/, so project root is parents[2].
PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = PROJECT_ROOT / ".env"
DEFAULT_OBSIDIAN_VAULT_PATH = Path.home() / "Documents" / "vault-faux"


def ensure_env():
    if not ENV_PATH.exists():
        ENV_PATH.write_text("")


def get_env_value(key: str, default: str | None = None) -> str | None:
    load_dotenv(ENV_PATH)
    return os.getenv(key, default)


def set_env_value(key: str, value: str) -> None:
    ensure_env()
    set_key(str(ENV_PATH), key, value)


def get_obsidian_vault_path() -> Path:
    configured_path = get_env_value("OBSIDIAN_VAULT_PATH")
    if configured_path:
        return Path(configured_path).expanduser()
    return DEFAULT_OBSIDIAN_VAULT_PATH
