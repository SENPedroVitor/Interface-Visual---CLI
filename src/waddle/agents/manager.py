"""Manager Agent implementation for Waddle Agent OS."""
from __future__ import annotations

import json
import re
from typing import Any, Callable, Optional
from .base import Agent, AgentStatus
from ..tasks.task import Task
from ..tasks.manager import TaskManager
from ..core.event_bus import EventBus
from ..tools.registry import ToolRegistry
from ..llm.provider_client import LLMProviderClient
from ..context.prompt_builder import PromptBuilder


def _extract_ticker_from_text(text: str, default: str = "PETR4") -> str:
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
        database: Any = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            name=name,
            role=role,
            description=description,
            provider_id=provider_id,
            event_bus=event_bus,
            tool_registry=tool_registry,
            **kwargs,
        )
        self.task_manager = task_manager
        self.collaborators: dict[str, Agent] = {}
        self.llm_generate: Optional[Callable[[Agent, str], Optional[str]]] = None
        self.llm_client = LLMProviderClient()
        self._database = database
        self.skill_registry = kwargs.get("skill_registry")
        self._prompt_builder: Optional[PromptBuilder] = None

    @property
    def prompt_builder(self) -> PromptBuilder:
        """Lazy-init PromptBuilder so tests that don't set database still work."""
        if self._prompt_builder is None:
            self._prompt_builder = PromptBuilder(
                database=self._database,
                tool_registry=self.tool_registry,
                skill_registry=self.skill_registry,
            )
        return self._prompt_builder

    def _ollama_answer(
        self,
        speaker: Agent,
        objective: str,
        *,
        mode: str = "answer",
        team_opinions: Optional[list[dict[str, str]]] = None,
    ) -> Optional[str]:
        """Generate a provider-backed answer using PromptBuilder.

        The method name is kept for compatibility with older tests and call
        sites, but it now routes through the agent's configured provider
        with full context (soul, skills, memory, history).
        """
        if self.llm_generate:
            return self.llm_generate(speaker, objective)
        no_api_keys = self._requires_no_api_keys(objective)
        if no_api_keys and speaker.provider_id != "ollama":
            return None

        # Build a full context-aware prompt
        extra = None
        if no_api_keys:
            extra = "O usuário pediu uma solução SEM API keys: não sugira APIs pagas, nuvem obrigatória ou chaves externas."

        prompt = self.prompt_builder.build(
            agent=speaker,
            objective=objective,
            mode=mode,
            team_opinions=team_opinions,
            extra_context=extra,
        )
        try:
            result = self.llm_client.generate(speaker, prompt, assembled=True)
        except TypeError:
            result = self.llm_client.generate(speaker, prompt)
        return result.content

    @staticmethod
    def _default_model_for(provider_id: str) -> str:
        provider = (provider_id or "ollama").lower()
        if provider == "claude":
            return "claude-sonnet-5"
        if provider in {"codex", "openai"}:
            return "gpt-4o"
        return "qwen2.5:0.5b"

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

    async def discuss_with_team(
        self,
        objective: str,
        *,
        rounds: int = 1,
        with_critique: bool = False,
    ) -> list[dict[str, str]]:
        """Ask the local team for short role-based opinions and surface them in Quinta's thread."""
        fin_word_match = bool(re.search(r"\b(ação|ações|acoes|acao|fii|fiis|rsi)\b", objective, re.IGNORECASE))
        fin_keywords = [
            "bolsa", "invest", "mercado", "cotação", "cotacao",
            "carteira", "lucro", "dividendo", "ibov", "ibovespa", "dólar", "dolar",
            "petr4", "vale3", "mxrf11", "itub4", "wege3", "bbas3",
        ]
        is_financial = fin_word_match or any(w in objective.lower() for w in fin_keywords)
        is_sports = any(
            w in objective.lower()
            for w in [
                "esporte", "esportes", "futebol", "tabela", "classificação", "classificacao",
                "brasileirão", "brasileirao", "rodada", "campeonato", "champions",
                "libertadores", "nba", "basquete", "nfl", "super bowl", "mlb", "beisebol",
                "flamengo", "palmeiras", "corinthians", "são paulo", "sao paulo", "vasco",
                "lakers", "celtics", "chiefs", "49ers", "yankees", "dodgers"
            ]
        )
        if is_sports:
            allowed = {"Atlas", "Nero", "Iris", "Livro"}
        elif is_financial:
            allowed = {"Atlas", "Nero", "Iris", "Ma"}
        else:
            allowed = {"Atlas", "Nero", "Iris"}
        participants = [
            agent for name, agent in self.collaborators.items()
            if name in allowed
        ]
        opinions: list[dict[str, str]] = []
        # Round 1: Initial opinions
        for agent in participants:
            await agent.set_status(AgentStatus.THINKING)
            answer = None
            if not self._requires_no_api_keys(objective):
                try:
                    answer = self._ollama_answer(agent, objective, mode="discussion")
                except TypeError:
                    answer = self._ollama_answer(agent, objective)
            if not answer:
                answer = self._fallback_agent_opinion(agent, objective)
            await agent.send_message(
                to_agent="Quinta",
                msg_type="discussion",
                content=answer,
                data={"conversation_agent": "quinta", "provider_id": agent.provider_id, "round": 1},
            )
            opinions.append({"agent": agent.name, "role": agent.role, "content": answer})
            await agent.set_status(AgentStatus.IDLE)

        # Round 2: Critique and refinement (if requested or rounds > 1)
        if (rounds > 1 or with_critique) and any(p.name == "Iris" for p in participants):
            iris = next(p for p in participants if p.name == "Iris")
            critique_prompt = (
                f"Analise criticamente as propostas anteriores da equipe para o objetivo: '{objective}'. "
                "Identifique riscos técnicos, lacunas e melhorias necessárias."
            )
            await iris.set_status(AgentStatus.THINKING)
            try:
                critique = self._ollama_answer(iris, critique_prompt, mode="discussion", team_opinions=opinions)
            except TypeError:
                critique = self._ollama_answer(iris, critique_prompt)
            if not critique:
                critique = "Revisão da Iris: Proposta viável, recomendando cobertura de testes e validação de erros."
            await iris.send_message(
                to_agent="Quinta",
                msg_type="discussion",
                content=f"[Revisão Crítica] {critique}",
                data={"conversation_agent": "quinta", "provider_id": iris.provider_id, "round": 2},
            )
            opinions.append({"agent": "Iris", "role": "Reviewer", "content": f"[Revisão Crítica] {critique}"})
            await iris.set_status(AgentStatus.IDLE)

            nero = next((p for p in participants if p.name == "Nero"), None)
            if nero:
                refine_prompt = (
                    f"Refine sua proposta técnica para '{objective}' considerando os apontamentos da Iris: {critique}"
                )
                await nero.set_status(AgentStatus.THINKING)
                try:
                    refinement = self._ollama_answer(nero, refine_prompt, mode="discussion", team_opinions=opinions)
                except TypeError:
                    refinement = self._ollama_answer(nero, refine_prompt)
                if not refinement:
                    refinement = "Ajuste do Nero: Proposta técnica ajustada para incorporar validação e resiliência."
                await nero.send_message(
                    to_agent="Quinta",
                    msg_type="discussion",
                    content=f"[Ajuste Técnico] {refinement}",
                    data={"conversation_agent": "quinta", "provider_id": nero.provider_id, "round": 2},
                )
                opinions.append({"agent": "Nero", "role": "Developer", "content": f"[Ajuste Técnico] {refinement}"})
                await nero.set_status(AgentStatus.IDLE)

        return opinions

    @staticmethod
    def _is_plain_message(objective: str) -> bool:
        obj = objective.strip().lower()
        if not obj:
            return True
        if obj in {"olá", "ola", "oi", "hey", "hello", "hi", "bom dia", "boa tarde", "boa noite", "tudo bem"}:
            return True
        if obj.endswith("?") and any(
            obj.startswith(q) for q in [
                "como melhoramos", "como melhorar", "o que você acha", "o que acha",
                "o que podemos", "qual sua opinião", "qual sua opiniao", "quem é você", "quem e voce",
                "o que é", "o que e"
            ]
        ):
            has_fin = bool(re.search(r"\b(ação|ações|acoes|acao|carteira|cotação|cotacao)\b", obj))
            if has_fin or any(s in obj for s in ["brasileirao", "nba", "nfl", "mlb", "futebol", "playoffs", "super bowl"]):
                return False
            return True
        return False

    @staticmethod
    def _parse_tasks_json(text: str) -> list[dict[str, Any]]:
        match = re.search(r'\[\s*\{.*\}\s*\]', text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
                if isinstance(data, list):
                    return [item for item in data if isinstance(item, dict)]
            except Exception:
                pass
        return []

    async def _plan_with_llm(
        self,
        objective: str,
        speaker: Agent,
        params: dict[str, Any],
    ) -> list[Task]:
        prompt = self.prompt_builder.build(
            agent=speaker,
            objective=objective,
            mode="planning",
        )
        llm_response = None
        if self.llm_generate is not None:
            try:
                llm_response = self.llm_generate(speaker, prompt)
            except Exception:
                llm_response = None
        else:
            try:
                res = self.llm_client.generate(speaker, prompt, assembled=True)
                if res and not res.fallback and res.content:
                    llm_response = res.content
            except Exception:
                llm_response = None

        if not llm_response:
            return []

        specs = self._parse_tasks_json(llm_response)
        if not specs:
            return []

        tasks: list[Task] = []
        id_map: dict[int, str] = {}
        for idx, spec in enumerate(specs):
            title = str(spec.get("title") or f"Etapa {idx + 1}").strip()
            raw_assigned = str(spec.get("assigned_agent") or "").strip()
            assigned = None
            for name in self.collaborators:
                if name.lower() == raw_assigned.lower():
                    assigned = name
                    break
            if not assigned:
                assigned = params.get("_assigned_agent") or "Nero"

            desc = str(spec.get("description") or objective).strip()
            raw_deps = spec.get("dependencies") or []
            deps: list[str] = []
            for d in raw_deps:
                if isinstance(d, int) and d in id_map:
                    deps.append(id_map[d])
                elif isinstance(d, str):
                    if d in id_map.values():
                        deps.append(d)
                    elif d.isdigit() and int(d) in id_map:
                        deps.append(id_map[int(d)])

            input_data = spec.get("input_data")
            if not isinstance(input_data, dict):
                input_data = {}

            task = await self.task_manager.create_task(
                title=title,
                description=desc,
                assigned_agent=assigned,
                dependencies=deps,
                input_data=input_data,
            )
            tasks.append(task)
            id_map[idx] = task.id

        return tasks

    async def _respond_as_chat(self, speaker: Agent, objective: str) -> None:
        opinions = []
        if speaker is self:
            await speaker.send_message(
                to_agent="System",
                msg_type="status_update",
                content="Chamando Atlas, Nero e Iris para uma rodada curta de discussão local.",
            )
            opinions = await self.discuss_with_team(objective)
        try:
            llm_answer = self._ollama_answer(
                speaker, objective, mode="answer", team_opinions=opinions or None,
            )
        except TypeError:
            llm_answer = self._ollama_answer(speaker, objective)
        if self._requires_no_api_keys(objective) and self.llm_generate is None:
            llm_answer = self._fallback_team_summary(objective, opinions)
        elif not llm_answer:
            llm_answer = self._fallback_team_summary(objective, opinions) or None
        await speaker.send_message(
            to_agent="System",
            msg_type="answer",
            content=llm_answer or f'Recebi sua mensagem: "{objective}". O motor {speaker.provider_id} está conectado, mas ainda não executei uma sessão de trabalho completa por ele.',
            data={"conversation_agent": speaker.name.lower(), "provider_id": speaker.provider_id, "model": str(speaker.model_config.get("model") or self._default_model_for(speaker.provider_id)) if llm_answer else None, "opinions": opinions},
        )

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

        # If it's a plain greeting or conversational question without task verbs, reply directly
        if self._is_plain_message(objective):
            await self._respond_as_chat(speaker, objective)
            await speaker.set_status(AgentStatus.IDLE)
            return []

        is_ma_target = speaker.name == "Ma" or params.get("_assigned_agent") == "Ma"
        fin_word_match = bool(re.search(r"\b(ação|ações|acoes|acao|fii|fiis|rsi)\b", obj_lower))
        fin_keywords = [
            "cotação", "cotacao", "bolsa", "dividendo", "dividendos", "ibov", "ibovespa",
            "carteira", "investimento", "investimentos", "dolar", "dólar",
            "petr4", "vale3", "mxrf11", "itub4", "wege3", "bbas3",
        ]
        has_fin = fin_word_match or any(w in obj_lower for w in fin_keywords)

        is_livro_target = speaker.name == "Livro" or params.get("_assigned_agent") == "Livro"
        sports_keywords = [
            "esporte", "esportes", "futebol", "tabela", "classificação", "classificacao",
            "brasileirão", "brasileirao", "rodada", "campeonato", "champions", "premier league",
            "la liga", "libertadores", "nba", "basquete", "nfl", "super bowl", "mlb", "beisebol",
            "flamengo", "palmeiras", "corinthians", "são paulo", "sao paulo", "vasco", "botafogo",
            "cruzeiro", "grêmio", "gremio", "internacional", "lakers", "celtics", "warriors",
            "bulls", "chiefs", "49ers", "eagles", "patriots", "packers", "yankees", "dodgers",
            "red sox", "próximo jogo", "proximo jogo", "últimos jogos", "ultimos jogos", "jogos", "placar"
        ]
        has_sports = any(w in obj_lower for w in sports_keywords)

        if is_ma_target or has_fin:
            assigned = "Ma"
            # 1. Trade
            if any(op in obj_lower for op in ["comprar", "compra", "vender", "venda"]):
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
            # 2. Portfolio View
            elif any(w in obj_lower for w in ["carteira", "posições", "posicoes", "saldo", "meus ativos", "patrimônio", "patrimonio"]):
                task = await self.task_manager.create_task(
                    title="Consultar carteira de investimentos",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={"tool_calls": [{"tool": "stock_portfolio_view", "params": {}}]},
                )
                tasks_created.append(task)
            # 3. Technicals
            elif any(w in obj_lower for w in ["indicador", "indicadores", "rsi", "técnica", "tecnica", "tendência", "tendencia", "suporte"]):
                ticker = _extract_ticker_from_text(objective, default="PETR4")
                task = await self.task_manager.create_task(
                    title=f"Indicadores técnicos ({ticker})",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={"tool_calls": [{"tool": "stock_get_technicals", "params": {"ticker": ticker}}]},
                )
                tasks_created.append(task)
            # 4. Market Benchmarks
            elif any(w in obj_lower for w in ["panorama", "índices", "indices", "mercado hoje", "mercado agora", "dólar", "dolar"]):
                task = await self.task_manager.create_task(
                    title="Panorama de mercado (B3 / Câmbio / S&P)",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={"tool_calls": [{"tool": "stock_get_market_benchmarks", "params": {}}]},
                )
                tasks_created.append(task)
            # 5. Default Quote
            else:
                ticker = _extract_ticker_from_text(objective, default="PETR4")
                task = await self.task_manager.create_task(
                    title=f"Consultar cotação ({ticker})",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={"tool_calls": [{"tool": "stock_get_quote", "params": {"ticker": ticker}}]},
                )
                tasks_created.append(task)
        elif is_livro_target or has_sports:
            assigned = "Livro"
            # 1. Matches
            if any(w in obj_lower for w in ["jogo", "jogos", "confronto", "confrontos", "partida", "partidas", "resultado", "resultados"]):
                team = "Flamengo"
                for t in ["flamengo", "palmeiras", "corinthians", "sao paulo", "são paulo", "vasco", "botafogo", "lakers", "celtics", "chiefs", "49ers", "yankees", "dodgers"]:
                    if t in obj_lower:
                        team = t
                        break
                task = await self.task_manager.create_task(
                    title=f"Partidas e resultados ({team.title()})",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={"tool_calls": [{"tool": "sports_get_matches", "params": {"team_name": team}}]},
                )
                tasks_created.append(task)
            # 2. Standings / table
            elif any(w in obj_lower for w in ["tabela", "classificação", "classificacao", "pontuação", "pontuacao", "líder", "lider"]):
                league_target = "brasileirao"
                if "nba" in obj_lower or "basquete" in obj_lower:
                    league_target = "nba"
                elif "nfl" in obj_lower or "americano" in obj_lower or "super bowl" in obj_lower:
                    league_target = "nfl"
                elif "mlb" in obj_lower or "beisebol" in obj_lower:
                    league_target = "mlb"
                elif "premier" in obj_lower or "inglês" in obj_lower or "ingles" in obj_lower:
                    league_target = "premier league"
                elif "champions" in obj_lower:
                    league_target = "champions league"
                task = await self.task_manager.create_task(
                    title=f"Tabela de classificação ({league_target.upper()})",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={"tool_calls": [{"tool": "sports_get_standings", "params": {"league_or_sport": league_target}}]},
                )
                tasks_created.append(task)
            # 3. Rules / Trivia
            elif any(w in obj_lower for w in ["regra", "regras", "como funciona", "formato", "playoffs", "história", "historia"]):
                topic = "brasileirao_format"
                if "nba" in obj_lower or "basquete" in obj_lower:
                    topic = "nba_playoffs"
                elif "nfl" in obj_lower:
                    topic = "nfl_rules"
                elif "mlb" in obj_lower or "beisebol" in obj_lower:
                    topic = "mlb_rules"
                elif "champions" in obj_lower:
                    topic = "champions_format"
                task = await self.task_manager.create_task(
                    title=f"Enciclopédia esportiva: {topic}",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={"tool_calls": [{"tool": "sports_get_trivia_and_rules", "params": {"topic": topic}}]},
                )
                tasks_created.append(task)
            # 4. Team Info / Generic Sports Search
            else:
                target_team = "Flamengo"
                for t in ["flamengo", "palmeiras", "corinthians", "sao paulo", "são paulo", "botafogo", "vasco", "lakers", "celtics", "chiefs", "49ers", "yankees", "dodgers"]:
                    if t in obj_lower:
                        target_team = t
                        break
                task = await self.task_manager.create_task(
                    title=f"Informações e histórico de {target_team.title()}",
                    description=objective,
                    assigned_agent=assigned,
                    input_data={"tool_calls": [{"tool": "sports_get_team_info", "params": {"team_name": target_team}}]},
                )
                tasks_created.append(task)
        else:
            # 1. Try LLM planning first for actionable objectives
            llm_tasks = await self._plan_with_llm(objective, speaker, params)
            if llm_tasks:
                tasks_created.extend(llm_tasks)
            # 2. Heuristic fallback when LLM is unavailable or returned no tasks
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
                # No tasks created — plain chat response
                await self._respond_as_chat(speaker, objective)

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
