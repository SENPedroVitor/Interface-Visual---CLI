from __future__ import annotations

import random
import sys
from datetime import datetime
from pathlib import Path

try:
    from PySide6.QtCore import QUrl, QResource, qInstallMessageHandler
    from PySide6.QtGui import QGuiApplication
    from PySide6.QtQml import QQmlApplicationEngine
except ImportError:
    QUrl = None  # type: ignore
    QResource = None  # type: ignore
    qInstallMessageHandler = None  # type: ignore
    QGuiApplication = None  # type: ignore
    QQmlApplicationEngine = None  # type: ignore

from .config import get_obsidian_vault_path
from .native_controller import NativeChatController


def get_qml_path() -> Path:
    return Path(__file__).resolve().parent / "qml" / "Main.qml"


def get_asset_path(name: str) -> Path:
    return Path(__file__).resolve().parent.parent.parent / "assets" / name


def get_mascot_variants() -> dict[str, list[str]]:
    """
    Returns a dictionary mapping time periods to lists of modern mascot variants.
    """
    return {
        "morning": ["waddle.svg", "waddle_success.svg"],
        "afternoon": ["waddle.svg", "waddle_thinking.svg"],
        "coffee": ["waddle.svg", "waddle_typing.svg"],
        "evening": ["waddle.svg", "waddle_success.svg"],
        "night": ["waddle.svg", "waddle_blink.svg"],
    }


def get_time_period(hour: int) -> str:
    """Determine the time period based on hour."""
    if hour < 12:
        return "morning"
    elif hour < 15:
        return "afternoon"
    elif hour < 18:
        return "coffee"
    elif hour < 22:
        return "evening"
    else:
        return "night"


def select_mascot_file(hour: int | None = None, use_random: bool = True) -> str:
    """
    Select a mascot file based on time of day and optionally random variant.
    """
    if hour is None:
        hour = datetime.now().hour
    
    period = get_time_period(hour)
    variants = get_mascot_variants().get(period, ["waddle.svg"])
    
    if use_random and len(variants) > 1:
        return random.choice(variants)
    return variants[0]


def main() -> int:
    log_dir = Path.home() / ".local" / "share" / "cli_harness"
    log_dir.mkdir(parents=True, exist_ok=True)
    qt_log_path = log_dir / "qt_runtime.log"

    def qt_message_handler(_msg_type, _context, message: str) -> None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            with qt_log_path.open("a", encoding="utf-8") as fh:
                fh.write(f"[{timestamp}] {message}\n")
        except Exception:
            pass

    try:
        with qt_log_path.open("a", encoding="utf-8") as fh:
            fh.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] waddle bootstrap\n")
    except Exception:
        pass

    qInstallMessageHandler(qt_message_handler)

    app = QGuiApplication(sys.argv)
    app.setApplicationName("Waddle")
    app.setOrganizationName("cli-harness")
    app.setDesktopFileName("waddle")

    # Select mascot based on time of day with random variant
    # Periods: morning (<12), afternoon (12-15), coffee (15-18), evening (18-22), night (>22)
    hour = datetime.now().hour
    mascot_file = select_mascot_file(hour, use_random=True)

    mascot_path = get_asset_path(mascot_file)
    mascot_url = mascot_path.as_uri() if mascot_path.exists() else ""

    engine = QQmlApplicationEngine()
    controller = NativeChatController()
    # Set initial mascot URL on controller so it can be changed later
    controller.mascotUrl = mascot_url

    engine.rootContext().setContextProperty("chatController", controller)
    engine.rootContext().setContextProperty("mascotUrl", controller.mascotUrl)
    engine.rootContext().setContextProperty("mascotState", controller.mascotState)
    engine.rootContext().setContextProperty("configuredObsidianVaultPath", str(get_obsidian_vault_path()))
    engine.load(QUrl.fromLocalFile(str(get_qml_path())))

    if not engine.rootObjects():
        return 1

    exit_code = app.exec()
    controller.stop_session()
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
