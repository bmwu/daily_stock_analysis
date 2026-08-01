# -*- coding: utf-8 -*-
"""LiteLLM generation backend wrapper."""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Tuple

from src.llm.generation_backend import (
    GenerationBackend,
    GenerationCapabilities,
    GenerationResult,
)
from src.llm.generation_params import resolve_litellm_provider_namespace


LiteLLMCallable = Callable[..., Tuple[str, str, Dict[str, Any]]]


def _resolve_litellm_provider(
    model: str,
    usage: Optional[Dict[str, Any]],
    *,
    audit_context: Optional[Dict[str, Any]] = None,
    generation_config: Optional[Dict[str, Any]] = None,
) -> str:
    usage_payload = usage or {}
    audit = audit_context or {}
    for candidate in (usage_payload.get("provider"), audit.get("provider")):
        if candidate:
            return str(candidate).strip()

    model_list: Optional[List[Dict[str, Any]]] = None
    for source in (audit, generation_config or {}):
        raw_list = source.get("model_list")
        if isinstance(raw_list, list):
            model_list = raw_list
            break

    return resolve_litellm_provider_namespace(model, model_list)


class LiteLLMGenerationBackend(GenerationBackend):
    """Thin adapter around the existing LiteLLM analyzer call path."""

    backend_id = "litellm"
    capabilities = GenerationCapabilities(
        supports_json=True,
        supports_tools=True,
        supports_stream=True,
        supports_vision=False,
        supports_health_check=False,
        supports_smoke_test=False,
    )

    def __init__(self, completion_callable: LiteLLMCallable):
        self._completion_callable = completion_callable

    def generate(
        self,
        prompt: str,
        generation_config: Dict[str, Any],
        *,
        system_prompt: Optional[str] = None,
        stream: bool = False,
        stream_progress_callback: Optional[Callable[[int], None]] = None,
        response_validator: Optional[Callable[[str], None]] = None,
        audit_context: Optional[Dict[str, Any]] = None,
    ) -> GenerationResult:
        text, model, usage = self._completion_callable(
            prompt,
            generation_config,
            system_prompt=system_prompt,
            stream=stream,
            stream_progress_callback=stream_progress_callback,
            response_validator=response_validator,
            audit_context=audit_context,
        )
        provider = _resolve_litellm_provider(
            model,
            usage,
            audit_context=audit_context,
            generation_config=generation_config,
        )
        return GenerationResult(
            text=text,
            model=model,
            provider=provider,
            backend=self.backend_id,
            usage=usage or {},
            raw=None,
            diagnostics={},
        )
