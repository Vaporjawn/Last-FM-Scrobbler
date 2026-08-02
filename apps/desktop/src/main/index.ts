import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";

const dirname = fileURLToPath(new URL(".", import.meta.url));

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    // Don't paint the window until the renderer has produced its first frame —
    // avoids the blank/white-flash window Electron otherwise shows immediately, and
    // avoids compositing an empty window while the renderer is still starting up.
    show: false,
    webPreferences: {
      preload: join(dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron enables Chromium's Hunspell-based spellchecker by default, which
      // loads dictionary data and runs its own utility process. This app has no
      // free-text input surfaces, so there's nothing for it to check — skip the
      // memory and process overhead entirely rather than pay for a feature that
      // never triggers.
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(join(dirname, "../renderer/index.html"));
  }
}

void app.whenReady().then(() => {
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
