import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import readline from "node:readline";

const isDev = process.env.NODE_ENV === "development";

// Linux environments with disabled user namespaces need this.
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-setuid-sandbox");
app.commandLine.appendSwitch("disable-gpu-sandbox");
let mainWindow: BrowserWindow | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getRepoRoot = () => path.join(__dirname, "..", "..");
const getPythonPath = () => path.join(getRepoRoot(), "src");

class CoreBridge {
  private proc: ReturnType<typeof spawn> | null = null;

  start() {
    if (this.proc) {
      return;
    }
    this.proc = spawn("python3", ["-m", "cli_harness.bridge"], {
      env: {
        ...process.env,
        PYTHONPATH: getPythonPath()
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => {
      try {
        const payload = JSON.parse(line);
        mainWindow?.webContents.send("core:output", payload);
      } catch {
        mainWindow?.webContents.send("core:output", {
          type: "output",
          data: line + "\n"
        });
      }
    });

    this.proc.stderr.on("data", (chunk) => {
      mainWindow?.webContents.send("core:output", {
        type: "output",
        data: chunk.toString()
      });
    });
  }

  send(payload: Record<string, unknown>) {
    if (!this.proc?.stdin.writable) {
      return;
    }
    this.proc.stdin.write(JSON.stringify(payload) + "\n");
  }

  stop() {
    if (!this.proc) {
      return;
    }
    this.send({ type: "exit" });
    this.proc.kill();
    this.proc = null;
  }
}

const bridge = new CoreBridge();

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#0b0f1a",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow = win;

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
};

ipcMain.handle("core:start", (_event, backend: string) => {
  bridge.start();
  bridge.send({ type: "start", backend });
});

ipcMain.handle("core:send", (_event, data: string) => {
  bridge.send({ type: "send", data });
});

ipcMain.handle("core:history:sessions", async () => {
  const output = await runHistoryCommand(["list-sessions"]);
  return JSON.parse(output || "[]");
});

ipcMain.handle("core:history:events", async (_event, sessionId: number) => {
  const output = await runHistoryCommand(["list-events", String(sessionId)]);
  return JSON.parse(output || "[]");
});

const runHistoryCommand = (args: string[]) => {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn("python3", ["-m", "cli_harness.history_cli", ...args], {
      env: {
        ...process.env,
        PYTHONPATH: getPythonPath()
      }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || "history command failed"));
      }
    });
  });
};

app.whenReady().then(() => {
  createWindow();
  bridge.start();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  bridge.stop();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
