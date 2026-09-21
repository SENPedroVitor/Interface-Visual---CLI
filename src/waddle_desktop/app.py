from __future__ import annotations

import sys
from pathlib import Path

try:
    from PySide6.QtCore import QUrl
    from PySide6.QtGui import QGuiApplication
    from PySide6.QtQml import QQmlApplicationEngine
except ImportError:  # pragma: no cover
    QUrl = None  # type: ignore
    QGuiApplication = None  # type: ignore
    QQmlApplicationEngine = None  # type: ignore

from .controller import DesktopController


def get_qml_path() -> Path:
    return Path(__file__).resolve().parent / "qml" / "Main.qml"


def main() -> int:
    if QGuiApplication is None or QQmlApplicationEngine is None:
        raise RuntimeError("PySide6 is required to run the native desktop app.")

    app = QGuiApplication(sys.argv)
    app.setApplicationName("Waddle")
    app.setOrganizationName("Waddle")
    app.setDesktopFileName("waddle")

    controller = DesktopController()
    engine = QQmlApplicationEngine()
    engine.rootContext().setContextProperty("desktopController", controller)
    engine.load(QUrl.fromLocalFile(str(get_qml_path())))
    if not engine.rootObjects():
        controller.shutdown()
        return 1
    app.aboutToQuit.connect(controller.shutdown)
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
