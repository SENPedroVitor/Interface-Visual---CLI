from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtCore import QUrl, QResource
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine

from .native_controller import NativeChatController


def get_qml_path() -> Path:
    return Path(__file__).resolve().parent / "qml" / "Main.qml"


def get_asset_path(name: str) -> Path:
    return Path(__file__).resolve().parent.parent.parent / "assets" / name


def main() -> int:
    app = QGuiApplication(sys.argv)
    app.setApplicationName("Waddle")
    app.setOrganizationName("cli-harness")
    app.setDesktopFileName("waddle")

    # Get asset paths based on time of day
    from datetime import datetime
    hour = datetime.now().hour

    if hour < 12:
        mascot_file = "waddle_morning.svg"  # Coffee cup
    elif hour < 18:
        mascot_file = "waddle_afternoon.svg"  # Headphones
    else:
        mascot_file = "waddle_night.svg"  # Bed

    mascot_path = get_asset_path(mascot_file)
    mascot_url = mascot_path.as_uri() if mascot_path.exists() else ""

    engine = QQmlApplicationEngine()
    controller = NativeChatController()
    engine.rootContext().setContextProperty("chatController", controller)
    engine.rootContext().setContextProperty("mascotUrl", mascot_url)
    engine.load(QUrl.fromLocalFile(str(get_qml_path())))

    if not engine.rootObjects():
        return 1

    exit_code = app.exec()
    controller.stop_session()
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
