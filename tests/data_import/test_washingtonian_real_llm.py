# tests/data_import/test_washingtonian_real_llm.py
import os
import pytest
from pathlib import Path
from scripts.data_import.washingtonian.run import WashingtonianSource


@pytest.mark.skipif(
    os.environ.get("RUN_LLM_TESTS") != "1",
    reason="real-LLM test gated by RUN_LLM_TESTS=1",
)
def test_real_llm_extracts_or_returns_empty_gracefully():
    article_html = Path("tests/fixtures/washingtonian/article-1.html").read_text()
    raw = {"article_url": "https://washingtonian.com/sections/things-to-do/sample/", "html": article_html}
    out = WashingtonianSource().extract(raw)
    # We can't assert specific content (LLM output varies). Just assert structural sanity.
    for ex in out:
        assert ex["external_id"]
        assert ex["payload"]["title"]
        assert ex["payload"]["start_at"]
        assert ex["payload"]["type"] in ("music", "food", "arts", "outdoors", "civic", "community")
