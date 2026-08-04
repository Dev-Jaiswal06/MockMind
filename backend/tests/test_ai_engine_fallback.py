import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import ai_engine


def test_generate_text_falls_back_to_next_provider(monkeypatch):
    calls = []

    def fake_gemini(*args, **kwargs):
        calls.append("gemini")
        raise RuntimeError("quota exceeded")

    def fake_openrouter(*args, **kwargs):
        calls.append("openrouter")
        return "fallback response"

    monkeypatch.setattr(ai_engine, "_call_gemini", fake_gemini)
    monkeypatch.setattr(ai_engine, "_call_openrouter", fake_openrouter)
    monkeypatch.setattr(ai_engine, "_call_grok", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("grok should not be called")))

    result = ai_engine._generate_text("hello", provider_order=["gemini", "openrouter"], temp=0.2)

    assert result == "fallback response"
    assert calls == ["gemini", "openrouter"]
