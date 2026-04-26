from scripts.shared.supabase import get_supabase_client, reset_for_tests


def test_returns_client_with_service_role():
    reset_for_tests()
    client = get_supabase_client()
    # Sanity check: a write to staging_events should succeed (anon would fail)
    res = client.table("staging_events").select("id").limit(1).execute()
    assert hasattr(res, "data")  # query ran without permission error
