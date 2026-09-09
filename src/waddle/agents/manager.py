"""Manager Agent implementation for Waddle Agent OS."""
from __future__ import annotations

import json
from typing import Any, Callable, Optional
from urllib import request
from .base import Agent, AgentStatus
from ..tasks.task import Task
from ..tasks.manager import TaskManager
from ..core.event_bus import EventBus
from ..tools.registry import ToolRegistry


def _extract_ticker_from_text(text: str, default: str = "PETR4") -> str:
    import re
    # 1. Standard B3 tickers (4 letters + 1-2 digits: PETR4, MXRF11, VALE3)
    m = re.search(r"\b([A-Za-z]{4}\d{1,2})\b", text)
    if m:
        return m.group(1).upper()
    
    known = {
        "IBOV": "^BVSP", "IBOVESPA": "^BVSP", "DOLAR": "USDBRL=X", "DÓLAR": "USDBRL=X",
        "SP500": "^GSPC", "S&P500": "^GSPC", "BITCOIN": "BTC-USD", "BTC": "BTC-USD",
        "AAPL": "AAPL", "NVDA": "NVDA", "TSLA": "TSLA", "MSFT": "MSFT", "AMZN": "AMZN",
        "PETR4": "PETR4", "VALE3": "VALE3", "MXRF11": "MXRF11", "HGLG11": "HGLG11",
        "XPML11": "XPML11", "ITUB4": "ITUB4", "BBDC4": "BBDC4", "BBAS3": "BBAS3", "WEGE3": "WEGE3"
    }
    stop_words = {
        "COMPRA", "COMPRAR", "VENDA", "VENDER", "COTAS", "COTA", "ACOES", "AÇÕES",
        "ACAO", "AÇÃO", "DE", "EM", "PARA", "NO", "NA", "QUAL", "COMO", "ESTA",
        "ESTÁ", "PRECO", "PREÇO", "MINHA", "MEU", "SALDO", "CARTEIRA", "HOJE"
    }
    tokens = [w.strip(".,!?:;\"'()").upper() for w in text.split()]
    for token in tokens:
        if token in known:
            return token
    for token in tokens:
        if token not in stop_words and (re.match(r"^[A-Z]{3,5}$", token) or re.match(r"^[A-Z]{4}\d{1,2}$", token)):
            return token
    return default


class ManagerAgent(Agent):
    def __init__(
        self,
        task_manager: TaskManager,
        name: str = "Quinta",
        role: str = "Manager",
        description: str = "Coordenação da equipe, planejamento e consolidação de resultados.",
        provider_id: str = "ollama",
        event_bus: Optional[EventBus] = None,
        tool_registry: Optional[ToolRegistry] = None,
    ) -> None:
        super().__init__(
            name=name,
            role=role,
            description=description,
            provider_id=provider_id,
            event_bus=event_bus,
            tool_registry=tool_registry,
        )
        self.task_manager = task_manager
        self.collaborators: dict[str, Agent] = {}
        self.llm_generate: Optional[Callable[[Agent, str], Optional[str]]] = None

    def _ollama_answer(self, speaker: Agent, objective: str) -> Optional[str]:
        if self.llm_generate:
            return self.llm_generate(speaker, objective)
        no_api_keys = self._requires_no_api_keys(objective)
        prompt = (
            f"Você é {speaker.name}, um agente do Waddle Agent OS. "
            f"Função: {speaker.role}. Responsabilidade: {speaker.description}. "
            "Seu motor atual é Ollama com o modelo qwen2.5:0.5b. "
            "Não invente outro nome de produto, empresa, app ou motor. "
            + (
                "O usuário pediu uma solução SEM API keys: não sugira APIs pagas, nuvem obrigatória ou chaves externas. "
                if no_api_keys else ""
            )
            +
            "Responda em português do Brasil, de forma útil e curta, como um agente colaborando com o usuário.\n\n"
            f"Usuário: {objective}"
        )
        body = json.dumps({
            "model": "qwen2.5:0.5b",
            "prompt": prompt,
            "stream": False,
            "options": {"num_predict": 180},
        }).encode("utf-8")
        try:
            req = request.Request(
                "http://127.0.0.1:11434/api/generate",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with request.urlopen(req, timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception:
            return None
        answer = str(payload.get("response", "")).strip()
        return answer or None

    @staticmethod
    def _requires_no_api_keys(text: str) -> bool:
        normalized = text.lower()
        return (
            "sem api" in normalized
            or "sem chave" in normalized
            or "sem keys" in normalized
            or "without api" in normalized
            or "no api key" in normalized
        )

    def _fallback_team_summary(self, objective: str, opinions: list[dict[str, str]]) -> str:
        if self._requires_no_api_keys(objective):
            return (
                "Fechou: dá pra deixar o projeto funcional sem API keys usando o Ollama como motor local agora. "
                "A Quinta coordena a conversa, o Atlas contribui com análise local, e Nero/Iris já ficam reservados "
                "para Codex e Claude Code quando você autenticar essas ferramentas. Próximo passo bom: criar uma tela "
                "simples para escolher o motor de cada agente e mostrar quando ele está rodando localmente."
            )
        if opinions:
            highlights = "; ".join(
                f"{opinion['agent']}: {opinion['content']}" for opinion in opinions[:3]
            )
            return f"Conversei com a equipe e consolidei assim: {highlights}"
        return ""

    def _fallback_agent_opinion(self, agent: Agent, objective: str) -> str:
        if self._requires_no_api_keys(objective):
            if agent.name == "Atlas":
                return "Eu mapearia o que já existe localmente: status do Ollama, agentes ativos, histórico e ferramentas disponíveis, mantendo o fluxo offline."
            if agent.name == "Nero":
                return "Eu implementaria em fatias pequenas: endpoint de motores, seletor por agente e uma rodada de discussão local testável antes de qualquer integração online."
            if agent.name == "Iris":
                return "Eu validaria se cada agente deixa claro qual motor usa e se o app continua útil offline, com testes cobrindo o fluxo sem chaves externas."
            if agent.name == "Ma":
                return "Posso consultar cotações reais da B3, avaliar indicadores como RSI e médias móveis, e simular trades na carteira sem precisar de chaves pagas."
        if agent.name == "Ma":
            return "Estou acompanhando as cotações da B3, Ibovespa e ativos de valor para apoiar a estratégia da equipe."
        if agent.provider_id == "codex":
            return "Posso assumir a parte de implementação quando o Codex estiver autenticado; por enquanto recomendo uma tarefa pequena, testável e com diff claro."
        if agent.provider_id == "claude":
            return "Posso revisar arquitetura, riscos e qualidade quando o Claude Code estiver autenticado; por enquanto eu bloquearia mudanças sem teste."
        return "Tenho contexto do meu papel, mas meu motor ainda não respondeu localmente."

    async def discuss_with_team(self, objective: str) -> list[dict[str, str]]:
        """Ask the local team for short role-based opinions and surface them in Quinta's thread."""
        is_financial = any(
            w in objective.lower()
            for w in [
                "bolsa", "ação", "ações", "acoes", "fii", "invest", "mercado",
                "cotação", "cotacao", "carteira", "lucro", "dividendo", "ibov",
                "dólar", "dolar"
            ]
        )
        allowed = {"Atlas", "Nero", "Iris", "Ma"} if is_financial else {"Atlas", "Nero", "Iris"}
        participants = [
            agent for name, agent in self.collaborators.items()
            if name in allowed
        ]
        opinions: list[dict[str, str]] = []
        for agent in participants:
            await agent.set_status(AgentStatus.THINKING)
            prompt = (
                f"O usuário pediu: {objective}\n"
                f"Como {agent.name}, contribua com uma opinião curta focada na sua função ({agent.role}). "
                "Não conclua sozinho; ajude a Quinta a decidir."
            )
            answer = None if self._requires_no_api_keys(objective) else self._ollama_answer(agent, prompt) if agent.provider_id == "ollama" else None
            if not answer:
                answer = self._fallback_agent_opinion(agent, objective)
            await agent.send_message(
                to_agent="Quinta",
                msg_type="discussion",
                content=answer,
                data={"conversation_agent": "quinta", "provider_id": agent.provider_id},
            )
            opinions.append({"agent": agent.name, "role": agent.role, "content": answer})
            await agent.set_status(AgentStatus.IDLE)
        return opinions

    async def plan_objective(self, objective: str, parameters: Optional[dict[str, Any]] = None, response_agent: Optional[Agent] = None) -> list[Task]:
        """Decompose a high-level user objective into executable tasks for the team."""
        speaker = response_agent or self
        await speaker.set_status(AgentStatus.THINKING)
        await speaker.send_message(
            to_agent="System",
            msg_type="status_update",
            content=f"Analisando objetivo e coordenando a equipe: '{objective}'",
        )

        params = parameters or {}
        tasks_created: list[Task] = []
        obj_lower = objective.lower()

        is_ma_target = speaker.name == "Ma" or params.get("_assigned_agent") == "Ma"
        fin_keywords = [
            "cotação", "cotacao", "bolsa", "ação", "acoes", "ações",
            "fii", "fiis", "dividendo", "dividendos", "ibov", "ibovespa",
            "carteira", "investimento", "investimentos", "dolar", "dólar",
            "rsi", "petr4", "vale3", "mxrf11", "itub4", "wege3", "bbas3"
        ]
        has_fin = any(w in obj_lower for w in fin_keywords)

        if is_ma_target or has_fin:
            assigned = "Ma"
            # 1. Trade
            if any(op in obj_lower for op in ["comprar", "compra", "vender", "venda"]):
                import re
                m_shares = re.search(r"(\d+)\s*(?:ações|acoes|cotas|unidades)?", obj_lower)
                shares = float(m_shares.group(1)) if m_shares else 10.0
                ticker = _extract_ticker_from_text(objective, default="PETR4")
                op = "venda" if "vend" in obj_lower else "compra"
                task = await self.task_manager.create_task(
                    title=f"Registrar trade: {op.upper()} {int(shares)} {ticker}",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={
                        "tool_calls": [
                            {
                                "tool": "stock_portfolio_record_trade",
                                "params": {"ticker": ticker, "operation": op, "shares": shares},
                            }
                        ]
                    },
                )
                tasks_created.append(task)
            # 2. Portfolio view
            elif any(w in obj_lower for w in ["carteira", "saldo", "patrimônio", "patrimonio", "posições", "posicoes"]):
                task = await self.task_manager.create_task(
                    title="Consultar carteira de investimentos",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={
                        "tool_calls": [
                            {"tool": "stock_portfolio_view", "params": {}}
                        ]
                    },
                )
                tasks_created.append(task)
            # 3. Market overview
            elif any(w in obj_lower for w in ["mercado", "ibov", "visão", "resumo", "panorâmica", "dólar", "dolar"]) and not any(t in obj_lower for t in ["petr4", "vale3", "mxrf11", "itub4", "wege3"]):
                task = await self.task_manager.create_task(
                    title="Consultar visão geral do mercado",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={
                        "tool_calls": [
                            {"tool": "stock_market_overview", "params": {}}
                        ]
                    },
                )
                tasks_created.append(task)
            # 4. Technical analysis
            elif any(w in obj_lower for w in ["indicador", "indicadores", "rsi", "média", "media", "técnica", "tecnica"]):
                ticker = _extract_ticker_from_text(objective, default="PETR4")
                task = await self.task_manager.create_task(
                    title=f"Indicadores técnicos de {ticker}",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={
                        "tool_calls": [
                            {"tool": "stock_get_technicals", "params": {"ticker": ticker}}
                        ]
                    },
                )
                tasks_created.append(task)
            # 5. Stock quote
            else:
                import re
                matches = re.findall(r"\b([A-Za-z]{4}\d{1,2})\b", objective)
                if not matches:
                    sym = _extract_ticker_from_text(objective, default="PETR4")
                    matches = [sym]
                for sym in matches[:2]:
                    tools = [{"tool": "stock_get_quote", "params": {"ticker": sym}}]
                    if "analis" in obj_lower or "indicador" in obj_lower or "fii" in obj_lower:
                        tools.append({"tool": "stock_get_technicals", "params": {"ticker": sym}})
                    task = await self.task_manager.create_task(
                        title=f"Cotação e dados de {sym}",
                        description=objective,
                        assigned_agent=assigned,
                        input_data={"tool_calls": tools},
                    )
                    tasks_created.append(task)
        elif "arquivo" in objective.lower() or "file" in objective.lower() or "salvar" in objective.lower():
            # Step 1: Nero writes the file
            task1 = await self.task_manager.create_task(
                title=f"Criar arquivo: {objective[:32]}",
                description=objective,
                assigned_agent=params.get('_assigned_agent', 'Nero'),
                input_data={
                    "tool_calls": [
                        {
                            "tool": "write_file",
                            "params": {
                                "path": params.get("path", "waddle_result.txt"),
                                "content": params.get("content", f"Gerado pelo Waddle Agent OS:\nObjetivo: {objective}\n"),
                            },
                        }
                    ]
                },
            )
            tasks_created.append(task1)

            # Step 2: Iris reviews/verifies file
            task2 = await self.task_manager.create_task(
                title=f"Revisar e verificar arquivo",
                description="Validar integridade do arquivo gerado.",
                assigned_agent="Iris",
                dependencies=[task1.id],
                input_data={
                    "tool_calls": [
                        {
                            "tool": "read_file",
                            "params": {"path": params.get("path", "waddle_result.txt")},
                        }
                    ]
                },
            )
            tasks_created.append(task2)
        elif "pesquis" in objective.lower() or "analis" in objective.lower() or "research" in objective.lower():
            # Atlas investigates
            task = await self.task_manager.create_task(
                title=f"Pesquisar e analisar: {objective[:35]}",
                description=objective,
                assigned_agent=params.get('_assigned_agent', 'Atlas'),
                input_data={
                    "tool_calls": [
                        {
                            "tool": "list_directory",
                            "params": {"path": params.get("path", ".")},
                        }
                    ]
                },
            )
            tasks_created.append(task)
        elif "comando" in objective.lower() or "executar" in objective.lower() or "shell" in objective.lower() or "run" in objective.lower():
            cmd = params.get("command", "echo Waddle Agent OS Running")
            task = await self.task_manager.create_task(
                title=f"Executar comando: {cmd[:30]}",
                description=objective,
                assigned_agent=params.get('_assigned_agent', 'Nero'),
                input_data={
                    "tool_calls": [
                        {
                            "tool": "run_command",
                            "params": {"command": cmd},
                        }
                    ]
                },
            )
            tasks_created.append(task)
        else:
            # No task-shaped keyword matched — this reads as a plain
            # question/chat message, so the selected agent replies directly
            # instead of spawning a worker task with nothing concrete to execute.
            opinions = []
            if speaker is self:
                await speaker.send_message(
                    to_agent="System",
                    msg_type="status_update",
                    content="Chamando Atlas, Nero e Iris para uma rodada curta de discussão local.",
                )
                opinions = await self.discuss_with_team(objective)
            context = ""
            if opinions:
                context = "\n\nOpiniões da equipe:\n" + "\n".join(
                    f"- {opinion['agent']} ({opinion['role']}): {opinion['content']}" for opinion in opinions
                )
            llm_answer = self._ollama_answer(speaker, objective + context) if speaker.provider_id == "ollama" else None
            if self._requires_no_api_keys(objective) and self.llm_generate is None:
                llm_answer = self._fallback_team_summary(objective, opinions)
            elif not llm_answer:
                llm_answer = self._fallback_team_summary(objective, opinions) or None
            await speaker.send_message(
                to_agent="System",
                msg_type="answer",
                content=llm_answer or f'Recebi sua mensagem: "{objective}". O motor {speaker.provider_id} está conectado, mas ainda não executei uma sessão de trabalho completa por ele.',
                data={"conversation_agent": speaker.name.lower(), "provider_id": speaker.provider_id, "model": "qwen2.5:0.5b" if llm_answer else None, "opinions": opinions},
            )

        if tasks_created:
            await speaker.send_message(
                to_agent="System",
                msg_type="status_update",
                content=f"Plano pronto: {len(tasks_created)} etapas para executar.",
            )
        await speaker.set_status(AgentStatus.IDLE)
        return tasks_created

    async def execute_task(self, task: Task) -> Any:
        # If the manager itself is assigned a task (e.g. consolidation)
        self.current_task_id = task.id
        await self.set_status(AgentStatus.WORKING)
        try:
            return {"status": "completed", "manager": "Objective reviewed and consolidated."}
        finally:
            self.current_task_id = None
            await self.set_status(AgentStatus.IDLE)
