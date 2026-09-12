import json
import re
from typing import Any, Callable, Optional
from .base import Agent, AgentStatus
from ..tasks.task import Task
from ..core.event_bus import EventBus
from ..tools.registry import ToolRegistry
from ..llm.provider_client import LLMProviderClient
from ..context.prompt_builder import PromptBuilder


class WorkerAgent(Agent):
    def __init__(
        self,
        name: str = "Worker",
        role: str = "Executor",
        description: str = "Executes assigned tasks using authorized tools.",
        provider_id: str = "ollama",
        event_bus: Optional[EventBus] = None,
        tool_registry: Optional[ToolRegistry] = None,
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
        self.llm_client: LLMProviderClient = kwargs.get("llm_client") or LLMProviderClient()
        self.llm_generate: Optional[Callable[[Agent, str], Optional[str]]] = kwargs.get("llm_generate")
        self._database = kwargs.get("database")
        self.skill_registry = kwargs.get("skill_registry")
        self._prompt_builder: Optional[PromptBuilder] = None

    @property
    def prompt_builder(self) -> PromptBuilder:
        if self._prompt_builder is None:
            self._prompt_builder = PromptBuilder(
                database=self._database,
                tool_registry=self.tool_registry,
                skill_registry=self.skill_registry,
            )
        return self._prompt_builder

    def _format_task_summary(self, task: Task, results: list[dict[str, Any]]) -> str:
        messages = []
        for item in results:
            tname = item.get("tool_name")
            res = item.get("result")
            if not item.get("success") or not isinstance(res, dict):
                continue
            if tname == "stock_get_quote":
                ticker = res.get("ticker", "")
                price = res.get("price")
                cur = res.get("currency", "BRL")
                chg = res.get("change")
                chg_pct = res.get("change_pct")
                d_low = res.get("day_low")
                d_high = res.get("day_high")
                sign = "+" if (chg_pct or 0) >= 0 else ""
                chg_str = f" ({sign}{chg_pct:.2f}% | {sign}{chg:.2f})" if chg is not None and chg_pct is not None else ""
                msg = f"**[Cotação] {ticker}**: {cur} {price:.2f}{chg_str}" if price is not None else f"**[Cotação] {ticker}**"
                if d_low is not None and d_high is not None:
                    msg += f" | Mín: {cur} {d_low:.2f} | Máx: {cur} {d_high:.2f}"
                messages.append(msg)
            elif tname == "stock_get_technicals":
                ticker = res.get("ticker", "")
                rsi = res.get("rsi_14")
                eval_rsi = res.get("rsi_assessment", "")
                sma20 = res.get("sma_20")
                sma50 = res.get("sma_50")
                trend = res.get("trend", "")
                msg = f"**[Indicadores Técnicos] {ticker}**:\n- RSI (14): {rsi} ({eval_rsi})\n- Tendência: {trend}"
                if sma20:
                    msg += f"\n- Média Móvel (SMA 20): R$ {sma20}"
                if sma50:
                    msg += f"\n- Média Móvel (SMA 50): R$ {sma50}"
                messages.append(msg)
            elif tname == "stock_market_overview":
                summary = res.get("market_summary", [])
                lines = ["**[Visão do Mercado]**"]
                for b in summary:
                    sign = "+" if (b.get("change_pct") or 0) >= 0 else ""
                    lines.append(f"- **{b.get('name')}** ({b.get('ticker')}): {b.get('currency')} {b.get('price')} ({sign}{b.get('change_pct')}%)")
                messages.append("\n".join(lines))
            elif tname == "stock_portfolio_view":
                cash = res.get("cash_balance", 0.0)
                tot_inv = res.get("total_invested", 0.0)
                pos_val = res.get("positions_value", 0.0)
                net = res.get("net_worth", 0.0)
                pnl = res.get("total_pnl_brl", 0.0)
                pnl_pct = res.get("total_pnl_pct", 0.0)
                sign = "+" if pnl >= 0 else ""
                lines = [
                    "**[Carteira de Investimentos]**",
                    f"- Saldo em Caixa: R$ {cash:.2f}",
                    f"- Total Investido: R$ {tot_inv:.2f}",
                    f"- Valor Atual dos Ativos: R$ {pos_val:.2f}",
                    f"- Patrimônio Líquido: R$ {net:.2f}",
                    f"- Rentabilidade Acumulada: {sign}R$ {pnl:.2f} ({sign}{pnl_pct:.2f}%)",
                ]
                pos_list = res.get("positions", [])
                if pos_list:
                    lines.append("\n**Posições em Custódia:**")
                    for p in pos_list:
                        psign = "+" if p.get("pnl_brl", 0) >= 0 else ""
                        lines.append(
                            f"- **{p['ticker']}**: {p['shares']} cotas | Médio: R$ {p['average_price']:.2f} | Atual: R$ {p['current_price']:.2f} ({psign}R$ {p['pnl_brl']:.2f})"
                        )
                else:
                    lines.append("- Nenhuma cota ou ação em carteira no momento.")
                messages.append("\n".join(lines))
            elif tname == "stock_portfolio_record_trade":
                messages.append(res.get("message", "Operação financeira realizada com sucesso!"))
            elif tname == "sports_get_standings":
                league = res.get("league", "Classificação")
                sport = res.get("sport", "Esporte")
                src = res.get("source", "Waddle Sports")
                table = res.get("table", [])
                lines = [f"**[{sport}] {league}** (Fonte: {src})\n"]
                if table:
                    # Check if table is soccer style (points/played) or US style (wins/losses)
                    first_row = table[0]
                    if "wins" in first_row or "pct" in first_row:
                        conf_header = " | Conf/Div" if "conference" in first_row or "division" in first_row else ""
                        lines.append(f"| Pos | Franquia{conf_header} | V | D | % |")
                        lines.append(f"| --- | ---{' | ---' if conf_header else ''} | --- | --- | --- |")
                        for r in table[:15]:
                            conf_col = f" | {r.get('conference') or r.get('division', '')}" if conf_header else ""
                            lines.append(f"| {r.get('pos', '-')} | **{r.get('team')}**{conf_col} | {r.get('wins', '-')} | {r.get('losses', '-')} | {r.get('pct', '-')} |")
                    else:
                        lines.append("| Pos | Clube | Pts | J | V | E | D | SG |")
                        lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
                        for r in table[:15]:
                            lines.append(f"| {r.get('pos', '-')} | **{r.get('team')}** | {r.get('points', '-')} | {r.get('played', '-')} | {r.get('won', '-')} | {r.get('drawn', '-')} | {r.get('lost', '-')} | {r.get('goal_diff', '-')} |")
                else:
                    lines.append("Nenhum dado de classificação retornado.")
                messages.append("\n".join(lines))
            elif tname == "sports_get_team_info":
                if res.get("success"):
                    team = res.get("team")
                    sport = res.get("sport")
                    league = res.get("league")
                    stadium = res.get("stadium")
                    founded = res.get("founded")
                    titles = res.get("titles")
                    nick = res.get("nickname")
                    lines = [
                        f"**[{sport}] {team}** ({league})",
                        f"- Estádio/Arena: {stadium}",
                        f"- Fundação: {founded} | Apelido: {nick}",
                    ]
                    if titles:
                        lines.append(f"- Títulos: {titles}")
                    if res.get("rivals"):
                        lines.append(f"- Rivais: {res.get('rivals')}")
                    if res.get("description"):
                        lines.append(f"\n{res.get('description')}")
                    messages.append("\n".join(lines))
                else:
                    messages.append(res.get("error", "Clube ou franquia não localizada."))
            elif tname == "sports_get_matches":
                team = res.get("team", "Time")
                past = res.get("past_matches", [])
                upc = res.get("upcoming_matches", [])
                lines = [f"**[Confrontos & Resultados] {team.title()}**"]
                if past:
                    lines.append("\n*Últimos Resultados:*")
                    for m in past:
                        lines.append(f"- {m.get('status')} {m.get('event')} ({m.get('date', '')})")
                if upc:
                    lines.append("\n*Próximas Partidas:*")
                    for m in upc:
                        lines.append(f"- {m.get('status')} {m.get('event')} ({m.get('date', '')} {m.get('time', '')})")
                if not past and not upc:
                    lines.append("- Nenhuma partida recente ou futura encontrada.")
                messages.append("\n".join(lines))
            elif tname == "sports_get_trivia_and_rules":
                top = res.get("topic", "Enciclopédia Esportiva")
                if res.get("content"):
                    messages.append(f"**[{top}]**\n\n{res.get('content')}")
                elif res.get("available_topics"):
                    tops = "\n".join(f"- {t}" for t in res["available_topics"])
                    messages.append(f"**[{top}]**\n\n{res.get('message', '')}\n\n{tops}")

        if messages:
            return "\n\n".join(messages)
        return f"Successfully finished task: '{task.title}'"

    async def execute_task(self, task: Task) -> Any:
        self.current_task_id = task.id
        await self.set_status(AgentStatus.THINKING)

        await self.send_message(
            to_agent="Manager",
            msg_type="status_update",
            content=f"Starting execution of task: '{task.title}'",
            task_id=task.id,
            data={"conversation_agent": self.name.lower()},
        )

        output: dict[str, Any] = {"summary": f"Completed task: {task.title}", "results": []}

        try:
            # Check if task specifies tool calls in input_data
            tool_calls = task.input_data.get("tool_calls", [])
            await self.set_status(AgentStatus.WORKING)
            if tool_calls:
                for call in tool_calls:
                    tool_name = call.get("tool")
                    params = call.get("params", {})
                    if not tool_name:
                        continue

                    exec_res = await self.tool_registry.execute(
                        tool_name=tool_name,
                        params=params,
                        agent_id=self.id,
                        task_id=task.id,
                    )
                    output["results"].append(exec_res.to_dict())
                    if not exec_res.success:
                        raise RuntimeError(f"Tool {tool_name} failed: {exec_res.error}")
            else:
                # Fallback action execution based on title/description or simple mock step
                action_type = task.input_data.get("action")
                if action_type == "write_file":
                    res = await self.tool_registry.execute(
                        "write_file",
                        {
                            "path": task.input_data.get("path", "output.txt"),
                            "content": task.input_data.get("content", ""),
                        },
                        agent_id=self.id,
                        task_id=task.id,
                    )
                    output["results"].append(res.to_dict())
                elif action_type == "run_command":
                    res = await self.tool_registry.execute(
                        "run_command",
                        {"command": task.input_data.get("command", "echo OK")},
                        agent_id=self.id,
                        task_id=task.id,
                    )
                    output["results"].append(res.to_dict())
                else:
                    await self._autonomous_tool_loop(task, output)

            if output.get("final_answer"):
                summary = output["final_answer"]
            else:
                summary = self._format_task_summary(task, output["results"])

            await self.send_message(
                to_agent="Manager",
                msg_type="task_result",
                content=summary,
                task_id=task.id,
                data={**output, "conversation_agent": self.name.lower()},
            )
            return output
        except Exception as e:
            err_msg = str(e)
            await self.send_message(
                to_agent="Manager",
                msg_type="task_failed",
                content=f"Failed task '{task.title}': {err_msg}",
                task_id=task.id,
                data={"error": err_msg},
            )
            raise
        finally:
            self.current_task_id = None
            await self.set_status(AgentStatus.IDLE)

    @staticmethod
    def _parse_action_json(text: str) -> Optional[dict[str, Any]]:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass
        return None

    @staticmethod
    def _format_observations(results: list[dict[str, Any]]) -> str:
        lines = ["Histórico de ações executadas nesta tarefa:"]
        for idx, res in enumerate(results, 1):
            tname = res.get("tool_name", "ação")
            ok = "SUCESSO" if res.get("success") else f"FALHA ({res.get('error')})"
            res_val = res.get("result", {})
            out = json.dumps(res_val, ensure_ascii=False) if isinstance(res_val, (dict, list)) else str(res_val)
            if len(out) > 300:
                out = out[:297] + "..."
            lines.append(f"Passo {idx}: Chamou {tname} -> {ok} | Resultado: {out}")
        return "\n".join(lines)

    async def _autonomous_tool_loop(
        self,
        task: Task,
        output: dict[str, Any],
        max_steps: int = 4,
    ) -> None:
        for step in range(max_steps):
            obs = self._format_observations(output["results"]) if output["results"] else None
            prompt = self.prompt_builder.build(
                agent=self,
                objective=task.description or task.title,
                mode="tool_choice",
                extra_context=obs,
            )
            llm_text = None
            if self.llm_generate is not None:
                try:
                    llm_text = self.llm_generate(self, prompt)
                except Exception:
                    llm_text = None
            else:
                try:
                    res = self.llm_client.generate(self, prompt, assembled=True)
                    if res and not res.fallback and res.content:
                        llm_text = res.content
                except Exception:
                    llm_text = None

            if not llm_text:
                if not output["results"]:
                    output["results"].append({"action": "default_execution", "status": "ok"})
                break

            action_data = self._parse_action_json(llm_text)
            if not action_data:
                output["final_answer"] = llm_text.strip()
                break

            action = action_data.get("action")
            if action == "finish" or "final_answer" in action_data:
                output["final_answer"] = action_data.get("final_answer", llm_text.strip())
                break

            tool_name = action_data.get("tool")
            params = action_data.get("params") or {}
            if not tool_name:
                output["final_answer"] = llm_text.strip()
                break

            exec_res = await self.tool_registry.execute(
                tool_name=tool_name,
                params=params,
                agent_id=self.id,
                task_id=task.id,
            )
            output["results"].append(exec_res.to_dict())
