# 0007b: Passive Baseline Calibration & Calibration State Machine — ✅ DONE

## What to build

Implement **Passive Baseline Calibration** on the main thread. When webcam data starts arriving from the Web Worker, the SDK must profile the user's natural reading patterns (head tilt, blink duration, eye aperture, movement speed) for the initial 10 seconds of camera activation. These profile metrics will compute moving averages as baseline parameters. The status widget must reflect the calibrating state.

## Acceptance criteria

- [x] The SDK implements a calibration state machine that listens to Web Worker telemetry messages.
- [x] During the first 10 seconds of camera activation, the SDK averages eye apertures, blink intervals, and posture yaw/pitch without triggering any layout transitions.
- [x] The **Telemetry Status Widget** indicates the progress of calibration (e.g., status changing from yellow "Calibrating X%" to blue "Active").
- [x] At the end of the 10-second calibration period, baseline averages are locked in, and the system transitions to the active monitoring phase.
- [x] Automated tests simulate receiving 10 seconds of worker coordinates and verify that calibration metrics are computed and the baseline is successfully established.

## Blocked by

- [0007a: Background Web Worker Pipeline & MediaPipe Lazy Loading](file:///c:/Users/ANUJ%20GANDHI/OneDrive/Desktop/Cognitive-Morph/docs/issues/0007a-web-worker-pipeline.md)
- [0006: Telemetry Status Widget & Hybrid Settings Persistence](file:///c:/Users/ANUJ%20GANDHI/OneDrive/Desktop/Cognitive-Morph/docs/issues/0006-telemetry-status-widget.md)
