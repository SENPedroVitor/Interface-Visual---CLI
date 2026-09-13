/**
 * Safe AST Parser for OpenUI language representations.
 * Strictly avoids eval() and Function().
 * Handles Function-call syntax, JSON objects/arrays, and JSX-like tags.
 */

import type { OpenUIASTNode, ParseResult } from './types.ts';

/**
 * Safely parse a value token (string, number, boolean, null, json array, json object).
 */
function safeParseValue(valStr: string): any {
  const trimmed = valStr.trim();

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null' || trimmed === 'undefined') return null;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  // Quoted string ("..." or '...')
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\n/g, '\n');
  }

  // JSON Array or Object
  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      // Normalize single quotes or unquoted keys to valid JSON if needed
      return JSON.parse(trimmed);
    } catch {
      try {
        const sanitized = trimmed
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
          .replace(/'/g, '"');
        return JSON.parse(sanitized);
      } catch {
        return trimmed;
      }
    }
  }

  return trimmed;
}

/**
 * Parses arguments in a function-call syntax like:
 * key="value", num=10, list=[{"a": 1}], bool=true
 */
function parseFunctionArgs(argsString: string): Record<string, any> {
  const props: Record<string, any> = {};
  let currentKey = '';
  let currentValue = '';
  let inQuotes: '"' | "'" | null = null;
  let bracketDepth = 0;
  let braceDepth = 0;
  let readingKey = true;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    const prevChar = i > 0 ? argsString[i - 1] : '';

    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (inQuotes === char) {
        inQuotes = null;
      } else if (!inQuotes) {
        inQuotes = char;
      }
    }

    if (!inQuotes) {
      if (char === '[') bracketDepth++;
      else if (char === ']') bracketDepth--;
      else if (char === '{') braceDepth++;
      else if (char === '}') braceDepth--;
    }

    const atTopLevel = !inQuotes && bracketDepth === 0 && braceDepth === 0;

    if (atTopLevel && readingKey && (char === '=' || char === ':')) {
      readingKey = false;
      continue;
    }

    if (atTopLevel && char === ',') {
      if (currentKey.trim()) {
        props[currentKey.trim()] = safeParseValue(currentValue);
      }
      currentKey = '';
      currentValue = '';
      readingKey = true;
      continue;
    }

    if (readingKey) {
      currentKey += char;
    } else {
      currentValue += char;
    }
  }

  if (currentKey.trim()) {
    props[currentKey.trim()] = safeParseValue(currentValue);
  }

  return props;
}

/**
 * Parses function call syntax:
 * ComponentName(prop="val", num=10, ...)
 */
function parseFunctionSyntax(text: string): OpenUIASTNode[] {
  const nodes: OpenUIASTNode[] = [];
  const funcRegex = /([A-Za-z][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)(?:\s*;|\s*$)/g;
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(text))) {
    const component = match[1];
    const args = match[2];
    const props = parseFunctionArgs(args);
    nodes.push({
      component,
      props,
      raw: match[0],
    });
  }

  return nodes;
}

/**
 * Parses JSX-like tag syntax:
 * <ComponentName prop="val" ... /> or <ComponentName>...</ComponentName>
 */
function parseTagSyntax(text: string): OpenUIASTNode[] {
  const nodes: OpenUIASTNode[] = [];
  // Match <Component ... /> or <Component ...>
  const tagRegex = /<([A-Z][A-Za-z0-9_]*)([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text))) {
    const component = match[1];
    const attrsStr = match[2] || '';
    const innerText = match[3];
    const props: Record<string, any> = {};

    // Match attr="val" or attr={val}
    const attrRegex = /([a-zA-Z0-9_]+)=(?:"([^"]*)"|'([^']*)'|\{([^}]+)\})/g;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(attrsStr))) {
      const key = attrMatch[1];
      const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4];
      props[key] = safeParseValue(val);
    }

    nodes.push({
      component,
      props,
      children: innerText ? [innerText.trim()] : undefined,
      raw: match[0],
    });
  }

  return nodes;
}

/**
 * Safe JSON parser for OpenUI schema definitions:
 * { "component": "...", "props": { ... } } or array thereof
 */
function parseJsonSyntax(text: string): OpenUIASTNode[] {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const nodes: OpenUIASTNode[] = [];

    for (const item of items) {
      if (item && typeof item === 'object') {
        const componentName = item.component || item.type || item.name;
        if (componentName && typeof componentName === 'string') {
          nodes.push({
            component: componentName,
            props: item.props || item.data || item.attributes || {},
            children: item.children,
            raw: JSON.stringify(item),
          });
        }
      }
    }
    return nodes;
  } catch {
    return [];
  }
}

/**
 * Main parser entry point.
 * Given OpenUI text, attempts parsing across known formats and returns an AST.
 */
export function parseOpenUI(content: string): ParseResult {
  const cleaned = content.trim();
  if (!cleaned) {
    return { nodes: [], hasErrors: false };
  }

  // 1. Try JSON
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    const jsonNodes = parseJsonSyntax(cleaned);
    if (jsonNodes.length > 0) {
      return { nodes: jsonNodes, hasErrors: false };
    }
  }

  // 2. Try Function-call syntax (e.g. TaskPlan(...))
  if (/[A-Za-z][A-Za-z0-9_]*\s*\(/.test(cleaned)) {
    const funcNodes = parseFunctionSyntax(cleaned);
    if (funcNodes.length > 0) {
      return { nodes: funcNodes, hasErrors: false };
    }
  }

  // 3. Try JSX-like tags (<TaskPlan ... />)
  if (/<[A-Z][A-Za-z0-9_]*/.test(cleaned)) {
    const tagNodes = parseTagSyntax(cleaned);
    if (tagNodes.length > 0) {
      return { nodes: tagNodes, hasErrors: false };
    }
  }

  return {
    nodes: [],
    error: 'Formato de OpenUI não reconhecido.',
    hasErrors: true,
  };
}

/**
 * Detects if a text string or code block contains OpenUI specifications.
 */
export function looksLikeOpenUI(lang?: string, content?: string): boolean {
  if (lang && ['openui', 'genui', 'ui', 'waddle-ui'].includes(lang.toLowerCase())) {
    return true;
  }
  if (!content) return false;

  const trimmed = content.trim();
  // Check for component function call pattern
  if (/^(TaskPlan|TaskProgress|ApprovalCard|MatchCard|LiveScore|StockCard|PortfolioCard|ResearchSummary|ReviewSummary|ToolCall|MetricCard|StatusPill)\s*\(/i.test(trimmed)) {
    return true;
  }

  // Check for JSON OpenUI object pattern
  if (trimmed.startsWith('{') && /"component"\s*:\s*"(TaskPlan|TaskProgress|ApprovalCard|MatchCard|LiveScore|StockCard|PortfolioCard|ResearchSummary|ReviewSummary|ToolCall)"/i.test(trimmed)) {
    return true;
  }

  // Check for JSX tag pattern
  if (/^<(TaskPlan|TaskProgress|ApprovalCard|MatchCard|LiveScore|StockCard|PortfolioCard|ResearchSummary|ReviewSummary|ToolCall)[\s>]/i.test(trimmed)) {
    return true;
  }

  return false;
}
