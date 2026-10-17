// Must run before anything creates the Supabase client (it clears the reset link from the URL).
import "./lib/password-recovery";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
