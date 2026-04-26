# tests/db/conftest.py
import os
import pytest
from supabase import create_client, Client


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
