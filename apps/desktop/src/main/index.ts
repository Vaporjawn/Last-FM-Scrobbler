import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";

const dirname = fileURLToPath(new URL(".", import.meta.url));

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: join(dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(join(dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
