"""Provider calls for Waddle's agent conversations.

The client intentionally reads credentials from environment variables at call
time and never persists secrets in the database. When a provider is not
configured, it returns a fallback result so the manager can keep the local
conversation flowing.
"""
from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Any, Callable, Mapping, Optional

import httpx

from ..agents.base import Agent


PostJson = Callable[[str, dict[str, Any], dict[str, str], float], dict[str, Any]]


@dataclass(frozen=True)
class ProviderResult:
    provider_id: str
    model: Optional[str]
    content: Optional[str]
    fallback: bool = False
    error: Optional[str] = None


class LLMProviderClient:
    """Small synchronous adapter for Ollama, Claude and OpenAI/Codex.

    Provider mapping:
    - ``ollama`` talks to the local Ollama HTTP API.
    - ``claude`` talks to Anthropic's Messages API when ``ANTHROPIC_API_KEY`` exists.
    - ``codex``/``openai`` talks to OpenAI's Responses API when ``OPENAI_API_KEY`` exists.

    Codex CLI remains a separate local terminal integration in this project; the
    HTTP path is for cloud OpenAI model responses used inside Waddle's chat.
    """

    def __init__(
        self,
        *,
        timeout: float = 12.0,
        post_json: Optional[PostJson] = None,
        env: Optional[Mapping[str, str]] = None,
    ) -> None:
        self.timeout = timeout
        self._post_json = post_json or self._default_post_json
        self._env = env

    def generate(self, agent: Agent, prompt: str, *, assembled: bool = False) -> ProviderResult:
        """Generate a response from the agent's configured provider.

        Parameters
        ----------
        agent : Agent
            The agent making the request (used for provider routing and model config).
        prompt : str
            The prompt text.  When *assembled* is ``True``, this is a
            fully-built prompt from ``PromptBuilder`` and is sent as-is.
        assembled : bool
            If ``True``, the prompt already contains identity, soul, context,
            etc. and should not be wrapped with additional framing.
        """
        provider_id = (agent.provider_id or "ollama").lower()
        if provider_id == "ollama":
            return self._generate_ollama(agent, prompt)
        if provider_id == "claude":
            return self._generate_claude(agent, prompt)
        if provider_id in {"codex", "openai"}:
            return self._generate_openai(agent, prompt)
        return ProviderResult(
            provider_id=provider_id,
            model=None,
            content=None,
            fallback=True,
            error=f"Provider {provider_id} ainda não possui adaptador.",
        )

    def _generate_ollama(self, agent: Agent, prompt: str) -> ProviderResult:
        model = self._model(agent, "qwen2.5:0.5b")
        base_url = self._env_value("OLLAMA_BASE_URL") or self._env_value("OLLAMA_HOST") or "http://127.0.0.1:11434"
        url = f"{base_url.rstrip('/')}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"num_predict": int(agent.model_config.get("num_predict") or 180)},
        }
        try:
            response = self._post_json(url, payload, {"Content-Type": "application/json"}, self.timeout)
        except Exception as exc:
            return ProviderResult("ollama", model, None, fallback=True, error=f"Ollama indisponível: {exc}")
        content = str(response.get("response") or "").strip()
        return ProviderResult("ollama", model, content or None, fallback=not bool(content))

    def _generate_claude(self, agent: Agent, prompt: str) -> ProviderResult:
        api_key = self._env_value("ANTHROPIC_API_KEY")
        model = self._model(agent, self._env_value("ANTHROPIC_MODEL") or "claude-sonnet-5")
        if not api_key:
            return ProviderResult("claude", model, None, fallback=True, error="ANTHROPIC_API_KEY não configurada.")
        base_url = self._env_value("ANTHROPIC_BASE_URL") or "https://api.anthropic.com/v1"
        payload = {
            "model": model,
            "max_tokens": int(agent.model_config.get("max_tokens") or 512),
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": self._env_value("ANTHROPIC_VERSION") or "2023-06-01",
        }
        try:
            response = self._post_json(f"{base_url.rstrip('/')}/messages", payload, headers, self.timeout)
        except Exception as exc:
            return ProviderResult("claude", model, None, fallback=True, error=f"Claude indisponível: {exc}")
        content = self._extract_claude_text(response)
        return ProviderResult("claude", model, content or None, fallback=not bool(content))

    def _generate_openai(self, agent: Agent, prompt: str) -> ProviderResult:
        api_key = self._env_value("CODEX_API_KEY") or self._env_value("OPENAI_API_KEY")
        model = self._model(agent, self._env_value("CODEX_MODEL") or self._env_value("OPENAI_MODEL") or "gpt-4o")
        provider_id = (agent.provider_id or "codex").lower()
        if not api_key:
            return ProviderResult(provider_id, model, None, fallback=True, error="OPENAI_API_KEY ou CODEX_API_KEY não configurada.")
        base_url = self._env_value("CODEX_BASE_URL") or self._env_value("OPENAI_BASE_URL") or "https://api.openai.com/v1"
        payload = {"model": model, "input": prompt}
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
        try:
            response = self._post_json(f"{base_url.rstrip('/')}/responses", payload, headers, self.timeout)
        except Exception:
            # Fallback to chat completions endpoint
            try:
                chat_payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                }
                response = self._post_json(f"{base_url.rstrip('/')}/chat/completions", chat_payload, headers, self.timeout)
            except Exception as exc:
                return ProviderResult(provider_id, model, None, fallback=True, error=f"OpenAI/Codex indisponível: {exc}")
        content = self._extract_openai_text(response)
        return ProviderResult(provider_id, model, content or None, fallback=not bool(content))

    def _model(self, agent: Agent, default: str) -> str:
        configured = agent.model_config.get("model") if isinstance(agent.model_config, dict) else None
        return str(configured or default)

    def _env_value(self, key: str) -> Optional[str]:
        source = self._env if self._env is not None else os.environ
        value = source.get(key)
        return value.strip() if isinstance(value, str) and value.strip() else None

    @staticmethod
    def _extract_claude_text(payload: dict[str, Any]) -> str:
        parts: list[str] = []
        for block in payload.get("content") or []:
            if isinstance(block, dict) and block.get("type") == "text":
                text = str(block.get("text") or "").strip()
                if text:
                    parts.append(text)
        return "\n".join(parts).strip()

    @staticmethod
    def _extract_openai_text(payload: dict[str, Any]) -> str:
        output_text = str(payload.get("output_text") or "").strip()
        if output_text:
            return output_text
        # Standard Chat Completions choices
        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                msg = first.get("message")
                if isinstance(msg, dict) and msg.get("content"):
                    return str(msg["content"]).strip()
                if first.get("text"):
                    return str(first["text"]).strip()
        parts: list[str] = []
        for item in payload.get("output") or []:
            if not isinstance(item, dict):
                continue
            for block in item.get("content") or []:
                if isinstance(block, dict) and block.get("type") in {"output_text", "text"}:
                    text_value = block.get("text")
                    if isinstance(text_value, dict):
                        text_value = text_value.get("value")
                    text = str(text_value or "").strip()
                    if text:
                        parts.append(text)
        return "\n".join(parts).strip()

    @staticmethod
    def _default_post_json(url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float) -> dict[str, Any]:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, dict) else {}
