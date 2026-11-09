import React from "react";
import { createRoot } from "react-dom/client";
import { WorkbenchProvider } from "./stores/workbench";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WorkbenchProvider>
      <WorkbenchPage />
    </WorkbenchProvider>
  </React.StrictMode>,
);
