import asyncio
import unittest
from unittest.mock import patch

from waddle.tools.laya_decisions import LayaUnavailableError, laya_decision, register_laya_tools
from waddle.tools.registry import ToolRegistry
from waddle.context.tool_context import build_tool_context


class FakeRouter:
    def __init__(self, **kwargs):
        self.kwargs = kwargs

    def predict(self, state, questions):
        return {"answers": {"kind": "choice"}, "routing": {"queue": "review"}}


class TestLayaDecisions(unittest.TestCase):
    def test_mock_classification_returns_answers_and_routing(self):
        with patch("waddle.tools.laya_decisions._get_router", return_value=FakeRouter(max_loaded=1)):
            result = asyncio.run(laya_decision(
                {"text": "classify this"},
                {"kind": {"type": "choice", "instructions": "Which queue?", "criteria": {"review": "needs review", "skip": "no review"}}},
            ))
        self.assertEqual(result["answers"]["kind"], "choice")
        self.assertEqual(result["routing"]["queue"], "review")
        self.assertEqual(result["source"], "laya")

    def test_registry_exposes_laya_without_loading_it(self):
        registry = ToolRegistry()
        register_laya_tools(registry)
        self.assertIsNotNone(registry.get_tool("laya_decision"))
        context = build_tool_context(registry, budget_chars=300)
        self.assertIn('questions:{id:{type:"choice"', context)
        self.assertIn('criteria:{sim:"...",nao:"..."}', context)

    def test_small_budget_keeps_core_tools_and_laya(self):
        from waddle.runtime.agent_runtime import AgentRuntime

        registry = AgentRuntime().tool_registry
        compact = build_tool_context(registry, budget_chars=300)
        self.assertIn('list_directory', compact)
        self.assertIn('laya_decision', compact)
        self.assertLessEqual(len(compact), 300)

        medium = build_tool_context(registry, budget_chars=400)
        self.assertIn('run_command', medium)
        self.assertIn('laya_decision', medium)
        self.assertLessEqual(len(medium), 400)

    def test_registry_executes_laya_classification(self):
        registry = ToolRegistry()
        register_laya_tools(registry)
        with patch("waddle.tools.laya_decisions._get_router", return_value=FakeRouter(max_loaded=1)):
            result = asyncio.run(registry.execute("laya_decision", {
                "state": {"message": "Revise este código"},
                "questions": {"kind": {"type": "choice", "instructions": "Qual fila?", "criteria": {"review": "revisão", "skip": "ignorar"}}},
            }))
        self.assertTrue(result.success)
        self.assertEqual(result.result["source"], "laya")

    def test_missing_laya_is_clear(self):
        with patch("waddle.tools.laya_decisions._get_router", side_effect=LayaUnavailableError("Laya está indisponível")):
            with self.assertRaisesRegex(LayaUnavailableError, "indisponível"):
                asyncio.run(laya_decision({"text": "x"}, {"kind": {"type": "noul", "instructions": "Is it urgent?"}}))

    def test_questions_must_be_named_object(self):
        with self.assertRaises(ValueError):
            asyncio.run(laya_decision({"text": "x"}, []))

    def test_invalid_question_is_rejected_before_loading_model(self):
        with patch("waddle.tools.laya_decisions._get_router") as get_router:
            with self.assertRaises(ValueError):
                asyncio.run(laya_decision({"text": "x"}, {"kind": {"type": "choice"}}))
        get_router.assert_not_called()


if __name__ == "__main__":
    unittest.main()
