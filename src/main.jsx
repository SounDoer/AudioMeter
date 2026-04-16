import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { UI_PREFERENCES, applyUiPreferencesToDocument, readPersistedUiMode } from "./uiPreferences";

applyUiPreferencesToDocument(UI_PREFERENCES, readPersistedUiMode());

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
