import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CognitiveMorph } from "./index";
import fs from "node:fs";
import path from "node:path";

const cssText = fs.readFileSync(path.resolve(__dirname, "cognitive-morph.css"), "utf8");

vi.stubGlobal("scrollTo", vi.fn());

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

describe("Telemetry Fallback Engine", () => {
  let mockWorker: ReturnType<typeof createMockWorker>;
  let cm: CognitiveMorph;

  beforeEach(() => {
    mockWorker = createMockWorker();
    cm = new CognitiveMorph({ worker: mockWorker });
  });

  afterEach(() => {
    cm.destroy();
  });

  it("binds event listeners to window for mousemove, scroll, keydown on boot, and removes them on destroy", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    cm.boot();

    expect(addSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    cm.destroy();

    expect(removeSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("infers Skimming state and transitions to skimming mode when high-velocity mouse movements are sustained for 2 seconds", () => {
    vi.useFakeTimers();
    cm.boot();

    expect(cm.currentMorphMode).not.toBe("skimming");

    // Simulate high-velocity mouse movements (e.g. 150px per 100ms = 1500px/s) over 2.5 seconds
    let x = 0;
    for (let i = 0; i < 25; i++) {
      vi.advanceTimersByTime(100);
      x += 150;
      const event = new MouseEvent("mousemove", { clientX: x, clientY: 0 });
      window.dispatchEvent(event);
    }

    expect(cm.currentMorphMode).toBe("skimming");
    vi.useRealTimers();
  });

  it("infers Skimming state and transitions to skimming mode when high-speed scrolling is sustained for 2 seconds", () => {
    vi.useFakeTimers();
    cm.boot();

    expect(cm.currentMorphMode).not.toBe("skimming");

    // Simulate rapid scroll (e.g., 500px per 100ms = 5000px/s) over 2.5 seconds
    let currentScroll = 0;
    const originalScrollY = window.scrollY;

    for (let i = 0; i < 25; i++) {
      vi.advanceTimersByTime(100);
      currentScroll += 500;
      Object.defineProperty(window, "scrollY", {
        value: currentScroll,
        writable: true,
        configurable: true,
      });
      const event = new Event("scroll");
      window.dispatchEvent(event);
    }

    // It should be deferred during active scrolling
    expect(cm.currentMorphMode).not.toBe("skimming");

    // Wait 500ms for the scroll pause Layout Reflow Anchor
    vi.advanceTimersByTime(500);

    expect(cm.currentMorphMode).toBe("skimming");

    // Restore scrollY
    Object.defineProperty(window, "scrollY", {
      value: originalScrollY,
      writable: true,
      configurable: true,
    });
    vi.useRealTimers();
  });

  it("infers Focus state and transitions to focus-reading mode when normal scrolling/interaction occurs over 2 seconds", () => {
    vi.useFakeTimers();
    cm.boot();

    expect(cm.currentMorphMode).not.toBe("focus-reading");

    // Simulate keydown event every 100ms for 2.5 seconds (prevents idle fatigue, but keeps velocity low)
    for (let i = 0; i < 25; i++) {
      vi.advanceTimersByTime(100);
      const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
      window.dispatchEvent(event);
    }

    expect(cm.currentMorphMode).toBe("focus-reading");
    vi.useRealTimers();
  });

  it("infers Fatigue state and transitions to fatigue-mitigation mode when extreme input inactivity exceeds 3 seconds", () => {
    vi.useFakeTimers();
    cm.boot();

    expect(cm.currentMorphMode).not.toBe("fatigue-mitigation");

    // Wait 6.5 seconds with no events at all (3s for idle to count, 3s for Fatigue state debounce hold, + 500ms buffer)
    vi.advanceTimersByTime(6500);

    expect(cm.currentMorphMode).toBe("fatigue-mitigation");
    vi.useRealTimers();
  });

  it("deactivates fallback engine when camera telemetry is active, and reactivates it when camera is lost", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    cm.boot(); // binds fallback listeners because cameraActive is false initially

    expect(addSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
    addSpy.mockClear();
    removeSpy.mockClear();

    // Set camera active
    cm.setCameraActive(true);
    expect(removeSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
    addSpy.mockClear();
    removeSpy.mockClear();

    // Set camera inactive
    cm.setCameraActive(false);
    expect(addSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe("Layout Reflow Anchors & Scroll Anchoring", () => {
  let mockWorker: ReturnType<typeof createMockWorker>;
  let cm: CognitiveMorph;

  beforeEach(() => {
    mockWorker = createMockWorker();
    cm = new CognitiveMorph({ worker: mockWorker });
  });

  afterEach(() => {
    cm.destroy();
  });

  it("blocks and defers Morph Mode changes while the user is actively scrolling, then applies after pause", () => {
    vi.useFakeTimers();
    cm.boot();

    expect(cm.currentMorphMode).toBeNull();

    // Simulate active scrolling
    const scrollEvent = new Event("scroll");
    window.dispatchEvent(scrollEvent);

    // Trigger a mode change via telemetry message
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });

    // Verify that the morph mode remains null because the transition is deferred
    expect(cm.currentMorphMode).toBeNull();

    // Advance timer by 499ms - should still be pending
    vi.advanceTimersByTime(499);
    expect(cm.currentMorphMode).toBeNull();

    // Advance by 1ms (total 500ms pause) - should trigger reflow anchor
    vi.advanceTimersByTime(1);
    expect(cm.currentMorphMode).toBe("focus-reading");

    vi.useRealTimers();
  });

  it("applies pending Morph Mode immediately when a telemetry event reports an extendedBlink pause", () => {
    vi.useFakeTimers();
    cm.boot();

    expect(cm.currentMorphMode).toBeNull();

    // Simulate active scrolling to queue/block the transition
    const scrollEvent = new Event("scroll");
    window.dispatchEvent(scrollEvent);

    // Queue a mode change
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });
    expect(cm.currentMorphMode).toBeNull();

    // Emit an extended blink event
    mockWorker._emit("message", { type: "extendedBlink" });

    // It should apply immediately without waiting for scroll timer
    expect(cm.currentMorphMode).toBe("focus-reading");

    vi.useRealTimers();
  });

  it("blocks transitions during active eye movement and applies them when eye movement stops", () => {
    cm.boot();

    expect(cm.currentMorphMode).toBeNull();

    // Emit gaze telemetry with eyeMovement = true
    mockWorker._emit("message", { type: "gazeUpdate", eyeMovement: true });

    // Queue a morph mode change
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "skimming" });

    // Verify it is blocked
    expect(cm.currentMorphMode).toBeNull();

    // Emit gaze telemetry with eyeMovement = false
    mockWorker._emit("message", { type: "gazeUpdate", eyeMovement: false });

    // Verify it is applied immediately now that eye movement stopped
    expect(cm.currentMorphMode).toBe("skimming");
  });

  it("applies Scroll Anchoring scroll compensation relative to data-morph='main' target element", () => {
    cm.boot();

    // Create target element
    const mainEl = document.createElement("article");
    mainEl.setAttribute("data-morph", "main");
    document.body.appendChild(mainEl);

    // Mock initial scrollY
    const originalScrollY = window.scrollY;
    Object.defineProperty(window, "scrollY", {
      value: 200,
      writable: true,
      configurable: true,
    });

    // Mock getBoundingClientRect call sequence
    let callCount = 0;
    const getBoundingClientRectSpy = vi.spyOn(mainEl, "getBoundingClientRect").mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Before transition: top is 100px from viewport
        return { top: 100 } as DOMRect;
      } else {
        // After transition: top is 150px from viewport (layout shifted down by 50px)
        return { top: 150 } as DOMRect;
      }
    });

    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    // Trigger transition
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });

    // We expect window.scrollTo to be called to adjust the scroll by +50px (new scrollY = 250)
    expect(scrollToSpy).toHaveBeenCalledWith(window.scrollX, 250);

    // Cleanup
    mainEl.remove();
    getBoundingClientRectSpy.mockRestore();
    scrollToSpy.mockRestore();
    Object.defineProperty(window, "scrollY", {
      value: originalScrollY,
      writable: true,
      configurable: true,
    });
  });

  it("does not block transitions when scroll events are triggered programmatically by scroll anchoring", () => {
    cm.boot();

    // Create target element
    const mainEl = document.createElement("article");
    mainEl.setAttribute("data-morph", "main");
    document.body.appendChild(mainEl);

    // Mock getBoundingClientRect to trigger scroll compensation
    let callCount = 0;
    const getBoundingClientRectSpy = vi.spyOn(mainEl, "getBoundingClientRect").mockImplementation(() => {
      callCount++;
      return { top: callCount === 1 ? 100 : 150 } as DOMRect;
    });

    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {
      // Simulate browser firing scroll event synchronously in response to scrollTo
      const scrollEvent = new Event("scroll");
      window.dispatchEvent(scrollEvent);
    });

    // Trigger first transition to focus-reading
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });
    expect(cm.currentMorphMode).toBe("focus-reading");

    // Trigger second transition immediately to skimming
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "skimming" });

    // It should NOT be blocked by the scroll event from scroll anchoring
    expect(cm.currentMorphMode).toBe("skimming");

    // Cleanup
    mainEl.remove();
    getBoundingClientRectSpy.mockRestore();
    scrollToSpy.mockRestore();
  });
});
