/**
 * Settings card: connect this site to the local Sean agent (production builds only; see services/agentConnection.ts).
 *
 * The first request to the agent is made only after the user clicks Connect, as Local Network Access requires. Pairing uses
 * the code the agent shows in its own window. In development the Vite proxy is used and this card is not shown.
 */
import { useEffect, useState } from "react";
import {
  agentBaseUrl,
  agentFetch,
  clearToken,
  completePairing,
  getAgentStatus,
  loopbackPermission,
  readToken,
  startPairing,
  type LoopbackPermission,
} from "../../services/agentConnection";

type Phase = "idle" | "working" | "code" | "paired";

export interface AgentConnectionProps {
  dev?: boolean;
  fetchImpl?: typeof fetch;
  permission?: () => Promise<LoopbackPermission>;
  /** Called after Connect or Pair succeeds, so the app reloads what the agent refused before pairing. */
  onPaired?: () => void;
}

const DENIED = "This site is blocked from connecting to your device. Allow \"Local network\" or \"Loopback network\" access for this site in the browser's site settings, then try again.";

export function AgentConnection({ dev = import.meta.env.DEV, fetchImpl = agentFetch, permission = loopbackPermission, onPaired }: AgentConnectionProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const base = agentBaseUrl(dev);

  useEffect(() => {
    if (dev) return;
    let active = true;
    // Check silently only when this browser session has already paired (it holds a token, so the user has connected before);
    // otherwise wait for a click.
    void permission().then(async (state) => {
      if (!active) return;
      if (state === "denied") {
        setMessage(DENIED);
        return;
      }
      if (!readToken()) return;
      const status = await getAgentStatus(fetchImpl, base);
      if (active && status.ok && status.value.paired) setPhase("paired");
    });
    return () => {
      active = false;
    };
  }, [dev, fetchImpl, permission, base]);

  if (dev) return null;

  const connect = async (): Promise<void> => {
    setPhase("working");
    setMessage("");
    const status = await getAgentStatus(fetchImpl, base);
    if (!status.ok) {
      setPhase("idle");
      setMessage((await permission()) === "denied" ? DENIED : status.message);
      return;
    }
    if (status.value.paired) {
      setPhase("paired");
      onPaired?.();
      return;
    }
    const started = await startPairing(fetchImpl, base);
    if (!started.ok) {
      setPhase("idle");
      setMessage(started.message);
      return;
    }
    setCode("");
    setPhase("code");
    setMessage(`Enter the code shown in the Sean agent window. It is valid for ${Math.round(started.value / 60)} minutes.`);
  };

  const submit = async (): Promise<void> => {
    setPhase("working");
    const done = await completePairing(code, fetchImpl, base);
    if (done.ok) {
      setPhase("paired");
      setMessage("");
      onPaired?.();
      return;
    }
    // A wrong code keeps the field; a locked or expired pairing starts over.
    setPhase(done.code === "PAIRING_CODE_INVALID" ? "code" : "idle");
    setMessage(done.message);
  };

  const disconnect = (): void => {
    clearToken();
    setPhase("idle");
    setMessage("Disconnected in this browser. To revoke every pairing, restart the Sean agent.");
  };

  return (
    <section className="sx-card" aria-labelledby="agent-heading" data-testid="agent-connection">
      <h2 className="sx-h2" id="agent-heading">Sean agent</h2>
      <p className="sx-muted" style={{ marginTop: 0 }}>
        Investigations run on your computer, in the Sean agent. This site connects to it at 127.0.0.1 after you pair it once per
        browser session. The game works without it.
      </p>
      {phase === "paired" ? (
        <p>
          <span data-testid="agent-state">Connected to the Sean agent.</span>{" "}
          <button type="button" className="sx-btn sx-btn-quiet" onClick={disconnect} data-testid="agent-disconnect">Disconnect</button>
        </p>
      ) : phase === "code" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}
        >
          <label className="sx-label" htmlFor="agent-code">Pairing code</label>
          <input id="agent-code" className="sx-input" value={code} onChange={(event) => setCode(event.target.value)} maxLength={16} autoComplete="off" data-testid="agent-code" />
          <button type="submit" className="sx-btn sx-btn-primary" disabled={code.trim() === ""} data-testid="agent-pair">Pair</button>
        </form>
      ) : (
        <button type="button" className="sx-btn" onClick={() => void connect()} disabled={phase === "working"} data-testid="agent-connect">
          {phase === "working" ? "Connecting…" : "Connect to the Sean agent"}
        </button>
      )}
      <p role="status" className="sx-faint" data-testid="agent-status">{message}</p>
    </section>
  );
}
