from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtCore import QUrl
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine

from .native_controller import NativeChatController


def get_qml_path() -> Path:
    return Path(__file__).resolve().parent / "qml" / "Main.qml"


def main() -> int:
    app = QGuiApplication(sys.argv)
    app.setApplicationName("Osaurus Native")
    app.setOrganizationName("cli-harness")

    engine = QQmlApplicationEngine()
    controller = NativeChatController()
    engine.rootContext().setContextProperty("chatController", controller)
    engine.load(QUrl.fromLocalFile(str(get_qml_path())))

    if not engine.rootObjects():
        return 1

    exit_code = app.exec()
    controller.stop_session()
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
