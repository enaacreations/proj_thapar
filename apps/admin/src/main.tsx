import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "./theme";
import { ToastProvider } from "./ui";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element.");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      {/* Served from /admin/ in production, / in dev — Vite's BASE_URL is
          the one value that knows which, so the router follows it. */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
