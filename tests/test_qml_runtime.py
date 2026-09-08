import os
import unittest

try:
    from PySide6.QtCore import QUrl, qInstallMessageHandler
    from PySide6.QtGui import QGuiApplication
    from PySide6.QtQml import QQmlApplicationEngine
    HAS_PYSIDE6 = True
except ImportError:
    HAS_PYSIDE6 = False

from cli_harness.native_app import get_qml_path


@unittest.skipUnless(HAS_PYSIDE6, "PySide6 not installed")
def test_qml_loads_without_missing_cli_typeerror() -> None:
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    app = QGuiApplication.instance() or QGuiApplication([])

    messages: list[str] = []

    def handler(_msg_type, _context, message: str) -> None:
        messages.append(message)

    previous_handler = qInstallMessageHandler(handler)
    try:
        engine = QQmlApplicationEngine()
        engine.rootContext().setContextProperty("mascotUrl", "")
        engine.rootContext().setContextProperty(
            "configuredObsidianVaultPath",
            "/tmp",
        )
        engine.load(QUrl.fromLocalFile(str(get_qml_path())))
    finally:
        qInstallMessageHandler(previous_handler)

    assert engine.rootObjects()
    assert not any(
        "TypeError: Cannot read property 'missingCliName' of null" in message
        for message in messages
    )
