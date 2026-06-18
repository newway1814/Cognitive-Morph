import { TelemetryFallbackEngine } from "./fallback-engine";
import { workerCode } from "./worker-template";

const MORPH_MODE_NAMES: Record<string, string> = {
  "focus-reading": "Focus Reading Mode",
  "skimming": "Skimming Mode",
  "fatigue-mitigation": "Fatigue Mitigation Mode",
};

export interface CognitiveMorphOptions {
  worker?: Worker;
  transitionDurationMs?: number;
}

export type MorphModeCallback = (morphMode: string) => void;

export class CognitiveMorph {
  private worker: Worker | null = null;
  private readonly morphModeListeners = new Set<MorphModeCallback>();
  private readonly telemetryListeners = new Set<(data: { landmarks: any[]; confidence: number }) => void>();
  private readonly fallbackEngine: TelemetryFallbackEngine;
  private handleMessage: ((event: MessageEvent) => void) | null = null;
  private _morphMode: string | null = null;
  private _cameraActive = false;
  private _paused = false;
  private _manualLock: string | null = null;
  private _calibrationProgress: number | null = null;
  private cameraStream: MediaStream | null = null;
  private hiddenVideo: HTMLVideoElement | null = null;

  // Calibration and Baseline State
  private calibrationStartTime: number | null = null;
  private calibrationEyeApertures: number[] = [];
  private calibrationBlinkIntervals: number[] = [];
  private calibrationYaws: number[] = [];
  private calibrationPitches: number[] = [];

  private baselineEyeAperture: number | null = null;
  private baselineBlinkInterval: number | null = null;
  private baselineYaw: number | null = null;
  private baselinePitch: number | null = null;

  // Face Occlusion & Off-Axis Fallback State
  private isFaceOccluded = false;
  private isOccludedFallbackActive = false;
  private isOffAxisFallbackActive = false;
  private occlusionTimer: any = null;
  private occlusionStartedAt: number | null = null;
  private calibrationPausedMs = 0;

  // Reflow blocker state variables
  private isActivelyScrolling = false;
  private isEyeMovementActive = false;
  private pendingMorphMode: string | null = null;
  private scrollPauseTimer: any = null;
  private isProgrammaticScroll = false;

  // Transition Preview Toast & User Override states
  private transitionTimer: any = null;
  private transitionCountdownTimer: any = null;
  private transitionPreviewToast: HTMLElement | null = null;
  private transitionDurationMs = 3000;
  private activeTransitionTarget: string | null = null;

  // Status Widget & settings state
  private statusWidget: HTMLElement | null = null;

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

  get isPaused(): boolean {
    return this._paused;
  }

  get manualLock(): string | null {
    return this._manualLock;
  }

  constructor(options: CognitiveMorphOptions) {
    this.worker = options.worker ?? null;
    this.transitionDurationMs = options.transitionDurationMs ?? 3000;
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

  onTelemetry(callback: (data: { landmarks: any[]; confidence: number }) => void): () => void {
    this.telemetryListeners.add(callback);
    return () => {
      this.telemetryListeners.delete(callback);
    };
  }

  private bindWorkerListener(): void {
    if (this.worker && this.handleMessage) {
      this.worker.removeEventListener("message", this.handleMessage as EventListener);
      this.worker.addEventListener("message", this.handleMessage as EventListener);
    }
  }

  boot(): void {
    this.handleMessage = (event: MessageEvent) => {
      if (this._paused) return;

      if (event.data && (event.data.landmarks !== undefined || event.data.confidence !== undefined || event.data.type === "telemetry")) {
        const landmarks = event.data.landmarks ?? [];
        const confidence = event.data.confidence ?? 0;
        this.telemetryListeners.forEach((cb) => cb({ landmarks, confidence }));
      }

      if (event.data && event.data.confidence !== undefined) {
        const confidence = event.data.confidence;
        if (confidence < 0.5) {
          this.isFaceOccluded = true;
          if (this._calibrationProgress !== null && this.occlusionStartedAt === null) {
            this.occlusionStartedAt = Date.now();
          }
          this.cancelTransition();
          this.pendingMorphMode = null;
          if (!this.occlusionTimer) {
            this.occlusionTimer = setTimeout(() => {
              this.isOccludedFallbackActive = true;
              this.syncFallbackEngineState();
            }, 5000);
          }
        } else {
          this.isFaceOccluded = false;
          if (this.occlusionStartedAt !== null) {
            this.calibrationPausedMs += Date.now() - this.occlusionStartedAt;
            this.occlusionStartedAt = null;
          }
          if (this.occlusionTimer) {
            clearTimeout(this.occlusionTimer);
            this.occlusionTimer = null;
          }
          if (this.isOccludedFallbackActive) {
            this.isOccludedFallbackActive = false;
            this.syncFallbackEngineState();
          }
        }
      }

      if (this.isFaceOccluded) {
        return;
      }

      if (this._calibrationProgress !== null) {
        const elapsed = Date.now() - (this.calibrationStartTime ?? Date.now()) - this.calibrationPausedMs;

        const { eyeAperture, blinkInterval, yaw, pitch } = event.data ?? {};
        if (eyeAperture !== undefined) this.calibrationEyeApertures.push(eyeAperture);
        if (blinkInterval !== undefined) this.calibrationBlinkIntervals.push(blinkInterval);
        if (yaw !== undefined) this.calibrationYaws.push(yaw);
        if (pitch !== undefined) this.calibrationPitches.push(pitch);

        if (elapsed < 10000) {
          const progress = Math.min(99, Math.floor((elapsed / 10000) * 100));
          this.setCalibrationProgress(progress);
          return;
        } else {
          const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
          this.baselineEyeAperture = avg(this.calibrationEyeApertures);
          this.baselineBlinkInterval = avg(this.calibrationBlinkIntervals);
          this.baselineYaw = avg(this.calibrationYaws);
          this.baselinePitch = avg(this.calibrationPitches);

          this.setCalibrationProgress(null);
          return;
        }
      }

      if (event.data && (event.data.yaw !== undefined || event.data.pitch !== undefined)) {
        const { yaw, pitch } = event.data;
        const relativeYaw = (yaw ?? 0) - (this.baselineYaw ?? 0);
        const relativePitch = (pitch ?? 0) - (this.baselinePitch ?? 0);

        if (Math.abs(relativeYaw) > 30 || Math.abs(relativePitch) > 30) {
          if (!this.isOffAxisFallbackActive) {
            this.isOffAxisFallbackActive = true;
            this.cancelTransition();
            this.pendingMorphMode = null;
            this.syncFallbackEngineState();
          }
        } else {
          if (this.isOffAxisFallbackActive) {
            this.isOffAxisFallbackActive = false;
            this.syncFallbackEngineState();
          }
        }
      }

      if (this.isOffAxisFallbackActive) {
        return;
      }

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
    if (this.worker) {
      this.bindWorkerListener();
    }

    const savedPaused = localStorage.getItem("cm-paused");
    if (savedPaused === "true") {
      this._paused = true;
    }

    const savedLock = localStorage.getItem("cm-manual-lock");
    if (savedLock) {
      this._manualLock = savedLock;
    }

    if (this._manualLock) {
      this.applyMorphMode(this._manualLock);
    }

    window.removeEventListener("scroll", this.handleScrollActivity);
    window.addEventListener("scroll", this.handleScrollActivity);

    this.syncFallbackEngineState();

    this.renderStatusWidget();
  }

  async setCameraActive(active: boolean): Promise<void> {
    if (this._cameraActive === active) return;
    this._cameraActive = active;

    if (active) {
      this.calibrationStartTime = Date.now();
      this.calibrationEyeApertures = [];
      this.calibrationBlinkIntervals = [];
      this.calibrationYaws = [];
      this.calibrationPitches = [];
      this.calibrationPausedMs = 0;
      this.occlusionStartedAt = null;
      this.setCalibrationProgress(0);

      if (!this.worker) {
        this.worker = this.spawnWorker();
        this.bindWorkerListener();
      }
      try {
        let stream: MediaStream | null = null;
        if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        this.cameraStream = stream;
        if (stream) {
          this.initCameraStream(stream);
          this.startCaptureLoop();
        }
        if (this.worker) {
          this.worker.postMessage({ type: "start" });
        }
      } catch (err) {
        console.error("Camera access denied or failed:", err);
        this._cameraActive = false;
        this.cleanupWorker();
        this.setCalibrationProgress(null);
        this.updateWidgetUI();
        throw err;
      }
    } else {
      this.cleanupCamera();
      this.cleanupWorker();
      this.calibrationStartTime = null;
      this.calibrationEyeApertures = [];
      this.calibrationBlinkIntervals = [];
      this.calibrationYaws = [];
      this.calibrationPitches = [];
      this.baselineEyeAperture = null;
      this.baselineBlinkInterval = null;
      this.baselineYaw = null;
      this.baselinePitch = null;
      this.calibrationPausedMs = 0;
      this.occlusionStartedAt = null;
      this.setCalibrationProgress(null);
    }

    this.syncFallbackEngineState();
    this.updateWidgetUI();
  }

  setPaused(paused: boolean): void {
    if (this._paused === paused) return;
    this._paused = paused;

    localStorage.setItem("cm-paused", paused ? "true" : "false");

    if (paused) {
      this.cancelTransition();
    }
    this.syncFallbackEngineState();
    this.updateWidgetUI();
  }

  setManualLock(mode: string | null): void {
    const targetMode = mode || null;
    if (this._manualLock === targetMode) return;
    this._manualLock = targetMode;

    if (targetMode) {
      localStorage.setItem("cm-manual-lock", targetMode);
      this.cancelTransition();
      this.applyMorphMode(targetMode);
    } else {
      localStorage.removeItem("cm-manual-lock");
    }
    this.syncFallbackEngineState();
    this.updateWidgetUI();
  }

  setCalibrationProgress(progress: number | null): void {
    this._calibrationProgress = progress;
    this.updateWidgetUI();
  }

  private syncFallbackEngineState(): void {
    const shouldActivate =
      this.handleMessage &&
      (!this._cameraActive || this.isOccludedFallbackActive || this.isOffAxisFallbackActive) &&
      !this._paused &&
      !this._manualLock;
    if (shouldActivate) {
      this.fallbackEngine.activate();
    } else {
      this.fallbackEngine.deactivate();
    }
  }

  private updateWidgetUI(): void {
    if (!this.statusWidget) return;

    const checkbox = this.statusWidget.querySelector("input[type='checkbox']") as HTMLInputElement | null;
    if (checkbox) {
      checkbox.checked = this._paused;
    }

    const select = this.statusWidget.querySelector("select") as HTMLSelectElement | null;
    if (select) {
      select.value = this._manualLock ?? "";
    }

    const label = this.statusWidget.querySelector(".cm-status-label") as HTMLElement | null;
    const indicator = this.statusWidget.querySelector(".cm-status-indicator") as HTMLElement | null;

    if (label && indicator) {
      let statusText = "Ready";
      let statusClass = "cm-status-ready";

      if (this._calibrationProgress !== null) {
        statusText = `Calibrating ${this._calibrationProgress}%`;
        statusClass = "cm-status-calibrating";
      } else if (this._paused) {
        statusText = "Paused";
        statusClass = "cm-status-paused";
      } else if (this._manualLock) {
        statusText = "Locked";
        statusClass = "cm-status-locked";
      } else if (this._cameraActive) {
        statusText = "Active";
        statusClass = "cm-status-active";
      }

      indicator.classList.remove(
        "cm-status-ready",
        "cm-status-calibrating",
        "cm-status-paused",
        "cm-status-locked",
        "cm-status-active"
      );
      indicator.classList.add(statusClass);
      label.textContent = statusText;
    }
  }

  destroy(): void {
    this.cancelTransition();
    this.cleanupCamera();
    this.cleanupWorker();
    this.handleMessage = null;
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
    this.removeStatusWidget();
  }

  public cancelTransition(): void {
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    if (this.transitionCountdownTimer) {
      clearInterval(this.transitionCountdownTimer);
      this.transitionCountdownTimer = null;
    }
    this.dismissTransitionPreviewToast();
    this.activeTransitionTarget = null;
  }

  private dismissTransitionPreviewToast(): void {
    if (this.transitionPreviewToast) {
      this.transitionPreviewToast.remove();
      this.transitionPreviewToast = null;
    }
  }

  private transitionToMorphMode(targetMode: string, bypassAnchorCheck = false): void {
    if (this._paused || this._manualLock) return;
    if (targetMode === this._morphMode || targetMode === this.activeTransitionTarget) return;

    if (!bypassAnchorCheck) {
      // Transition Anchoring Invariant: do not reflow layout while user is scrolling or moving eyes
      if (this.isActivelyScrolling || this.isEyeMovementActive) {
        this.pendingMorphMode = targetMode;
        return;
      }
    }

    if (this.transitionDurationMs <= 0) {
      this.applyMorphMode(targetMode);
    } else {
      this.startTransitionPreviewCountdown(targetMode);
    }
  }

  private startTransitionPreviewCountdown(targetMode: string): void {
    this.cancelTransition();
    this.activeTransitionTarget = targetMode;

    const modeName = MORPH_MODE_NAMES[targetMode] ?? targetMode;

    const toast = document.createElement("div");
    toast.className = "cm-transition-toast";
    toast.style.setProperty('--cm-toast-duration', `${this.transitionDurationMs}ms`);

    const textSpan = document.createElement("span");
    textSpan.className = "cm-toast-text";
    
    let secondsLeft = Math.ceil(this.transitionDurationMs / 1000);
    textSpan.textContent = `Entering ${modeName} in ${secondsLeft}s...`;

    const progressContainer = document.createElement("div");
    progressContainer.className = "cm-toast-progress-container";
    const progressBar = document.createElement("div");
    progressBar.className = "cm-toast-progress-bar";
    progressContainer.appendChild(progressBar);

    const undoButton = document.createElement("button");
    undoButton.className = "cm-toast-undo";
    undoButton.textContent = "Undo";
    undoButton.addEventListener("click", () => {
      this.cancelTransition();
    });

    toast.appendChild(textSpan);
    toast.appendChild(progressContainer);
    toast.appendChild(undoButton);
    document.body.appendChild(toast);
    this.transitionPreviewToast = toast;

    this.transitionCountdownTimer = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        textSpan.textContent = `Entering ${modeName} in ${secondsLeft}s...`;
      } else {
        clearInterval(this.transitionCountdownTimer);
        this.transitionCountdownTimer = null;
      }
    }, 1000);

    this.transitionTimer = setTimeout(() => {
      this.applyMorphMode(targetMode);
      this.dismissTransitionPreviewToast();
      this.activeTransitionTarget = null;
    }, this.transitionDurationMs);
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
      this.transitionToMorphMode(targetMode, true);
    }
  }

  private renderStatusWidget(): void {
    if (document.querySelector(".cm-status-widget")) return;
    const widget = document.createElement("div");
    widget.className = "cm-status-widget";

    const indicator = document.createElement("span");
    indicator.className = "cm-status-indicator";
    widget.appendChild(indicator);

    const label = document.createElement("span");
    label.className = "cm-status-label";
    widget.appendChild(label);

    const toggleContainer = document.createElement("label");
    toggleContainer.className = "cm-status-toggle-container";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this._paused;
    checkbox.addEventListener("change", () => {
      this.setPaused(checkbox.checked);
    });
    toggleContainer.appendChild(checkbox);
    const toggleLabel = document.createElement("span");
    toggleLabel.className = "cm-status-toggle-label";
    toggleLabel.textContent = "Pause";
    toggleContainer.appendChild(toggleLabel);
    widget.appendChild(toggleContainer);

    const selectContainer = document.createElement("div");
    selectContainer.className = "cm-status-select-container";
    const selectLabel = document.createElement("span");
    selectLabel.className = "cm-status-select-label";
    selectLabel.textContent = "Lock:";
    selectContainer.appendChild(selectLabel);

    const select = document.createElement("select");
    const optAuto = document.createElement("option");
    optAuto.value = "";
    optAuto.textContent = "Automatic";
    select.appendChild(optAuto);

    const optFocus = document.createElement("option");
    optFocus.value = "focus-reading";
    optFocus.textContent = "Focus Reading Mode";
    select.appendChild(optFocus);

    const optSkim = document.createElement("option");
    optSkim.value = "skimming";
    optSkim.textContent = "Skimming Mode";
    select.appendChild(optSkim);

    const optFatigue = document.createElement("option");
    optFatigue.value = "fatigue-mitigation";
    optFatigue.textContent = "Fatigue Mitigation Mode";
    select.appendChild(optFatigue);

    select.value = this._manualLock ?? "";
    select.addEventListener("change", () => {
      this.setManualLock(select.value || null);
    });
    selectContainer.appendChild(select);
    widget.appendChild(selectContainer);

    document.body.appendChild(widget);
    this.statusWidget = widget;
    this.updateWidgetUI();
  }

  private removeStatusWidget(): void {
    if (this.statusWidget) {
      this.statusWidget.remove();
      this.statusWidget = null;
    } else {
      const widget = document.querySelector(".cm-status-widget");
      if (widget) widget.remove();
    }
  }

  private spawnWorker(): Worker {
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    return new Worker(url);
  }

  private initCameraStream(stream: MediaStream): void {
    const video = document.createElement("video");
    video.style.display = "none";
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    document.body.appendChild(video);
    this.hiddenVideo = video;
    video.play().catch(err => console.error("Error playing video:", err));
  }

  private cleanupCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
    if (this.hiddenVideo) {
      this.hiddenVideo.remove();
      this.hiddenVideo = null;
    }
  }

  private cleanupWorker(): void {
    this.stopCaptureLoop();
    if (this.occlusionTimer) {
      clearTimeout(this.occlusionTimer);
      this.occlusionTimer = null;
    }
    this.isFaceOccluded = false;
    this.isOccludedFallbackActive = false;
    this.isOffAxisFallbackActive = false;
    if (this.worker) {
      if (this.handleMessage) {
        this.worker.removeEventListener(
          "message",
          this.handleMessage as EventListener,
        );
      }
      this.worker.terminate();
      this.worker = null;
    }
  }

  private captureIntervalId: any = null;

  private startCaptureLoop(): void {
    this.stopCaptureLoop();
    this.captureIntervalId = setInterval(() => {
      this.captureFrame();
    }, 100);
  }

  private stopCaptureLoop(): void {
    if (this.captureIntervalId) {
      clearInterval(this.captureIntervalId);
      this.captureIntervalId = null;
    }
  }

  private captureFrame(): void {
    if (!this.worker || !this.hiddenVideo || !this._cameraActive) return;
    if (typeof createImageBitmap === "function") {
      if (this.hiddenVideo.readyState >= 2) {
        createImageBitmap(this.hiddenVideo).then((bitmap) => {
          if (this.worker && this._cameraActive) {
            this.worker.postMessage({ image: bitmap }, [bitmap]);
          } else {
            bitmap.close();
          }
        }).catch(() => {});
      }
    }
  }
}
