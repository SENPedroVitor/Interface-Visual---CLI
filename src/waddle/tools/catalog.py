"""Local Faux Catálogo integration for the Mosbey specialist."""
from __future__ import annotations

import json
import os
from typing import Any, Optional
from urllib.parse import urlparse
import urllib.request

from .registry import Permission, RiskLevel, Tool, ToolRegistry


DEFAULT_FAUX_CATALOGO_URL = "http://127.0.0.1:4173"


def _catalog_base_url() -> str:
    value = (os.getenv("FAUX_CATALOGO_URL") or DEFAULT_FAUX_CATALOGO_URL).strip().rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("FAUX_CATALOGO_URL deve ser uma URL HTTP(S) válida, sem credenciais.")
    return value


def catalog_add_movie(
    title: str,
    year: Optional[int] = None,
    creator: str = "",
    notes: str = "",
    status: str = "para assistir",
) -> dict[str, Any]:
    """Adiciona um filme ao endpoint local do Faux Catálogo."""
    clean_title = str(title or "").strip()
    if not clean_title or len(clean_title) > 240:
        raise ValueError("Informe um título de filme entre 1 e 240 caracteres.")
    payload: dict[str, Any] = {
        "category": "filmes",
        "title": clean_title,
        "year": year,
        "creator": str(creator or "").strip(),
        "status": str(status or "para assistir").strip(),
        "notes": str(notes or "").strip(),
        "tags": ["filme", "cinema", "waddle"],
    }
    endpoint = f"{_catalog_base_url()}/api/items"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8", errors="replace")
            data = json.loads(raw) if raw else {}
            status_code = getattr(response, "status", 200)
    except Exception as exc:
        raise RuntimeError(f"Não foi possível acessar o Faux Catálogo em {endpoint}: {exc}") from exc
    if status_code >= 400:
        detail = data.get("error") if isinstance(data, dict) else None
        raise RuntimeError(detail or f"Faux Catálogo respondeu HTTP {status_code}.")
    return {"success": True, "source": "Faux Catálogo", "endpoint": endpoint, **(data if isinstance(data, dict) else {})}


def register_catalog_tools(registry: ToolRegistry) -> None:
    registry.register(
        Tool(
            name="catalog_add_movie",
            description="Adiciona um filme ao catálogo local Faux Catálogo (projeto configurado em FAUX_CATALOGO_URL).",
            handler=catalog_add_movie,
            input_schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Título do filme"},
                    "year": {"type": ["integer", "null"], "description": "Ano opcional"},
                    "creator": {"type": "string", "description": "Diretor ou criador opcional"},
                    "notes": {"type": "string", "description": "Observações opcionais"},
                    "status": {"type": "string", "description": "Status no catálogo"},
                },
                "required": ["title"],
            },
            risk_level=RiskLevel.MEDIUM,
            permission=Permission.ALLOW,
        )
    )
