export class TelemetryFallbackEngine {
  private active = false;

  // Mouse tracking state
  private lastMouseX: number | null = null;
  private lastMouseY: number | null = null;
  private lastMouseTime: number | null = null;
  private mouseVelocities: number[] = [];

  // Scroll tracking state
  private lastScrollY: number | null = null;
  private lastScrollTime: number | null = null;
  private lastScrollSpeed: number | null = null;
  private scrollSpeeds: number[] = [];
  private scrollAccelerations: number[] = [];

  // General activity tracking
  private lastInteractionTime = Date.now();
  private hasMouseActivity = false;
  private hasScrollActivity = false;
  private hasKeyActivity = false;
  private evalIntervalId: any = null;

  // Hysteresis/Debounce State
  private inferredState: string | null = null;
  private stateStartTime: number | null = null;
  private lastTriggeredState: string | null = null;

  private handleMouseMove = (event: MouseEvent) => {
    const now = Date.now();
    this.lastInteractionTime = now;
    this.hasMouseActivity = true;
    if (this.lastMouseX !== null && this.lastMouseY !== null && this.lastMouseTime !== null) {
      const dt = now - this.lastMouseTime;
      if (dt > 0) {
        const dx = event.clientX - this.lastMouseX;
        const dy = event.clientY - this.lastMouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = (distance / dt) * 1000; // px/sec
        this.mouseVelocities.push(velocity);
      }
    }
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.lastMouseTime = now;
  };

  private handleScroll = (event: Event) => {
    const now = Date.now();
    this.lastInteractionTime = now;
    this.hasScrollActivity = true;
    const currentScrollY = window.scrollY;
    if (this.lastScrollY !== null && this.lastScrollTime !== null) {
      const dt = now - this.lastScrollTime;
      const dy = Math.abs(currentScrollY - this.lastScrollY);
      if (dt > 0) {
        const speed = (dy / dt) * 1000; // px/sec
        const acceleration = this.lastScrollSpeed !== null ? Math.abs(speed - this.lastScrollSpeed) / (dt / 1000) : 0;
        this.scrollSpeeds.push(speed);
        this.scrollAccelerations.push(acceleration);
        this.lastScrollSpeed = speed;
      }
    }
    this.lastScrollY = currentScrollY;
    this.lastScrollTime = now;
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    this.lastInteractionTime = Date.now();
    this.hasKeyActivity = true;
  };

  constructor(private onStateInferred: (state: string) => void) {}

  isActive(): boolean {
    return this.active;
  }

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.lastInteractionTime = Date.now();
    this.lastMouseX = null;
    this.lastMouseY = null;
    this.lastMouseTime = null;
    this.mouseVelocities = [];

    this.lastScrollY = window.scrollY;
    this.lastScrollTime = Date.now();
    this.lastScrollSpeed = null;
    this.scrollSpeeds = [];
    this.scrollAccelerations = [];

    this.hasMouseActivity = false;
    this.hasScrollActivity = false;
    this.hasKeyActivity = false;

    this.inferredState = null;
    this.stateStartTime = null;
    this.lastTriggeredState = null;

    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("scroll", this.handleScroll);
    window.addEventListener("keydown", this.handleKeyDown);

    this.evalIntervalId = setInterval(() => this.evaluateState(), 100);
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("keydown", this.handleKeyDown);

    if (this.evalIntervalId) {
      clearInterval(this.evalIntervalId);
      this.evalIntervalId = null;
    }
  }

  private evaluateState(): void {
    const now = Date.now();
    const idleTime = now - this.lastInteractionTime;

    let candidateState: string | null = null;
    const maxMouseVel = this.mouseVelocities.length > 0 ? Math.max(...this.mouseVelocities) : 0;
    const maxScrollSpeed = this.scrollSpeeds.length > 0 ? Math.max(...this.scrollSpeeds) : 0;
    const maxScrollAcc = this.scrollAccelerations.length > 0 ? Math.max(...this.scrollAccelerations) : 0;

    // Determine state
    if (idleTime >= 3000) {
      candidateState = "Fatigue";
    } else if (this.hasMouseActivity || this.hasScrollActivity || this.hasKeyActivity) {
      if (maxMouseVel > 1000 || maxScrollSpeed > 1500 || maxScrollAcc > 2000) {
        candidateState = "Skimming";
      } else {
        candidateState = "Focus";
      }
    } else {
      // Retain the current inferred state during short pauses
      candidateState = this.inferredState;
    }

    // Reset tick activity flags
    this.hasMouseActivity = false;
    this.hasScrollActivity = false;
    this.hasKeyActivity = false;
    this.mouseVelocities = [];
    this.scrollSpeeds = [];
    this.scrollAccelerations = [];

    if (candidateState !== null) {
      if (candidateState !== this.inferredState) {
        this.inferredState = candidateState;
        this.stateStartTime = now;
      } else {
        const heldDuration = now - (this.stateStartTime ?? now);
        const requiredDuration = candidateState === "Fatigue" ? 3000 : 2000;
        if (heldDuration >= requiredDuration) {
          if (this.lastTriggeredState !== candidateState) {
            this.lastTriggeredState = candidateState;
            this.onStateInferred(candidateState);
          }
        }
      }
    }
  }
}
