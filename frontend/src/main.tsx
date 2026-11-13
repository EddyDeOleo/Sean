import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import "./styles/product.css";
import "./styles/interlude.css";
import "./styles/game.css";
import { App } from "./app/App";
import { renderGame } from "./components/game/GameView";

const container = document.getElementById("root");
if (!container) throw new Error("The root element is missing.");

createRoot(container).render(
  <StrictMode>
    <App renderGame={renderGame} />
  </StrictMode>,
);