import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ConcurrentUpdateNotice from "./components/ConcurrentUpdateNotice";
import ErrorBoundary from "./components/ErrorBoundary";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("アプリケーションの描画先が見つかりません。");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <ConcurrentUpdateNotice />
      <PwaUpdatePrompt />
    </ErrorBoundary>
  </StrictMode>,
);

