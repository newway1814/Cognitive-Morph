export interface CognitiveMorphOptions {
  worker: Worker;
}

export type MorphModeCallback = (morphMode: string) => void;

export class CognitiveMorph {
  private readonly worker: Worker;
  private readonly morphModeListeners = new Set<MorphModeCallback>();
  private handleMessage: ((event: MessageEvent) => void) | null = null;
  private _morphMode: string | null = null;

  get currentMorphMode(): string | null {
    return this._morphMode;
  }

  constructor(options: CognitiveMorphOptions) {
    this.worker = options.worker;
  }

  onMorphModeChange(callback: MorphModeCallback): void {
    this.morphModeListeners.add(callback);
  }

  boot(): void {
    this.handleMessage = (event: MessageEvent) => {
      const { type, morphMode } = event.data ?? {};
      if (type === "morphModeChange" && morphMode) {
        this._morphMode = morphMode;
        this.morphModeListeners.forEach((cb) => cb(morphMode));
      }
    };
    this.worker.addEventListener(
      "message",
      this.handleMessage as EventListener,
    );
  }

  destroy(): void {
    if (this.handleMessage) {
      this.worker.removeEventListener(
        "message",
        this.handleMessage as EventListener,
      );
      this.handleMessage = null;
    }
  }
}
