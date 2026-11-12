import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { InvestigationView } from "./app/InvestigationView";

const container = document.getElementById("root");
if (!container) throw new Error("The root element is missing.");

createRoot(container).render(
  <StrictMode>
    <InvestigationView />
  </StrictMode>,
);
