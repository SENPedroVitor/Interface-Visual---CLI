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
from ..security.credentials import CredentialStore, CredentialStoreError, get_default_credential_store


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
        credential_store: Optional[CredentialStore] = None,
    ) -> None:
        self.timeout = timeout
        self._post_json = post_json or self._default_post_json
        self._env = env
        self._credential_store = credential_store

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
        if provider_id in {"claude", "anthropic"}:
            return self._generate_claude(agent, prompt)
        if provider_id in {"codex", "openai"}:
            return self._generate_openai(agent, prompt)
        # Custom providers use the OpenAI-compatible response shape when a
        # base URL is supplied in the agent model settings.
        if (isinstance(agent.model_config, dict) and agent.model_config.get("base_url")) or self._stored_config(provider_id).get("base_url"):
            return self._generate_openai(agent, prompt, compatible=True)
        return ProviderResult(
            provider_id=provider_id,
            model=None,
            content=None,
            fallback=True,
            error=f"Provider {provider_id} ainda não possui adaptador.",
        )

    def _generate_ollama(self, agent: Agent, prompt: str) -> ProviderResult:
        stored_config = self._stored_config("ollama")
        model = self._model(agent, stored_config.get("model") or "qwen2.5:0.5b")
        base_url = (
            self._env_value("OLLAMA_BASE_URL")
            or self._env_value("OLLAMA_HOST")
            or stored_config.get("base_url")
            or "http://127.0.0.1:11434"
        )
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
        provider_id = (agent.provider_id or "claude").lower()
        api_key = self._api_key("ANTHROPIC_API_KEY", provider_id=provider_id)
        if not api_key and provider_id == "anthropic":
            api_key = self._api_key(provider_id="claude")
        stored_config = self._stored_config(provider_id)
        if not stored_config and provider_id == "anthropic":
            stored_config = self._stored_config("claude")
        model = self._model(agent, self._env_value("ANTHROPIC_MODEL") or stored_config.get("model") or "claude-sonnet-5")
        if not api_key:
            return ProviderResult(provider_id, model, None, fallback=True, error="ANTHROPIC_API_KEY não configurada.")
        base_url = self._env_value("ANTHROPIC_BASE_URL") or stored_config.get("base_url") or "https://api.anthropic.com/v1"
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
            return ProviderResult(provider_id, model, None, fallback=True, error=f"Claude indisponível: {exc}")
        content = self._extract_claude_text(response)
        return ProviderResult(provider_id, model, content or None, fallback=not bool(content))

    def _generate_openai(self, agent: Agent, prompt: str, *, compatible: bool = False) -> ProviderResult:
        provider_id = (agent.provider_id or "codex").lower()
        key_names = ("CODEX_API_KEY", "OPENAI_API_KEY") if provider_id in {"codex", "openai"} else ()
        api_key = self._api_key(*key_names, provider_id=provider_id)
        stored_config = self._stored_config(provider_id)
        configured_model = None if compatible else (self._env_value("CODEX_MODEL") or self._env_value("OPENAI_MODEL"))
        if compatible:
            configured_model = configured_model or self._env_value(f"{provider_id.upper()}_MODEL")
        model = self._model(agent, configured_model or stored_config.get("model") or ("gpt-4o" if not compatible else ""))
        if not api_key:
            return ProviderResult(provider_id, model or None, None, fallback=True, error="API key não configurada para este provedor.")
        model_config = agent.model_config if isinstance(agent.model_config, dict) else {}
        base_url = (
            model_config.get("base_url")
            if compatible
            else self._env_value("CODEX_BASE_URL") or self._env_value("OPENAI_BASE_URL")
        )
        base_url = base_url or stored_config.get("base_url")
        if not base_url:
            base_url = "https://api.openai.com/v1"
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

    def _api_key(self, *env_names: str, provider_id: str) -> Optional[str]:
        for name in env_names:
            value = self._env_value(name)
            if value:
                return value
        # Tests that provide an explicit env mapping are intentionally isolated
        # from the user's persisted credential vault.
        if self._env is not None:
            return None
        try:
            store = self._credential_store or get_default_credential_store()
            for candidate in self._credential_aliases(provider_id):
                secret = store.get_secret(candidate)
                if secret:
                    return secret
            return None
        except (CredentialStoreError, ValueError):
            return None

    def _stored_config(self, provider_id: str) -> dict[str, str]:
        if self._env is not None:
            return {}
        try:
            store = self._credential_store or get_default_credential_store()
            for candidate in self._credential_aliases(provider_id):
                config = store.get_config(candidate)
                if config:
                    return config
            return {}
        except (CredentialStoreError, ValueError):
            return {}

    @staticmethod
    def _credential_aliases(provider_id: str) -> tuple[str, ...]:
        provider = (provider_id or "").strip().lower()
        aliases = {
            "openai": ("openai", "codex"),
            "codex": ("codex", "openai"),
            "claude": ("claude", "anthropic"),
            "anthropic": ("anthropic", "claude"),
        }
        return aliases.get(provider, (provider,))

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
