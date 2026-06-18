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

  // Reflow blocker state variables
  private isActivelyScrolling = false;
  private isEyeMovementActive = false;
  private pendingMorphMode: string | null = null;
  private scrollPauseTimer: any = null;
  private isProgrammaticScroll = false;

  // Getter for Target Reading Element based on data-morph attribute
  private get targetReadingElement(): Element | null {
    return document.querySelector('[data-morph="main"]');
  }

  // Helper to fetch the Target Reading Element's vertical offset relative to the viewport
  private getTargetReadingElementOffset(): number | null {
    const target = this.targetReadingElement;
    return target ? target.getBoundingClientRect().top : null;
  }

  // Scroll listener that detects when the user starts/stops scrolling
  private handleScrollActivity = () => {
    if (this.isProgrammaticScroll) {
      this.isProgrammaticScroll = false;
      return;
    }
    this.isActivelyScrolling = true;
    if (this.scrollPauseTimer) {
      clearTimeout(this.scrollPauseTimer);
    }
    this.scrollPauseTimer = setTimeout(() => {
      this.isActivelyScrolling = false;
      this.triggerReflowAnchor();
    }, 500);
  };

  get currentMorphMode(): string | null {
    return this._morphMode;
  }

  get isCameraActive(): boolean {
    return this._cameraActive;
  }

  constructor(options: CognitiveMorphOptions) {
    this.worker = options.worker;
    this.fallbackEngine = new TelemetryFallbackEngine((userVisualState) => {
      // Map User Visual State to Morph Mode
      let targetMode = "";
      if (userVisualState === "Focus") targetMode = "focus-reading";
      else if (userVisualState === "Skimming") targetMode = "skimming";
      else if (userVisualState === "Fatigue") targetMode = "fatigue-mitigation";

      if (targetMode) {
        this.transitionToMorphMode(targetMode);
      }
    });
  }

  onMorphModeChange(callback: MorphModeCallback): void {
    this.morphModeListeners.add(callback);
  }

  boot(): void {
    this.handleMessage = (event: MessageEvent) => {
      const { type, morphMode, eyeMovement } = event.data ?? {};
      if (type === "extendedBlink") {
        this.triggerReflowAnchor();
      }
      if (eyeMovement !== undefined) {
        this.isEyeMovementActive = eyeMovement;
        if (!this.isEyeMovementActive && !this.isActivelyScrolling) {
          this.triggerReflowAnchor();
        }
      }
      if (type === "morphModeChange" && morphMode) {
        this.transitionToMorphMode(morphMode);
      }
    };
    this.worker.addEventListener(
      "message",
      this.handleMessage as EventListener,
    );

    window.removeEventListener("scroll", this.handleScrollActivity);
    window.addEventListener("scroll", this.handleScrollActivity);

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
    window.removeEventListener("scroll", this.handleScrollActivity);
    if (this.scrollPauseTimer) {
      clearTimeout(this.scrollPauseTimer);
      this.scrollPauseTimer = null;
    }
    this.isEyeMovementActive = false;
    this.isActivelyScrolling = false;
    if (this._morphMode) {
      document.body.classList.remove(`cm-mode-${this._morphMode}`);
      this._morphMode = null;
    }
  }

  private transitionToMorphMode(targetMode: string): void {
    if (targetMode === this._morphMode) return;

    // Transition Anchoring Invariant: do not reflow layout while user is scrolling or moving eyes
    if (this.isActivelyScrolling || this.isEyeMovementActive) {
      this.pendingMorphMode = targetMode;
      return;
    }

    this.applyMorphMode(targetMode);
  }

  private applyMorphMode(targetMode: string): void {
    if (targetMode === this._morphMode) return;

    // Capture offset of the Target Reading Element before changing styles
    const offsetBefore = this.getTargetReadingElementOffset();

    // Toggle global CSS state classes
    if (this._morphMode) {
      document.body.classList.remove(`cm-mode-${this._morphMode}`);
    }
    this._morphMode = targetMode;
    document.body.classList.add(`cm-mode-${targetMode}`);
    this.morphModeListeners.forEach((cb) => cb(targetMode));

    // Compensate scroll position to keep the text container pinned in the same visual location
    this.applyScrollAnchoringCompensation(offsetBefore);
  }

  private applyScrollAnchoringCompensation(offsetBefore: number | null): void {
    if (offsetBefore === null) return;
    const offsetAfter = this.getTargetReadingElementOffset();
    if (offsetAfter !== null) {
      const scrollCompensationOffset = offsetAfter - offsetBefore;
      if (scrollCompensationOffset !== 0) {
        const scrollYBefore = window.scrollY;
        this.isProgrammaticScroll = true;
        window.scrollTo(window.scrollX, scrollYBefore + scrollCompensationOffset);
        if (window.scrollY === scrollYBefore) {
          this.isProgrammaticScroll = false;
        }
      }
    }
  }

  private triggerReflowAnchor(): void {
    if (this.pendingMorphMode) {
      const targetMode = this.pendingMorphMode;
      this.pendingMorphMode = null;
      this.applyMorphMode(targetMode);
    }
  }
}
