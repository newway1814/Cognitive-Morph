# 0008: Face Occlusion & Off-Axis Adaptive Baselines

## What to build

Implement advanced camera telemetry handling for **Face Occlusion** and **Off-Axis Adaptive Baselines**. The system must detect when the face is occluded (confidence drops) and pause state evaluations to prevent false fatigue triggers. It must also calibrate resting head rotation yaw/pitch offsets to support multi-monitor setups, and transition to the **Telemetry Fallback Engine** if the angle becomes too extreme (yaw/pitch > 30 degrees) where camera tracking becomes unreliable.

## Acceptance criteria

- [ ] FaceMesh confidence scores below a specific threshold (e.g., < 0.5) trigger a **Face Occlusion** state, which immediately pauses active timers and resets transition debounces.
- [ ] Gaze dynamics coordinates are transformed based on the off-axis resting head yaw and pitch offsets measured during calibration.
- [ ] If head yaw or pitch exceeds 30 degrees from the calibrated baseline, the system pauses camera tracking and transitions to the **Telemetry Fallback Engine**.
- [ ] When head posture returns below 30 degrees, webcam-based classification is resumed.
- [ ] Automated tests simulate:
  - Worker messages with confidence = 0 (occlusion); verify debounces are reset.
  - Worker messages with yaw/pitch angles exceeding 30 degrees; verify the system falls back to interaction-based telemetry.

## Blocked by

- [0007b: Passive Baseline Calibration & Calibration State Machine](file:///c:/Users/ANUJ%20GANDHI/OneDrive/Desktop/Cognitive-Morph/docs/issues/0007b-passive-baseline-calibration.md)
