# tests/conftest.py
import os
from pathlib import Path
import pytest


def _load_env():
    env = Path(__file__).resolve().parents[1] / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


@pytest.fixture(scope="session", autouse=True)
def _env():
    _load_env()
