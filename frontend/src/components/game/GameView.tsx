/**
 * The first-person game inside the interlude (Spec 4 section 11; Requirement 7).
 *
 * This component owns the browser side of the game: the canvas, the animation loop, input listeners, pointer lock and
 * fullscreen. The rules live in features/game/world.ts. The interlude tells it which phase it is in and it reports back with
 * callbacks; it never touches the report. When it unmounts, for any reason, the loop is cancelled, every listener is removed,
 * the pointer is released and every GPU resource is freed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../../features/interlude/gameApi";
import { GameInput, MOUSE_SENSITIVITY } from "../../features/game/input";
import type { GameRenderer } from "../../features/game/renderer";
import { NO_INPUT, createWorld, step, nearHidingPlace, threatInfo, toggleFlashlight, toggleHiding, type GameEvent, type World } from "../../features/game/world";
import { LEVEL } from "../../features/game/level";
import { buildClues } from "../../features/game/clues";
import type { ClueRecord } from "../../features/game/clues";

interface Hud {
  collected: number;
  total: number;
  last: ClueRecord | null;
  gateOpen: boolean;
  threat: "none" | "near" | "hunting";
  flashlight: boolean;
  /** Inside a hiding place. */
  hidden: boolean;
  /** A hiding place is within reach. */
  canHide: boolean;
}

const CLASSIFICATION_TEXT: Record<string, string> = {
  DOCUMENTED: "DOCUMENTED",
  INFERRED: "INFERRED",
  PARTIAL_EVIDENCE: "PARTIAL EVIDENCE",
};

const TENSION_INTERVAL = 0.1;

function coarsePointerOnly(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches;
}

export function GameView(props: GameProps) {
  const { phase, attempt } = props;
  const propsRef = useRef(props);
  propsRef.current = props;

  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const worldRef = useRef<World | null>(null);
  const inputRef = useRef<GameInput | null>(null);
  const pausedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Whether the browser has the mouse captured for mouse look. Releasing it (Esc, in the browser) does not pause the game.
  const [mouseLocked, setMouseLocked] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback((text: string): void => setAnnouncement((previous) => (previous === text ? `${text}\u00a0` : text)), []);
  const [hud, setHud] = useState<Hud>({ collected: 0, total: 0, last: null, gateOpen: false, threat: "none", flashlight: true, hidden: false, canHide: false });
  const primaryRef = useRef<HTMLButtonElement>(null);
  // Only a report that has real evidence lends the game real clues. A report without any (or no report) gives atmosphere only.
  /** A click on the picture takes the mouse for mouse look, while the game is being played. */
  const captureMouse = (): void => {
    const canvas = rendererRef.current?.canvas;
    if (canvas && phase === "GAME_ACTIVE" && !pausedRef.current) requestLock(canvas);
  };
  const fromReport = useMemo(() => buildClues(props.snapshot).some((clue) => clue.kind === "EVIDENCE"), [props.snapshot]);

  const setPausedBoth = useCallback((value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
  }, []);

  // The renderer lives as long as the component. Three.js is loaded only now, so the rest of the app does not pay for it.
  useEffect(() => {
    let cancelled = false;
    if (coarsePointerOnly()) {
      setUnsupported("This game needs a keyboard. Your report is opening instead.");
      propsRef.current.onFailed();
      return;
    }
    const onContextLost = (event: Event): void => {
      event.preventDefault();
      setUnsupported("The graphics context was lost. Your report is opening instead.");
      propsRef.current.onFailed();
    };
    void (async () => {
      try {
        const { GameRenderer } = await import("../../features/game/renderer");
        if (cancelled || !containerRef.current) return;
        // The renderer frees what it built if its constructor fails.
        const renderer = new GameRenderer(containerRef.current, LEVEL, propsRef.current.quality);
        rendererRef.current = renderer;
        renderer.canvas.addEventListener("webglcontextlost", onContextLost);
        setReady(true);
      } catch {
        if (cancelled) return;
        setUnsupported("This browser could not start 3D graphics (WebGL). Your report is opening instead.");
        propsRef.current.onFailed();
      }
    })();
    return () => {
      cancelled = true;
      inputRef.current?.detach();
      inputRef.current = null;
      if (document.pointerLockElement) document.exitPointerLock?.();
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
      rendererRef.current?.canvas.removeEventListener("webglcontextlost", onContextLost);
      rendererRef.current?.dispose();
      rendererRef.current = null;
      worldRef.current = null;
    };
  }, []);

  // A new world for each attempt.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!ready || !renderer) return;
    const world = createWorld(propsRef.current.snapshot, propsRef.current.intensity, LEVEL, attempt);
    worldRef.current = world;
    renderer.resetView();
    renderer.setJumpscare(propsRef.current.jumpscare);
    renderer.setClues(world);
    renderer.resize();
    renderer.render(world, 0, propsRef.current.reducedMotion);
    setPausedBoth(false);
    setHud({ collected: 0, total: world.clues.length, last: null, gateOpen: false, threat: "none", flashlight: true, hidden: false, canHide: false });
    rootRef.current?.style.setProperty("--vignette-stop", "48%");
    setAnnouncement("");
  }, [ready, attempt, setPausedBoth]);

  // The scare setting can change between attempts, from the first screen.
  useEffect(() => {
    rendererRef.current?.setJumpscare(props.jumpscare);
  }, [ready, props.jumpscare]);

  // Keep the picture the right size.
  useEffect(() => {
    const container = containerRef.current;
    if (!ready || !container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      // Resizing clears the canvas. Draw once so a paused or waiting game does not show a blank screen.
      rendererRef.current?.resize();
      const world = worldRef.current;
      if (world) rendererRef.current?.render(world, 0, propsRef.current.reducedMotion);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    const onChange = (): void => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Input exists only while the game is being played.
  useEffect(() => {
    const canvas = rendererRef.current?.canvas;
    if (!ready || phase !== "GAME_ACTIVE" || !canvas) return;
    const input = new GameInput(
      {
        isPaused: () => pausedRef.current,
        onFlashlight: () => {
          const world = worldRef.current;
          if (!world || pausedRef.current || world.status !== "PLAYING") return;
          const event = toggleFlashlight(world);
          propsRef.current.onEvent?.(event);
          if (event.type === "FLASHLIGHT") setHud((h) => ({ ...h, flashlight: event.on }));
        },
        onInteract: () => {
          const world = worldRef.current;
          if (!world || pausedRef.current || world.status !== "PLAYING") return;
          for (const event of toggleHiding(world)) {
            propsRef.current.onEvent?.(event);
            if (event.type === "HIDING") {
              setHud((h) => ({ ...h, hidden: event.hidden }));
              announce(event.hidden ? "You are hiding. Stay still and quiet. Press E or move to come out." : "You came out of hiding.");
            }
          }
        },
        onPause: () => {
          const next = !pausedRef.current;
          setPausedBoth(next);
          if (next) {
            if (document.pointerLockElement) document.exitPointerLock?.();
          } else {
            requestLock(canvas);
          }
        },
        onLook: (dx, dy) => {
          const world = worldRef.current;
          if (!world || pausedRef.current || world.status !== "PLAYING") return;
          world.player.yaw += dx * MOUSE_SENSITIVITY;
          rendererRef.current?.addPitch(-dy * MOUSE_SENSITIVITY);
        },
      },
      canvas,
    );
    inputRef.current = input;
    input.attach();
    const onLockChange = (): void => setMouseLocked(document.pointerLockElement === canvas);
    // The creature does not wait for a player who has looked away: a hidden tab or a window that lost focus pauses the game.
    const onAway = (): void => setPausedBoth(true);
    const onHidden = (): void => {
      if (document.hidden) onAway();
    };
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onAway);
    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onAway);
      input.detach();
      if (inputRef.current === input) inputRef.current = null;
    };
  }, [ready, phase, setPausedBoth]);

  // The animation loop: stepping the world while playing, drawing while playing or while the catch plays out.
  useEffect(() => {
    if (!ready || (phase !== "GAME_ACTIVE" && phase !== "PLAYER_CAUGHT") || paused) return;
    let frame = 0;
    let last = performance.now();
    let sinceTension = 0;
    const handle = (event: GameEvent): void => {
      const p = propsRef.current;
      p.onEvent?.(event);
      if (event.type === "CLUE_COLLECTED") {
        setHud((h) => ({ ...h, collected: event.collected, last: event.clue }));
        announce(`Clue ${event.collected} of ${event.total} found: ${event.clue.label}`);
      } else if (event.type === "GATE_OPENED") {
        setHud((h) => ({ ...h, gateOpen: true }));
        announce("The gate is open. Find the green exit.");
      } else if (event.type === "MONSTER_STATE") {
        const threat = event.state === "PURSUING" || event.state === "ATTACKING" ? "hunting" : "none";
        setHud((h) => (h.threat === threat ? h : { ...h, threat }));
        if (threat === "hunting") announce("The creature has seen you. Run.");
        else if (event.previous === "PURSUING") announce("You lost it. Stay quiet.");
      } else if (event.type === "HIDING") {
        setHud((h) => (h.hidden === event.hidden ? h : { ...h, hidden: event.hidden }));
      } else if (event.type === "CAUGHT") {
        setHud((h) => (h.hidden ? { ...h, hidden: false } : h));
        p.onCaught();
      } else if (event.type === "ESCAPED") {
        setHud((h) => (h.hidden ? { ...h, hidden: false } : h));
        p.onEscaped();
      }
    };
    const tick = (now: number): void => {
      const world = worldRef.current;
      const renderer = rendererRef.current;
      if (!world || !renderer) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (phase === "GAME_ACTIVE" && world.status === "PLAYING") {
        const input = inputRef.current?.read() ?? NO_INPUT;
        for (const event of step(world, input, dt)) handle(event);
        sinceTension += dt;
        if (sinceTension >= TENSION_INTERVAL) {
          sinceTension = 0;
          const info = threatInfo(world);
          const level = info.level;
          propsRef.current.onThreat?.(info);
          const hunting = world.monster.state === "PURSUING" || world.monster.state === "ATTACKING";
          rootRef.current?.style.setProperty("--vignette-stop", hunting ? "40%" : "48%");
          const canHide = nearHidingPlace(world);
          setHud((h) => {
            const threat = h.threat === "hunting" ? "hunting" : level > 0.6 ? "near" : "none";
            return threat === h.threat && canHide === h.canHide ? h : { ...h, threat, canHide };
          });
        }
      }
      renderer.render(world, dt, propsRef.current.reducedMotion);
      // Plain attributes (not React state) so the browser tests can follow the game without a back door into it.
      const root = rootRef.current;
      if (root) {
        root.dataset.player = `${world.player.pos.x.toFixed(2)},${world.player.pos.y.toFixed(2)},${world.player.yaw.toFixed(3)}`;
        root.dataset.monster = world.monster.state;
        root.dataset.monsterAt = `${world.monster.pos.x.toFixed(2)},${world.monster.pos.y.toFixed(2)}`;
        root.dataset.status = world.status;
        root.dataset.hidden = String(world.player.hidden);
        root.dataset.canhide = String(nearHidingPlace(world));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, phase, paused]);

  // The pointer must be free whenever a menu needs the mouse: after a catch, the buttons would otherwise be unreachable.
  useEffect(() => {
    if (phase !== "GAME_ACTIVE" && document.pointerLockElement) document.exitPointerLock?.();
  }, [phase]);

  // Keep keyboard focus on the main choice of the current screen.
  useEffect(() => {
    primaryRef.current?.focus();
  }, [phase, paused, ready, unsupported]);

  const begin = (): void => {
    const canvas = rendererRef.current?.canvas;
    if (canvas) requestLock(canvas);
    props.onReady();
  };
  const resume = (): void => {
    const canvas = rendererRef.current?.canvas;
    if (canvas) requestLock(canvas);
    setPausedBoth(false);
  };
  const toggleFullscreen = (): void => {
    // The whole interlude overlay goes full screen, so its notice and the skip button stay on screen.
    const container = rootRef.current?.closest<HTMLElement>(".il-overlay") ?? rootRef.current;
    if (!container) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void container.requestFullscreen?.().catch(() => undefined);
  };

  const threatText = hud.threat === "hunting" ? "The creature is hunting you." : hud.threat === "near" ? "Something is near." : "";

  return (
    <div className="gm-root" ref={rootRef} data-testid="game" data-phase={phase} data-attempt={attempt} data-paused={paused} data-reduced={props.reducedMotion}>
      <div className="gm-canvas" ref={containerRef} onClick={captureMouse} />
      <div className="gm-vignette" aria-hidden="true" data-testid="vignette" />
      <div className="gm-grain" aria-hidden="true" data-testid="film-grain" />
      {ready && phase === "GAME_ACTIVE" && !paused && !mouseLocked ? (
        <div className="gm-mouse-hint" role="note" data-testid="mouse-hint">
          <p className="gm-mouse-title">Look with the mouse</p>
          <p>Click the picture to take the mouse. The arrow keys also turn you, and the game keeps running.</p>
          <p className="gm-mouse-sub"><kbd>Esc</kbd> pauses the game.</p>
        </div>
      ) : null}
      {hud.hidden && phase === "GAME_ACTIVE" ? <div className="gm-slit" aria-hidden="true" data-testid="hiding-view" /> : null}

      {unsupported ? (
        <div className="gm-card" role="alert" data-testid="game-unsupported">
          <p>{unsupported}</p>
        </div>
      ) : null}

      {ready && phase !== "GAME_INITIALIZATION" ? (
        <div className="gm-hud" data-testid="hud">
          <p className="gm-counter" data-testid="clue-counter">Clues {hud.collected} / {hud.total}</p>
          <p className="gm-objective">{hud.gateOpen ? "The gate is open. Find the green exit." : "Find every clue to open the gate."}</p>
          <p className="gm-flash" data-testid="flashlight-status">Flashlight {hud.flashlight ? "on" : "off"} (F)</p>
          {hud.hidden ? <p className="gm-hint" data-testid="hide-hint">Hiding. Stay still. Press E or move to come out. If it saw you go in, it knows.</p> : hud.canHide ? <p className="gm-hint" data-testid="hide-hint">Press E to hide here.</p> : null}
          <p className="gm-threat" data-testid="threat" data-level={hud.threat}>{threatText}</p>
          {hud.last ? (
            <div className="gm-clue" data-testid="last-clue">
              <span className="gm-clue-kind" data-kind={hud.last.kind}>
                {hud.last.kind === "EVIDENCE" ? CLASSIFICATION_TEXT[hud.last.classification ?? ""] ?? "EVIDENCE" : "ATMOSPHERE · not evidence"}
              </span>
              <span className="gm-clue-text"><bdi>{hud.last.label}</bdi></span>
              {hud.last.detail ? <span className="gm-clue-detail"><bdi>{hud.last.detail}</bdi></span> : null}
            </div>
          ) : null}
          <button type="button" className="gm-small" onClick={toggleFullscreen} data-testid="fullscreen">
            {fullscreen ? "Leave full screen" : "Full screen"}
          </button>
        </div>
      ) : null}

      <p className="visually-hidden" role="status" aria-live="polite" data-testid="game-announcer">{announcement}</p>

      {ready && phase === "GAME_INITIALIZATION" ? (
        <div className="gm-card" role="group" aria-labelledby="gm-intro-title" data-testid="game-intro">
          <h2 id="gm-intro-title">{attempt > 1 ? "Try again" : "Something else is in this repository"}</h2>
          <p>Collect every clue to open the gate, then reach the green exit. Do not let it catch you. This is fiction and it never changes a report.</p>
          <p data-testid="game-clue-source">
            {fromReport
              ? "Some clues come from your latest report and keep the report's own labels. Torn archive tags are fiction and say so."
              : props.snapshot
                ? "Your latest report has no evidence to use here, so every clue is fiction and says so."
                : "This run is not tied to any report. Every clue is fiction and none comes from a repository."}
          </p>
          <ul className="gm-controls" aria-label="Controls">
            <li><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> move</li>
            <li>Mouse or <kbd>←</kbd> <kbd>→</kbd> look</li>
            <li><kbd>Shift</kbd> run (it hears you)</li>
            <li><kbd>F</kbd> flashlight</li>
            <li><kbd>E</kbd> hide in a locker, and come out</li>
            <li><kbd>Esc</kbd> pause</li>
          </ul>
          {props.scare ? (
            <p>
              <button type="button" className="gm-secondary" onClick={props.scare.onToggle} aria-pressed={props.scare.enabled} data-testid="game-scare">
                Scare when caught: {props.scare.enabled ? "on" : "off"}
              </button>
            </p>
          ) : null}
          {props.sound ? (
            <p>
              <button type="button" className="gm-secondary" onClick={props.sound.onToggle} aria-pressed={props.sound.enabled} data-testid="game-sound">
                Sound: {props.sound.enabled ? "on" : "off"}
              </button>
            </p>
          ) : null}
          <p className="gm-actions">
            <button type="button" className="gm-primary" onClick={begin} ref={primaryRef} data-testid="game-begin">Begin</button>
            <button type="button" className="gm-secondary" onClick={props.onQuit}>{props.standalone ? "Leave the game" : "Go to the report"}</button>
          </p>
        </div>
      ) : null}

      {ready && phase === "GAME_ACTIVE" && paused ? (
        <div className="gm-card" role="dialog" aria-modal="true" aria-label="Paused" data-testid="game-paused">
          <h2>Paused</h2>
          <p className="gm-actions">
            <button type="button" className="gm-primary" onClick={resume} ref={primaryRef} data-testid="game-resume">Resume</button>
            <button type="button" className="gm-secondary" onClick={props.onQuit} data-testid="game-quit">{props.standalone ? "Leave the game" : "Quit to the report"}</button>
          </p>
        </div>
      ) : null}

      {phase === "PLAYER_CAUGHT" ? (
        <>
          {props.jumpscare ? <div className="gm-whiteout" data-reduced={props.reducedMotion} aria-hidden="true" /> : null}
          {props.jumpscare ? <div className="gm-scare" data-testid="jumpscare" data-reduced={props.reducedMotion} aria-hidden="true" /> : null}
          <div className="gm-card gm-caught" data-scare={String(props.jumpscare)} role="alertdialog" aria-labelledby="gm-caught-title" data-testid="game-caught">
            <h2 id="gm-caught-title">You were caught</h2>
            <p>This is part of the fiction. Your report is unchanged.</p>
            <p className="gm-actions">
              <button type="button" className="gm-primary" onClick={props.onRetry} ref={primaryRef} data-testid="game-retry">Try again</button>
              <button type="button" className="gm-secondary" onClick={props.onGiveUp} data-testid="game-giveup">{props.standalone ? "Give up and leave" : "Give up and open the report"}</button>
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

function requestLock(canvas: HTMLCanvasElement): void {
  try {
    const result = canvas.requestPointerLock?.() as unknown;
    if (result instanceof Promise) result.catch(() => undefined);
  } catch {
    // Pointer lock is optional: the arrow keys turn the view.
  }
}

export const renderGame = (gameProps: GameProps): React.ReactNode => <GameView {...gameProps} />;
