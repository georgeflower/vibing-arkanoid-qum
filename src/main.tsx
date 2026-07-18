import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clean up legacy PWA service workers + caches (see public/sw.js kill-switch)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      regs.forEach((reg) => reg.unregister());
    })
    .catch(() => {});
  if ("caches" in window) {
    caches
      .keys()
      .then((keys) => keys.forEach((k) => caches.delete(k)))
      .catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(<App />);
