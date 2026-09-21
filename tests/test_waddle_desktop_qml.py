import os
import unittest

try:
    from PySide6.QtCore import QUrl, qInstallMessageHandler
    from PySide6.QtGui import QGuiApplication
    from PySide6.QtQml import QQmlApplicationEngine

    HAS_PYSIDE6 = True
except ImportError:
    HAS_PYSIDE6 = False

from waddle_desktop.app import get_qml_path
from waddle_desktop.controller import DesktopController


@unittest.skipUnless(HAS_PYSIDE6, "PySide6 not installed")
def test_waddle_desktop_qml_loads_offscreen(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("WADDLE_DATA_DIR", str(tmp_path / "data"))
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    app = QGuiApplication.instance() or QGuiApplication([])

    messages: list[str] = []

    def handler(_msg_type, _context, message: str) -> None:
        messages.append(message)

    controller = DesktopController(db_path=tmp_path / "state.db")
    previous_handler = qInstallMessageHandler(handler)
    try:
        engine = QQmlApplicationEngine()
        engine.rootContext().setContextProperty("desktopController", controller)
        engine.load(QUrl.fromLocalFile(str(get_qml_path())))
    finally:
        qInstallMessageHandler(previous_handler)
        controller.shutdown()

    assert engine.rootObjects()
    assert not [message for message in messages if "Error" in message or "ReferenceError" in message]
