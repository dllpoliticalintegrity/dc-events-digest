# tests/db/conftest.py
import os
from pathlib import Path
import pytest
from supabase import create_client, Client


def _load_env():
    env = Path(__file__).resolve().parents[2] / ".env"
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


@pytest.fixture
def sb() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


@pytest.fixture(autouse=True)
def _clean(sb: Client):
    # Clean staging + events between tests so order doesn't matter.
    sb.table("staging_events").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("event_tags").delete().neq("event_id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("events").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    yield
