import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { TrayPopover } from "./TrayPopover.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

// The tray mini-player popover loads this exact same bundle in its own window (see
// create-tray-popover-window.ts), distinguished only by this URL hash — avoids
// standing up a second electron-vite renderer entry point purely for one small view.
const RootComponent = window.location.hash === "#tray-popover" ? TrayPopover : App;

createRoot(container).render(<RootComponent />);
