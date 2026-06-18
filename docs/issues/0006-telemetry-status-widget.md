# 0006: Telemetry Status Widget & Hybrid Settings Persistence

## What to build

Implement the floating **Telemetry Status Widget** UI and **Hybrid Settings Persistence** using `localStorage`. The widget must display the active tracking health, baseline status, and configurations (e.g., active calibration, paused, manual lock). User configuration overrides must be persisted across page refreshes, while passive calibration metrics are discarded and computed fresh on each boot.

## Acceptance criteria

- [ ] A floating visual widget is rendered in the bottom-right of the viewport using curated modern styling (e.g., glassmorphism, indicators changing color based on state: Calibrating, Active, Paused, or Manual Mode Lock).
- [ ] The widget includes interactive controls:
  - Toggle to pause/resume webcam tracking.
  - Dropdown/button array to manually force-lock a specific **Morph Mode**.
- [ ] Manual locks and pauses are persisted in `localStorage`. On boot, the SDK restores these configurations.
- [ ] When a manual Morph Mode lock is active, automated telemetry-based layout shifts are blocked.
- [ ] Passive baseline calibration values are excluded from `localStorage` persistence, ensuring they are recalculated from scratch on every webcam start.
- [ ] Automated tests assert that setting a manual override in the widget writes to `localStorage`, and that booting the SDK with pre-existing `localStorage` values restores the widget configuration and locks the Morph Mode.

## Blocked by

- [0005: Transition Preview Toast & User Override](file:///c:/Users/ANUJ%20GANDHI/OneDrive/Desktop/Cognitive-Morph/docs/issues/0005-transition-preview-toast.md)
