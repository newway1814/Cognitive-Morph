# Implement Off-Axis Adaptive Baselines

To support multi-monitor setups where the webcam is not aligned with the reading screen, we will implement Off-Axis Adaptive Baselines. The system will measure resting yaw and pitch head posture offsets during calibration and recenter the gaze coordinate space accordingly. If the off-axis angle is too extreme (yaw/pitch > 30 degrees) where landmark tracking becomes unreliable, the system will disable camera tracking and fall back to the Telemetry Fallback Engine.
