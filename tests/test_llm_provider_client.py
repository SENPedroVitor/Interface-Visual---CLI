import unittest

from waddle.agents.worker import WorkerAgent
from waddle.llm.provider_client import LLMProviderClient


class TestLLMProviderClient(unittest.TestCase):
    def test_ollama_uses_agent_model_config_and_parses_response(self):
        calls = []

        def post_json(url, payload, headers, timeout):
            calls.append((url, payload, headers, timeout))
            return {"response": "Resposta local"}

        agent = WorkerAgent(
            "Atlas",
            "Research",
            provider_id="ollama",
            model_config={"model": "llama3.2:1b"},
        )
        client = LLMProviderClient(post_json=post_json, env={})

        result = client.generate(agent, "Explique o plano.")

        self.assertEqual(result.content, "Resposta local")
        self.assertFalse(result.fallback)
        self.assertEqual(result.model, "llama3.2:1b")
        self.assertEqual(calls[0][0], "http://127.0.0.1:11434/api/generate")
        self.assertEqual(calls[0][1]["model"], "llama3.2:1b")
        self.assertFalse(calls[0][1]["stream"])

    def test_claude_without_api_key_stays_in_fallback(self):
        def post_json(url, payload, headers, timeout):
            raise AssertionError("Claude should not call the network without ANTHROPIC_API_KEY")

        agent = WorkerAgent("Iris", "Reviewer", provider_id="claude")
        client = LLMProviderClient(post_json=post_json, env={})

        result = client.generate(agent, "Revise.")

        self.assertIsNone(result.content)
        self.assertTrue(result.fallback)
        self.assertIn("ANTHROPIC_API_KEY", result.error)

    def test_claude_with_api_key_parses_text_block_response(self):
        calls = []

        def post_json(url, payload, headers, timeout):
            calls.append((url, payload, headers, timeout))
            return {"content": [{"type": "text", "text": "Parecer da Iris"}]}

        agent = WorkerAgent(
            "Iris",
            "Reviewer",
            provider_id="claude",
            model_config={"model": "claude-haiku-4.5"},
        )
        client = LLMProviderClient(post_json=post_json, env={"ANTHROPIC_API_KEY": "test-key"})

        result = client.generate(agent, "Revise.")

        self.assertEqual(result.content, "Parecer da Iris")
        self.assertEqual(result.model, "claude-haiku-4.5")
        self.assertEqual(calls[0][0], "https://api.anthropic.com/v1/messages")
        self.assertEqual(calls[0][2]["x-api-key"], "test-key")

    def test_codex_provider_uses_openai_responses_api_when_key_exists(self):
        calls = []

        def post_json(url, payload, headers, timeout):
            calls.append((url, payload, headers, timeout))
            return {"output_text": "Plano do Nero"}

        agent = WorkerAgent(
            "Nero",
            "Developer",
            provider_id="codex",
            model_config={"model": "gpt-4o-mini"},
        )
        client = LLMProviderClient(post_json=post_json, env={"OPENAI_API_KEY": "test-key"})

        result = client.generate(agent, "Implemente.")

        self.assertEqual(result.content, "Plano do Nero")
        self.assertEqual(result.provider_id, "codex")
        self.assertEqual(calls[0][0], "https://api.openai.com/v1/responses")
        self.assertEqual(calls[0][1]["model"], "gpt-4o-mini")
        self.assertEqual(calls[0][2]["Authorization"], "Bearer test-key")

    def test_codex_provider_uses_codex_api_key(self):
        calls = []

        def post_json(url, payload, headers, timeout):
            calls.append((url, payload, headers, timeout))
            return {"output_text": "Resposta via CODEX_API_KEY"}

        agent = WorkerAgent("Nero", "Developer", provider_id="codex")
        client = LLMProviderClient(post_json=post_json, env={"CODEX_API_KEY": "codex-secret-key"})

        result = client.generate(agent, "Escreva código.")
        self.assertEqual(result.content, "Resposta via CODEX_API_KEY")
        self.assertEqual(calls[0][2]["Authorization"], "Bearer codex-secret-key")

    def test_codex_provider_falls_back_to_chat_completions_and_parses_choices(self):
        calls = []

        def post_json(url, payload, headers, timeout):
            calls.append((url, payload, headers, timeout))
            if "/responses" in url:
                raise RuntimeError("404 Not Found")
            return {
                "choices": [
                    {
                        "message": {"role": "assistant", "content": "Código gerado via Chat Completions"}
                    }
                ]
            }

        agent = WorkerAgent("Nero", "Developer", provider_id="codex")
        client = LLMProviderClient(post_json=post_json, env={"CODEX_API_KEY": "test-key"})

        result = client.generate(agent, "Gere função.")
        self.assertEqual(result.content, "Código gerado via Chat Completions")
        self.assertFalse(result.fallback)
        self.assertEqual(len(calls), 2)
        self.assertIn("/responses", calls[0][0])
        self.assertIn("/chat/completions", calls[1][0])
        self.assertEqual(calls[1][1]["messages"][0]["content"], "Gere função.")


if __name__ == "__main__":
    unittest.main()

