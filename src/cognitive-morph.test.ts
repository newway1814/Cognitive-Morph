import { describe, it, expect, vi, beforeEach } from "vitest";
import { CognitiveMorph } from "./index";

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
