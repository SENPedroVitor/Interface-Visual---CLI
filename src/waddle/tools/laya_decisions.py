"""Optional, local Laya decision classification.

Laya is intentionally kept out of Waddle's startup path.  The package pulls
large ML dependencies and may need to load model weights, so importing and
constructing its router only happens when this tool is actually invoked.
"""
from __future__ import annotations

import asyncio
import json
import threading
from functools import lru_cache
from typing import Any

from .registry import Permission, RiskLevel, Tool, ToolRegistry


MAX_INPUT_BYTES = 16_384
MAX_STATE_KEYS = 64
MAX_QUESTIONS = 32
_QUESTION_TYPES = {"choice", "score", "noul"}
_model_lock = threading.Lock()


class LayaUnavailableError(RuntimeError):
    """Raised when the optional Laya dependency cannot be used locally."""


def _validate_input(state: Any, questions: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    if not isinstance(state, dict):
        raise ValueError("Laya state deve ser um objeto JSON.")
    if len(state) > MAX_STATE_KEYS:
        raise ValueError(f"Laya state aceita no máximo {MAX_STATE_KEYS} campos.")
    if not isinstance(questions, dict) or not questions:
        raise ValueError("Laya questions deve ser um objeto nomeado não vazio.")
    if len(questions) > MAX_QUESTIONS:
        raise ValueError(f"Laya questions aceita no máximo {MAX_QUESTIONS} itens.")
    for question_id, question in questions.items():
        if not isinstance(question_id, str) or not question_id.strip() or len(question_id) > 64:
            raise ValueError("Cada identificador de pergunta Laya deve ter entre 1 e 64 caracteres.")
        if not isinstance(question, dict):
            raise ValueError("Cada pergunta Laya deve ser um objeto JSON.")
        question_type = question.get("type")
        if question_type not in _QUESTION_TYPES:
            raise ValueError("Tipo de pergunta Laya deve ser choice, score ou noul.")
        instructions = question.get("instructions")
        if not isinstance(instructions, str) or not instructions.strip():
            raise ValueError("Cada pergunta Laya precisa de instruções não vazias.")
        criteria = question.get("criteria")
        if question_type == "choice" and not (
            isinstance(criteria, (dict, list)) and 2 <= len(criteria) <= 20
        ):
            raise ValueError("Pergunta choice precisa de 2 a 20 opções em criteria.")
        if question_type == "score" and not (
            isinstance(criteria, list) and 2 <= len(criteria) <= 10
        ):
            raise ValueError("Pergunta score precisa de 2 a 10 níveis em criteria.")
    try:
        payload_size = len(json.dumps({"state": state, "questions": questions}, ensure_ascii=False).encode("utf-8"))
    except (TypeError, ValueError) as exc:
        raise ValueError("Laya aceita somente valores JSON serializáveis.") from exc
    if payload_size > MAX_INPUT_BYTES:
        raise ValueError(f"Entrada Laya excede o limite de {MAX_INPUT_BYTES} bytes.")
    return state, questions


@lru_cache(maxsize=1)
def _get_router() -> Any:
    try:
        from laya import Router  # type: ignore[import-not-found]
    except (ImportError, ModuleNotFoundError) as exc:
        raise LayaUnavailableError(
            "Laya está indisponível. Instale a dependência opcional com `pip install -e '.[laya]'` "
            "e configure os pesos locais antes de usar esta ferramenta."
        ) from exc
    try:
        return Router(max_loaded=1)
    except Exception as exc:
        raise LayaUnavailableError("Laya não conseguiu carregar o roteador local; verifique os pesos configurados.") from exc


def _predict(state: dict[str, Any], questions: dict[str, Any]) -> dict[str, Any]:
    # Router mutates its model cache while loading and evicting checkpoints.
    # Keep a single resident model and serialize concurrent inference calls.
    with _model_lock:
        router = _get_router()
        try:
            prediction = router.predict(state, questions)
        except Exception as exc:
            raise RuntimeError("Laya falhou ao classificar a entrada localmente.") from exc
    if not isinstance(prediction, dict):
        raise RuntimeError("Laya retornou um resultado inválido; esperado um objeto JSON.")
    return {
        "answers": prediction.get("answers", {}),
        "routing": prediction.get("routing", {}),
        "source": "laya",
    }


async def laya_decision(state: dict[str, Any], questions: dict[str, Any]) -> dict[str, Any]:
    """Classify with Laya off the API event loop; never execute the selected route."""
    state, questions = _validate_input(state, questions)
    return await asyncio.to_thread(_predict, state, questions)


def register_laya_tools(registry: ToolRegistry) -> None:
    registry.register(
        Tool(
            name="laya_decision",
            description="Classifica e faz triagem local com Laya (choice, score ou noul), sem executar a rota escolhida.",
            handler=laya_decision,
            input_schema={
                "type": "object",
                "properties": {
                    "state": {"type": "object", "description": "Estado JSON pequeno para classificação."},
                    "questions": {"type": "object", "description": "Perguntas de triagem Laya nomeadas por identificador."},
                },
                "required": ["state", "questions"],
                "additionalProperties": False,
            },
            output_schema={
                "type": "object",
                "properties": {"answers": {"type": "object"}, "routing": {"type": "object"}, "source": {"type": "string"}},
            },
            risk_level=RiskLevel.LOW,
            permission=Permission.ALLOW,
        )
    )


__all__ = ["LayaUnavailableError", "laya_decision", "register_laya_tools"]
