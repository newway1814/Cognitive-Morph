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
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 0 });
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

  it("implements the calibration state machine and locks baseline averages after 10 seconds of camera activation", async () => {
    vi.useFakeTimers();

    const mockWorkerInstance = createMockWorker();
    const cm = new CognitiveMorph({ worker: mockWorkerInstance, transitionDurationMs: 0 });

    const morphModeSpy = vi.fn();
    cm.onMorphModeChange(morphModeSpy);
    cm.boot();

    await cm.setCameraActive(true);

    const widgetLabel = document.querySelector(".cm-status-label");
    const widgetIndicator = document.querySelector(".cm-status-indicator");
    expect(widgetLabel?.textContent).toBe("Calibrating 0%");
    expect(widgetIndicator?.classList.contains("cm-status-calibrating")).toBe(true);

    await vi.advanceTimersByTimeAsync(2000);
    mockWorkerInstance._emit("message", {
      type: "telemetry",
      eyeAperture: 0.4,
      blinkInterval: 4000,
      yaw: 10,
      pitch: 5,
      confidence: 1.0,
      morphMode: "focus-reading"
    });

    expect(widgetLabel?.textContent).toBe("Calibrating 20%");
    expect(cm.currentMorphMode).toBeNull();
    expect(morphModeSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3000);
    mockWorkerInstance._emit("message", {
      type: "telemetry",
      eyeAperture: 0.3,
      blinkInterval: 5000,
      yaw: 12,
      pitch: 7,
      confidence: 1.0
    });
    expect(widgetLabel?.textContent).toBe("Calibrating 50%");

    await vi.advanceTimersByTimeAsync(4900);
    mockWorkerInstance._emit("message", {
      type: "telemetry",
      eyeAperture: 0.5,
      blinkInterval: 3000,
      yaw: 8,
      pitch: 3,
      confidence: 1.0
    });
    expect(widgetLabel?.textContent).toBe("Calibrating 99%");

    await vi.advanceTimersByTimeAsync(200);
    mockWorkerInstance._emit("message", {
      type: "telemetry",
      eyeAperture: 0.4,
      blinkInterval: 4000,
      yaw: 10,
      pitch: 5,
      confidence: 1.0
    });

    expect(widgetLabel?.textContent).toBe("Active");
    expect(widgetIndicator?.classList.contains("cm-status-active")).toBe(true);

    expect((cm as any).baselineEyeAperture).toBeCloseTo(0.4);
    expect((cm as any).baselineBlinkInterval).toBeCloseTo(4000);
    expect((cm as any).baselineYaw).toBeCloseTo(10);
    expect((cm as any).baselinePitch).toBeCloseTo(5);

    mockWorkerInstance._emit("message", {
      type: "morphModeChange",
      morphMode: "focus-reading"
    });
    expect(cm.currentMorphMode).toBe("focus-reading");
    expect(morphModeSpy).toHaveBeenCalledWith("focus-reading");

    cm.destroy();
    vi.useRealTimers();
  });
});

describe("Declarative Markup & Global CSS State Toggling", () => {
  let mockWorker: ReturnType<typeof createMockWorker>;
  let cm: CognitiveMorph;

  beforeEach(() => {
    document.body.className = "";
    mockWorker = createMockWorker();
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 0 });
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
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 0 });
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
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 0 });
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

describe("Transition Preview Toast & User Override", () => {
  let mockWorker: ReturnType<typeof createMockWorker>;
  let cm: CognitiveMorph;

  beforeEach(() => {
    document.body.className = "";
    const toast = document.querySelector(".cm-transition-toast");
    if (toast) toast.remove();
    mockWorker = createMockWorker();
    cm = new CognitiveMorph({ worker: mockWorker });
  });

  afterEach(() => {
    cm.destroy();
    const toast = document.querySelector(".cm-transition-toast");
    if (toast) toast.remove();
  });

  it("displays transition preview toast in the DOM and defers the morph mode transition", () => {
    cm.boot();
    expect(document.querySelector(".cm-transition-toast")).toBeNull();
    expect(cm.currentMorphMode).toBeNull();

    // Trigger transition to focus-reading
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });

    // Toast element should be in the DOM
    const toast = document.querySelector(".cm-transition-toast");
    expect(toast).not.toBeNull();

    // Transition should be deferred (not applied yet)
    expect(cm.currentMorphMode).toBeNull();
    expect(document.body.classList.contains("cm-mode-focus-reading")).toBe(false);
  });

  it("updates the toast countdown text dynamically every second", () => {
    vi.useFakeTimers();
    // Re-create cm with custom 3000ms duration
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 3000 });
    cm.boot();

    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });

    const toast = document.querySelector(".cm-transition-toast");
    expect(toast).not.toBeNull();
    const textEl = toast!.querySelector(".cm-toast-text");
    expect(textEl?.textContent).toBe("Entering Focus Reading Mode in 3s...");

    // Advance by 1 second
    vi.advanceTimersByTime(1000);
    expect(textEl?.textContent).toBe("Entering Focus Reading Mode in 2s...");

    // Advance by another second
    vi.advanceTimersByTime(1000);
    expect(textEl?.textContent).toBe("Entering Focus Reading Mode in 1s...");

  });

  it("applies the morph mode and dismisses the toast when countdown completes", () => {
    vi.useFakeTimers();
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 3000 });
    cm.boot();

    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });
    
    expect(document.querySelector(".cm-transition-toast")).not.toBeNull();
    expect(cm.currentMorphMode).toBeNull();

    // Advance to completion (3000ms)
    vi.advanceTimersByTime(3000);

    // Toast should be dismissed
    expect(document.querySelector(".cm-transition-toast")).toBeNull();
    // Morph mode should be applied
    expect(cm.currentMorphMode).toBe("focus-reading");
    expect(document.body.classList.contains("cm-mode-focus-reading")).toBe(true);

  });

  it("cancels transition, dismisses toast, and keeps previous mode when Undo is clicked", () => {
    vi.useFakeTimers();
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 3000 });
    cm.boot();

    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });

    const toast = document.querySelector(".cm-transition-toast");
    expect(toast).not.toBeNull();
    const undoBtn = toast!.querySelector(".cm-toast-undo") as HTMLButtonElement;
    expect(undoBtn).not.toBeNull();

    // Click Undo
    undoBtn.click();

    // Toast should be removed immediately
    expect(document.querySelector(".cm-transition-toast")).toBeNull();
    expect(cm.currentMorphMode).toBeNull();

    // Advance 3000ms and verify it is NOT applied
    vi.advanceTimersByTime(3000);
    expect(cm.currentMorphMode).toBeNull();
    expect(document.body.classList.contains("cm-mode-focus-reading")).toBe(false);

  });

  it("cancels transition, dismisses toast, and keeps previous mode when cancelTransition() is called programmatically", () => {
    vi.useFakeTimers();
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 3000 });
    cm.boot();

    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });

    expect(document.querySelector(".cm-transition-toast")).not.toBeNull();

    // Call cancelTransition programmatically
    cm.cancelTransition();

    // Toast should be removed immediately
    expect(document.querySelector(".cm-transition-toast")).toBeNull();
    expect(cm.currentMorphMode).toBeNull();

    // Advance 3000ms and verify it is NOT applied
    vi.advanceTimersByTime(3000);
    expect(cm.currentMorphMode).toBeNull();
    expect(document.body.classList.contains("cm-mode-focus-reading")).toBe(false);

  });

  it("resets active transition and starts a new countdown if a different morph mode is queued", () => {
    vi.useFakeTimers();
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 3000 });
    cm.boot();

    // Trigger transition to focus-reading
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });
    
    let toast = document.querySelector(".cm-transition-toast");
    expect(toast).not.toBeNull();
    let textEl = toast!.querySelector(".cm-toast-text");
    expect(textEl?.textContent).toBe("Entering Focus Reading Mode in 3s...");

    // Advance 1000ms
    vi.advanceTimersByTime(1000);
    expect(textEl?.textContent).toBe("Entering Focus Reading Mode in 2s...");

    // Trigger transition to skimming
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "skimming" });

    // Toast should be recreated/updated and reset to 3s for Skimming Mode
    toast = document.querySelector(".cm-transition-toast");
    expect(toast).not.toBeNull();
    textEl = toast!.querySelector(".cm-toast-text");
    expect(textEl?.textContent).toBe("Entering Skimming Mode in 3s...");

    // Advance 3000ms
    vi.advanceTimersByTime(3000);

    // Skimming should be applied, focus-reading should not be applied
    expect(document.querySelector(".cm-transition-toast")).toBeNull();
    expect(cm.currentMorphMode).toBe("skimming");
    expect(document.body.classList.contains("cm-mode-skimming")).toBe(true);
    expect(document.body.classList.contains("cm-mode-focus-reading")).toBe(false);

  });

  it("transitions immediately and does not show toast when transitionDurationMs is 0", () => {
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 0 });
    cm.boot();

    mockWorker._emit("message", { type: "morphModeChange", morphMode: "focus-reading" });

    // Toast should not be in the DOM
    expect(document.querySelector(".cm-transition-toast")).toBeNull();
    // Morph mode should be applied immediately
    expect(cm.currentMorphMode).toBe("focus-reading");
    expect(document.body.classList.contains("cm-mode-focus-reading")).toBe(true);
  });
});

describe("Telemetry Status Widget & Hybrid Settings Persistence", () => {
  let mockWorker: ReturnType<typeof createMockWorker>;
  let cm: CognitiveMorph;

  beforeEach(() => {
    localStorage.clear();
    const widget = document.querySelector(".cm-status-widget");
    if (widget) widget.remove();
    mockWorker = createMockWorker();
    cm = new CognitiveMorph({ worker: mockWorker });
  });

  afterEach(() => {
    cm.destroy();
    const widget = document.querySelector(".cm-status-widget");
    if (widget) widget.remove();
    localStorage.clear();
  });

  it("renders the Telemetry Status Widget in the DOM on boot and removes it on destroy", () => {
    expect(document.querySelector(".cm-status-widget")).toBeNull();

    cm.boot();

    // Widget should be rendered
    const widget = document.querySelector(".cm-status-widget");
    expect(widget).not.toBeNull();

    cm.destroy();

    // Widget should be removed
    expect(document.querySelector(".cm-status-widget")).toBeNull();
  });

  it("restores paused state from localStorage on boot", () => {
    localStorage.setItem("cm-paused", "true");
    cm = new CognitiveMorph({ worker: mockWorker });

    // Before boot, it should not be active/read yet
    expect(cm.isPaused).toBe(false);

    cm.boot();

    expect(cm.isPaused).toBe(true);

    const checkbox = document.querySelector(".cm-status-widget input[type='checkbox']") as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(true);
  });

  it("restores manual Morph Mode lock from localStorage on boot", () => {
    localStorage.setItem("cm-manual-lock", "focus-reading");
    cm = new CognitiveMorph({ worker: mockWorker });

    expect(cm.manualLock).toBeNull();

    cm.boot();

    expect(cm.manualLock).toBe("focus-reading");
    expect(cm.currentMorphMode).toBe("focus-reading");
    expect(document.body.classList.contains("cm-mode-focus-reading")).toBe(true);

    const select = document.querySelector(".cm-status-widget select") as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe("focus-reading");

    // Telemetry messages should be blocked and not change the locked mode
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "skimming" });
    expect(cm.currentMorphMode).toBe("focus-reading");
    expect(document.body.classList.contains("cm-mode-skimming")).toBe(false);
  });

  it("toggles pause via widget checkbox and updates state and localStorage", () => {
    cm = new CognitiveMorph({ worker: mockWorker });
    cm.boot();

    expect(cm.isPaused).toBe(false);

    const checkbox = document.querySelector(".cm-status-widget input[type='checkbox']") as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);

    // Simulate checking the checkbox
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));

    expect(cm.isPaused).toBe(true);
    expect(localStorage.getItem("cm-paused")).toBe("true");

    // Simulate unchecking
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));

    expect(cm.isPaused).toBe(false);
    expect(localStorage.getItem("cm-paused")).toBe("false");
  });

  it("sets manual lock via select dropdown and updates state and localStorage", () => {
    cm = new CognitiveMorph({ worker: mockWorker });
    cm.boot();

    expect(cm.manualLock).toBeNull();
    expect(cm.currentMorphMode).toBeNull();

    const select = document.querySelector(".cm-status-widget select") as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe("");

    // Simulate selecting focus-reading
    select.value = "focus-reading";
    select.dispatchEvent(new Event("change"));

    expect(cm.manualLock).toBe("focus-reading");
    expect(cm.currentMorphMode).toBe("focus-reading");
    expect(localStorage.getItem("cm-manual-lock")).toBe("focus-reading");
    expect(document.body.classList.contains("cm-mode-focus-reading")).toBe(true);

    // Telemetry messages should be blocked
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "skimming" });
    expect(cm.currentMorphMode).toBe("focus-reading");
  });

  it("clears manual lock via select dropdown and restores automatic telemetry transitions", () => {
    localStorage.setItem("cm-manual-lock", "focus-reading");
    cm = new CognitiveMorph({ worker: mockWorker, transitionDurationMs: 0 });
    cm.boot();

    expect(cm.manualLock).toBe("focus-reading");
    expect(cm.currentMorphMode).toBe("focus-reading");

    const select = document.querySelector(".cm-status-widget select") as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe("focus-reading");

    // Simulate selecting "Automatic" (empty value)
    select.value = "";
    select.dispatchEvent(new Event("change"));

    expect(cm.manualLock).toBeNull();
    expect(localStorage.getItem("cm-manual-lock")).toBeNull();

    // Telemetry messages should now transition again
    mockWorker._emit("message", { type: "morphModeChange", morphMode: "skimming" });
    expect(cm.currentMorphMode).toBe("skimming");
    expect(document.body.classList.contains("cm-mode-skimming")).toBe(true);
  });

  it("updates widget styling and text on calibration progress changes", () => {
    cm = new CognitiveMorph({ worker: mockWorker });
    cm.boot();

    const label = document.querySelector(".cm-status-label");
    const indicator = document.querySelector(".cm-status-indicator");
    expect(label).not.toBeNull();
    expect(indicator).not.toBeNull();

    // Set calibration progress
    cm.setCalibrationProgress(50);
    expect(label!.textContent).toBe("Calibrating 50%");
    expect(indicator!.classList.contains("cm-status-calibrating")).toBe(true);

    // Set to 100
    cm.setCalibrationProgress(100);
    expect(label!.textContent).toBe("Calibrating 100%");

    // Complete calibration (null)
    cm.setCalibrationProgress(null);
    cm.setCameraActive(true);
    expect(label!.textContent).toBe("Active");
    expect(indicator!.classList.contains("cm-status-active")).toBe(true);

    // Pause it
    cm.setPaused(true);
    expect(label!.textContent).toBe("Paused");
    expect(indicator!.classList.contains("cm-status-paused")).toBe(true);

    // Unpause but set manual lock
    cm.setPaused(false);
    cm.setManualLock("focus-reading");
    expect(label!.textContent).toBe("Locked");
    expect(indicator!.classList.contains("cm-status-locked")).toBe(true);
  });

  it("does not persist calibration progress on webcam start", () => {
    cm = new CognitiveMorph({ worker: mockWorker });
    cm.boot();
    cm.setCalibrationProgress(50);
    expect(document.querySelector(".cm-status-label")?.textContent).toBe("Calibrating 50%");

    cm.destroy();

    const cm2 = new CognitiveMorph({ worker: mockWorker });
    cm2.boot();
    // It should boot into default status (not calibrating)
    expect(document.querySelector(".cm-status-label")?.textContent).not.toContain("Calibrating");
    cm2.destroy();
  });
});

describe("Background Web Worker Pipeline & MediaPipe Lazy Loading", () => {
  let mockStream: any;
  let getUserMediaSpy: any;
  let mockWorkerConstructorSpy: any;

  beforeEach(() => {
    mockStream = {
      getTracks: vi.fn().mockReturnValue([
        { stop: vi.fn() }
      ]),
    };
    
    // Stub getUserMedia
    getUserMediaSpy = vi.fn().mockResolvedValue(mockStream);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: getUserMediaSpy,
      },
    });

    // Stub window.Worker
    mockWorkerConstructorSpy = vi.fn().mockImplementation(() => createMockWorker());
    vi.stubGlobal("Worker", mockWorkerConstructorSpy);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:mock-worker-url"),
    });

    // Mock HTMLVideoElement methods to prevent JSDOM issues
    vi.spyOn(HTMLVideoElement.prototype, "play").mockImplementation(async () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("spawns a Web Worker lazily and requests camera access when setCameraActive(true) is called", async () => {
    // Instantiate WITHOUT worker to test lazy worker creation
    const cm = new CognitiveMorph({ transitionDurationMs: 0 } as any);
    cm.boot();

    expect(mockWorkerConstructorSpy).not.toHaveBeenCalled();
    expect(getUserMediaSpy).not.toHaveBeenCalled();

    // Call setCameraActive(true)
    await cm.setCameraActive(true);

    // Verify worker is spawned
    expect(mockWorkerConstructorSpy).toHaveBeenCalled();
    // Verify getUserMedia is called
    expect(getUserMediaSpy).toHaveBeenCalledWith({ video: true });
    
    cm.destroy();
  });

  it("publishes telemetry tracking metrics from the worker to the SDK's registered listeners", async () => {
    const mockWorkerInstance = createMockWorker();
    const cm = new CognitiveMorph({ worker: mockWorkerInstance, transitionDurationMs: 0 });
    
    const telemetrySpy = vi.fn();
    const unsubscribe = cm.onTelemetry(telemetrySpy);
    
    cm.boot();
    await cm.setCameraActive(true);

    const mockTelemetryData = {
      type: "telemetry",
      landmarks: [{ x: 10, y: 20, z: 30 }],
      confidence: 0.95
    };
    mockWorkerInstance._emit("message", mockTelemetryData);

    expect(telemetrySpy).toHaveBeenCalledTimes(1);
    expect(telemetrySpy).toHaveBeenCalledWith({
      landmarks: mockTelemetryData.landmarks,
      confidence: mockTelemetryData.confidence
    });

    unsubscribe();
    telemetrySpy.mockClear();
    mockWorkerInstance._emit("message", mockTelemetryData);
    expect(telemetrySpy).not.toHaveBeenCalled();

    cm.destroy();
  });

  it("captures and posts camera frames to the worker at a throttled rate", async () => {
    vi.useFakeTimers();

    const mockWorkerInstance = createMockWorker();
    const cm = new CognitiveMorph({ worker: mockWorkerInstance, transitionDurationMs: 0 });

    Object.defineProperty(HTMLVideoElement.prototype, "readyState", {
      value: 4,
      writable: true,
      configurable: true,
    });

    const mockBitmap = { close: vi.fn() };
    const createImageBitmapSpy = vi.fn().mockResolvedValue(mockBitmap);
    vi.stubGlobal("createImageBitmap", createImageBitmapSpy);

    cm.boot();
    await cm.setCameraActive(true);

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ type: "start" });
    mockWorkerInstance.postMessage.mockClear();

    await vi.advanceTimersByTimeAsync(100);
    expect(createImageBitmapSpy).toHaveBeenCalledTimes(1);
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ image: mockBitmap }, [mockBitmap]);

    mockWorkerInstance.postMessage.mockClear();
    createImageBitmapSpy.mockClear();

    await vi.advanceTimersByTimeAsync(500);
    expect(createImageBitmapSpy).toHaveBeenCalledTimes(5);
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledTimes(5);

    cm.destroy();
    vi.useRealTimers();
  });

  it("terminates worker and stops camera tracks on setCameraActive(false) and destroy()", async () => {
    const cm = new CognitiveMorph({ transitionDurationMs: 0 } as any);
    cm.boot();

    await cm.setCameraActive(true);

    const activeWorker = (cm as any).worker;
    expect(activeWorker).toBeDefined();
    expect(activeWorker.terminate).not.toHaveBeenCalled();

    const activeStream = (cm as any).cameraStream;
    expect(activeStream).toBeDefined();
    const mockTrack = activeStream.getTracks()[0];
    expect(mockTrack.stop).not.toHaveBeenCalled();

    expect(document.querySelector("video")).not.toBeNull();

    await cm.setCameraActive(false);

    expect(activeWorker.terminate).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(document.querySelector("video")).toBeNull();

    cm.destroy();
  });

  it("Web Worker template contains dynamic loading of MediaPipe FaceMesh from CDN", async () => {
    const { workerCode } = await import("./worker-template");
    expect(workerCode).toContain("importScripts");
    expect(workerCode).toContain("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
    expect(workerCode).toContain("FaceMesh");
    expect(workerCode).toContain("onmessage");
  });
});









