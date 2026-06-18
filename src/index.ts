import { TelemetryFallbackEngine } from "./fallback-engine";

export interface CognitiveMorphOptions {
  worker: Worker;
}

export type MorphModeCallback = (morphMode: string) => void;

export class CognitiveMorph {
  private readonly worker: Worker;
  private readonly morphModeListeners = new Set<MorphModeCallback>();
  private readonly fallbackEngine: TelemetryFallbackEngine;
  private handleMessage: ((event: MessageEvent) => void) | null = null;
  private _morphMode: string | null = null;
  private _cameraActive = false;

  get currentMorphMode(): string | null {
    return this._morphMode;
  }

  get isCameraActive(): boolean {
    return this._cameraActive;
  }

  constructor(options: CognitiveMorphOptions) {
    this.worker = options.worker;
    this.fallbackEngine = new TelemetryFallbackEngine((state) => {
      // Map visual state to morph mode
      let targetMode = "";
      if (state === "Focus") targetMode = "focus-reading";
      else if (state === "Skimming") targetMode = "skimming";
      else if (state === "Fatigue") targetMode = "fatigue-mitigation";

      if (targetMode && targetMode !== this._morphMode) {
        if (this._morphMode) {
          document.body.classList.remove(`cm-mode-${this._morphMode}`);
        }
        this._morphMode = targetMode;
        document.body.classList.add(`cm-mode-${targetMode}`);
        this.morphModeListeners.forEach((cb) => cb(targetMode));
      }
    });
  }

  onMorphModeChange(callback: MorphModeCallback): void {
    this.morphModeListeners.add(callback);
  }

  boot(): void {
    this.handleMessage = (event: MessageEvent) => {
      const { type, morphMode } = event.data ?? {};
      if (type === "morphModeChange" && morphMode) {
        if (this._morphMode) {
          document.body.classList.remove(`cm-mode-${this._morphMode}`);
        }
        this._morphMode = morphMode;
        document.body.classList.add(`cm-mode-${morphMode}`);
        this.morphModeListeners.forEach((cb) => cb(morphMode));
      }
    };
    this.worker.addEventListener(
      "message",
      this.handleMessage as EventListener,
    );

    if (!this._cameraActive) {
      this.fallbackEngine.activate();
    }
  }

  setCameraActive(active: boolean): void {
    if (this._cameraActive === active) return;
    this._cameraActive = active;

    if (active) {
      this.fallbackEngine.deactivate();
    } else {
      // Reactivate fallback only if booted
      if (this.handleMessage) {
        this.fallbackEngine.activate();
      }
    }
  }

  destroy(): void {
    if (this.handleMessage) {
      this.worker.removeEventListener(
        "message",
        this.handleMessage as EventListener,
      );
      this.handleMessage = null;
    }
    this.fallbackEngine.deactivate();
    if (this._morphMode) {
      document.body.classList.remove(`cm-mode-${this._morphMode}`);
      this._morphMode = null;
    }
  }
}
