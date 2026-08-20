# -*- coding: utf-8 -*-
"""MINIMAX_API_KEYS falls back to LLM_MINIMAX_API_KEY when unset."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from src.config import Config


class MiniMaxSearchKeyInheritTestCase(unittest.TestCase):
    def test_reuses_llm_minimax_key_when_search_keys_empty(self) -> None:
        env = {
            "MINIMAX_API_KEYS": "",
            "LLM_MINIMAX_API_KEY": "sk-test-llm-key",
        }
        with patch.dict(os.environ, env, clear=False):
            cfg = Config._load_from_env()
        self.assertEqual(cfg.minimax_api_keys, ["sk-test-llm-key"])

    def test_explicit_search_keys_win(self) -> None:
        env = {
            "MINIMAX_API_KEYS": "sk-search-only",
            "LLM_MINIMAX_API_KEY": "sk-test-llm-key",
        }
        with patch.dict(os.environ, env, clear=False):
            cfg = Config._load_from_env()
        self.assertEqual(cfg.minimax_api_keys, ["sk-search-only"])


if __name__ == "__main__":
    unittest.main()
