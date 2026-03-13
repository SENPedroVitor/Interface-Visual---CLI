from __future__ import annotations

import os
import pty
import selectors
import subprocess
import sys
import termios
import tty
from typing import Iterable

from .history import HistoryStore


def _set_raw(fd: int) -> list[int]:
    original = termios.tcgetattr(fd)
    tty.setraw(fd)
    return original


def _restore(fd: int, original: list[int]) -> None:
    termios.tcsetattr(fd, termios.TCSADRAIN, original)


def _safe_decode(data: bytes) -> str:
    return data.decode("utf-8", errors="replace")


def run_repl_session(command: Iterable[str], backend_name: str, command_label: str) -> int:
    master_fd, slave_fd = pty.openpty()
    proc = subprocess.Popen(
        list(command),
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        close_fds=True,
    )
    os.close(slave_fd)

    store = HistoryStore.open()
    session_id = None
    if store:
        session_id = store.start_session(backend_name, command_label)

    sel = selectors.DefaultSelector()
    sel.register(master_fd, selectors.EVENT_READ, "master")
    sel.register(sys.stdin, selectors.EVENT_READ, "stdin")

    stdin_fd = sys.stdin.fileno()
    original_tty = _set_raw(stdin_fd)
    exit_code = 0

    try:
        while True:
            for key, _ in sel.select(timeout=0.1):
                if key.data == "stdin":
                    data = os.read(stdin_fd, 1024)
                    if not data:
                        exit_code = proc.poll() or 0
                        return exit_code
                    if store and session_id is not None:
                        store.log_event(session_id, "in", _safe_decode(data))
                    os.write(master_fd, data)
                else:
                    data = os.read(master_fd, 1024)
                    if not data:
                        exit_code = proc.poll() or 0
                        return exit_code
                    if store and session_id is not None:
                        store.log_event(session_id, "out", _safe_decode(data))
                    os.write(sys.stdout.fileno(), data)

            if proc.poll() is not None:
                exit_code = proc.returncode or 0
                return exit_code
    finally:
        _restore(stdin_fd, original_tty)
        try:
            sel.unregister(master_fd)
            sel.unregister(sys.stdin)
        except Exception:
            pass
        try:
            os.close(master_fd)
        except Exception:
            pass
        if store and session_id is not None:
            store.end_session(session_id)
