type Session = {
  id: number;
  backend: string;
  command: string;
  started_at: string;
  ended_at: string | null;
};

type Event = {
  id: number;
  ts: string;
  direction: string;
  content: string;
};

type OutputPayload = unknown;

export type CoreClient = {
  available: boolean;
  start: (backend: string) => Promise<void>;
  send: (data: string) => Promise<void>;
  listSessions: () => Promise<Session[]>;
  listEvents: (sessionId: number) => Promise<Event[]>;
  onOutput: (handler: (payload: OutputPayload) => void) => () => void;
};

const fallbackClient: CoreClient = {
  available: false,
  start: async () => undefined,
  send: async () => undefined,
  listSessions: async () => [],
  listEvents: async () => [],
  onOutput: () => () => undefined
};

export function getCoreClient(): CoreClient {
  const core = window.core;
  if (
    !core ||
    typeof core.start !== "function" ||
    typeof core.send !== "function" ||
    typeof core.listSessions !== "function" ||
    typeof core.listEvents !== "function" ||
    typeof core.onOutput !== "function"
  ) {
    return fallbackClient;
  }

  return {
    available: true,
    start: core.start,
    send: core.send,
    listSessions: core.listSessions,
    listEvents: core.listEvents,
    onOutput: core.onOutput
  };
}
