from pathlib import Path
from dotenv import load_dotenv, set_key
import os


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"


def ensure_env():
    if not ENV_PATH.exists():
        ENV_PATH.write_text("")


def get_env_value(key: str, default: str | None = None) -> str | None:
    load_dotenv(ENV_PATH)
    return os.getenv(key, default)


def set_env_value(key: str, value: str) -> None:
    ensure_env()
    set_key(str(ENV_PATH), key, value)
