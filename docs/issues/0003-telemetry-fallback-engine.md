# 0003: Telemetry Fallback Engine & User Visual State Inference

## What to build

Build the **Telemetry Fallback Engine** that tracks interaction telemetry (mouse movements, scrolling rates, and keyboard keystrokes) to estimate the user's **User Visual State** when webcam stream access is unavailable or disabled. The engine must compute interaction patterns over a sliding window and trigger transitions to **Focus Reading Morph Mode**, **Skimming Morph Mode**, or **Fatigue Mitigation Morph Mode** while applying state hysteresis/debouncing.

## Acceptance criteria

- [ ] The fallback engine binds event listeners to `window` for `mousemove`, `scroll`, and `keydown`.
- [ ] Calculate mouse velocity (pixels per second) and scroll acceleration to distinguish between:
  - **Focus**: Linear scroll movements followed by pauses (reading pace).
  - **Skimming**: Rapid scrolling spikes and high-velocity mouse sweeps (e.g., > 1000px/s).
  - **Fatigue**: Extreme input inactivity or slow, erratic movement profiles.
- [ ] A debounce/hysteresis queue ensures the target state is held continuously before queueing the transition (2 seconds for Focus/Skimming, 3 seconds for Fatigue).
- [ ] The fallback engine automatically deactivates and cleans up event listeners when camera telemetry becomes active, and reactivates them when camera access is lost or denied.
- [ ] Automated tests dispatch mock interaction events (e.g., high-frequency scroll wheel events) and verify that the SDK correctly infers the Skimming state and queues the appropriate Morph Mode shift.

## Blocked by

- [0002: Declarative Markup Selection & Global CSS State Toggling](file:///c:/Users/ANUJ%20GANDHI/OneDrive/Desktop/Cognitive-Morph/docs/issues/0002-declarative-markup-state-toggling.md)
