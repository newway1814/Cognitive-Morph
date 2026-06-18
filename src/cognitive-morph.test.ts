import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CognitiveMorph } from "./index";
import fs from "node:fs";
import path from "node:path";

const cssText = fs.readFileSync(path.resolve(__dirname, "cognitive-morph.css"), "utf8");

// --- Test seam: mock Worker that tracks addEventListener/removeEventListener ---

function createMockWorker() {
  const listeners = new Map<string, Set<EventListener>>();

  return Object.assign(
    {
      postMessage: vi.fn(),
      addEventListener: vi.fn((type: string, fn: EventListener) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: EventListener) => {
        listeners.get(type)?.delete(fn);
      }),
      terminate: vi.fn(),
    } as unknown as Worker,
    {
      /** Simulate the worker posting a message back to the main thread */
      _emit(type: string, data: unknown) {
        const event = new MessageEvent(type, { data });
        listeners.get(type)?.forEach((fn) => fn(event));
      },
    },
  );
}

// --- Tests ---

describe("CognitiveMorph SDK bootstrap", () => {
  let mockWorker: ReturnType<typeof createMockWorker>;
  let cm: CognitiveMorph;

  beforeEach(() => {
    mockWorker = createMockWorker();
    cm = new CognitiveMorph({ worker: mockWorker });
  });

  it("can be instantiated with a custom mock worker", () => {
    expect(cm).toBeInstanceOf(CognitiveMorph);
  });

  it("boot() binds worker listener, destroy() unbinds it (no leaks)", () => {
    const spy = vi.fn();
    cm.onMorphModeChange(spy);
    cm.boot();

    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });
    expect(spy).toHaveBeenCalledTimes(1);

    cm.destroy();
    spy.mockClear();

    mockWorker._emit("message", { type: "morphModeChange", morphMode: "skimming" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("worker telemetry message triggers onMorphModeChange and updates currentMorphMode", () => {
    const receivedMorphModes: string[] = [];
    cm.onMorphModeChange((morphMode) => receivedMorphModes.push(morphMode));
    cm.boot();

    expect(cm.currentMorphMode).toBeNull();

    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });
    expect(receivedMorphModes).toEqual(["focus-reading"]);
    expect(cm.currentMorphMode).toBe("focus-reading");

    mockWorker._emit("message", { type: "morphModeChange", morphMode: "fatigue-mitigation" });
    expect(receivedMorphModes).toEqual(["focus-reading", "fatigue-mitigation"]);
    expect(cm.currentMorphMode).toBe("fatigue-mitigation");

    cm.destroy();
  });
});

describe("Declarative Markup & Global CSS State Toggling", () => {
  let mockWorker: ReturnType<typeof createMockWorker>;
  let cm: CognitiveMorph;

  beforeEach(() => {
    document.body.className = "";
    mockWorker = createMockWorker();
    cm = new CognitiveMorph({ worker: mockWorker });
    cm.boot();
  });

  afterEach(() => {
    cm.destroy();
  });

  it("applies cm-mode-* class to body on Morph Mode change", () => {
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });

    expect(document.body.classList.contains("cm-mode-focus-reading")).toBe(true);
  });

  it("enforces Single Active Morph Mode Invariant — removes previous mode class", () => {
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "skimming" });

    expect(document.body.classList.contains("cm-mode-skimming")).toBe(true);
    expect(document.body.classList.contains("cm-mode-focus-reading")).toBe(false);
  });

  it("destroy() removes active Morph Mode class from body", () => {
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "fatigue-mitigation" });
    expect(document.body.classList.contains("cm-mode-fatigue-mitigation")).toBe(true);

    cm.destroy();

    expect(document.body.classList.contains("cm-mode-fatigue-mitigation")).toBe(false);
    expect(document.body.className).toBe("");
  });

  it("CSS custom properties resolve to correct values per Morph Mode", () => {
    // Inject the SDK stylesheet as inline <style> (JSDOM resolves inline styles)
    const style = document.createElement("style");
    style.textContent = cssText;
    document.head.appendChild(style);

    // Create declarative markup
    const main = document.createElement("article");
    main.setAttribute("data-morph", "main");
    const peripheral = document.createElement("aside");
    peripheral.setAttribute("data-morph", "peripheral");
    document.body.appendChild(main);
    document.body.appendChild(peripheral);

    // Trigger Focus Reading Morph Mode
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });

    // Verify custom properties on peripheral element
    const peripheralStyles = getComputedStyle(peripheral);
    expect(peripheralStyles.getPropertyValue("--cm-opacity").trim()).toBe("0.1");

    // Verify custom properties on main element
    const mainStyles = getComputedStyle(main);
    expect(mainStyles.getPropertyValue("--cm-font-size").trim()).not.toBe("");

    // Cleanup injected DOM
    main.remove();
    peripheral.remove();
    style.remove();
  });
});
