import { contextBridge, ipcRenderer } from "electron";

const api = {
  start: (backend: string) => ipcRenderer.invoke("core:start", backend),
  send: (data: string) => ipcRenderer.invoke("core:send", data),
  listSessions: () => ipcRenderer.invoke("core:history:sessions"),
  listEvents: (sessionId: number) =>
    ipcRenderer.invoke("core:history:events", sessionId),
  onOutput: (handler: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) =>
      handler(payload);
    ipcRenderer.on("core:output", listener);
    return () => ipcRenderer.removeListener("core:output", listener);
  }
};

contextBridge.exposeInMainWorld("core", api);
