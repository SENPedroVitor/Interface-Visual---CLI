import { TimelineStage, StageStatus } from '../components/StatusTimeline';

/**
 * Checks if a codeblock or text looks like a StatusTimeline representation.
 */
export function looksLikeStatusTimeline(lang?: string, content?: string): boolean {
  if (lang) {
    const l = lang.toLowerCase().trim();
    if (['status', 'timeline', 'status-timeline', 'stages', 'pipeline'].includes(l)) {
      return true;
    }
  }

  if (!content) return false;
  const trimmed = content.trim();

  // JSON format
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].status && parsed[0].label) {
        return true;
      }
    } catch (_) {}
  }

  // Bracket status pattern: e.g. [succeeded] or [running] or [pending]
  if (
    /(?:^|\n)\s*[-*]?\s*\[(succeeded|running|pending|failed|skipped|done|error|sucesso|falha|executando|pendente)\]/i.test(
      content
    )
  ) {
    return true;
  }

  // Arrow step pipeline: e.g. "queued -> building -> deploying -> done"
  if (/\b\w+\s*->\s*\w+\s*->\s*\w+/.test(content)) {
    return true;
  }

  return false;
}

/**
 * Parses markdown or text into a TimelineStage[] array.
 */
export function parseStatusTimeline(content: string): TimelineStage[] {
  const trimmed = content.trim();

  // Try JSON first
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => ({
          id: item.id || `stage-${idx + 1}`,
          label: item.label || item.name || item.title || `Stage ${idx + 1}`,
          status: normalizeStatus(item.status),
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          detail: item.detail,
          error: item.error,
        }));
      }
    } catch (_) {}
  }

  // Arrow pipeline: e.g. "queued -> building -> deploying -> done"
  if (trimmed.includes('->') && !trimmed.includes('\n')) {
    const parts = trimmed.split('->').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts.map((part, idx) => {
        let status: StageStatus = 'pending';
        let label = part;

        // Check if there's a status tag in brackets e.g. "deploying (running)"
        const match = /\(([^)]+)\)$/.exec(part);
        if (match) {
          status = normalizeStatus(match[1]);
          label = part.replace(/\(([^)]+)\)$/, '').trim();
        } else {
          // Default heuristic: first items succeeded, current running, later pending
          if (idx === 0) status = 'succeeded';
          else if (idx === 1) status = 'running';
          else status = 'pending';
        }

        return {
          id: `stage-${idx + 1}`,
          label,
          status,
        };
      });
    }
  }

  // Line-by-line bracket parser:
  // - [succeeded] Iniciar análise (1.2s)
  // - [running] Processando dados
  // - [failed] Deploy: Conexão recusada
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const stages: TimelineStage[] = [];

  const lineRegex =
    /^[-*0-9.]*\s*\[(succeeded|running|pending|failed|skipped|done|error|sucesso|falha|executando|pendente)\]\s*(.+)$/i;

  let stageIndex = 1;
  for (const line of lines) {
    const match = lineRegex.exec(line);
    if (match) {
      const rawStatus = match[1];
      let rest = match[2].trim();
      let error: string | undefined = undefined;
      let detail: string | undefined = undefined;
      let durationMs: number | undefined = undefined;

      // Extract duration in parens at the end e.g. "(1.2s)" or "(42s)"
      const durMatch = /\(([\d.]+[smh]?)\)$/.exec(rest);
      if (durMatch) {
        rest = rest.replace(/\(([\d.]+[smh]?)\)$/, '').trim();
        const num = parseFloat(durMatch[1]);
        if (!isNaN(num)) {
          if (durMatch[1].endsWith('m')) durationMs = num * 60 * 1000;
          else if (durMatch[1].endsWith('h')) durationMs = num * 3600 * 1000;
          else durationMs = num * 1000;
        }
      }

      // Check if there is an error message separated by ":"
      const status = normalizeStatus(rawStatus);
      if (status === 'failed' && rest.includes(':')) {
        const splitIdx = rest.indexOf(':');
        error = rest.slice(splitIdx + 1).trim();
        rest = rest.slice(0, splitIdx).trim();
      }

      const now = Date.now();
      const startedAt = durationMs ? new Date(now - durationMs).toISOString() : undefined;
      const endedAt = durationMs ? new Date(now).toISOString() : undefined;

      stages.push({
        id: `stage-${stageIndex++}`,
        label: rest,
        status,
        startedAt: status === 'running' ? new Date(now - 3000).toISOString() : startedAt,
        endedAt,
        detail,
        error,
      });
    }
  }

  return stages;
}

function normalizeStatus(raw: any): StageStatus {
  if (!raw || typeof raw !== 'string') return 'pending';
  const s = raw.toLowerCase().trim();
  if (['succeeded', 'success', 'done', 'passed', 'sucesso', 'concluído'].includes(s)) {
    return 'succeeded';
  }
  if (['failed', 'error', 'errored', 'falha', 'erro'].includes(s)) {
    return 'failed';
  }
  if (['running', 'in_progress', 'executando', 'processando'].includes(s)) {
    return 'running';
  }
  if (['skipped', 'pulado', 'ignorado'].includes(s)) {
    return 'skipped';
  }
  return 'pending';
}
