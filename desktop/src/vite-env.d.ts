/// <reference types="vite/client" />

interface CoreAPI {
  start: (backend: string) => Promise<void>;
  send: (data: string) => Promise<void>;
  listSessions: () => Promise<
    {
      id: number;
      backend: string;
      command: string;
      started_at: string;
      ended_at: string | null;
    }[]
  >;
  listEvents: (sessionId: number) => Promise<
    {
      id: number;
      ts: string;
      direction: string;
      content: string;
    }[]
  >;
  onOutput: (handler: (payload: unknown) => void) => () => void;
}

declare global {
  interface Window {
    core?: CoreAPI;
  }
}
