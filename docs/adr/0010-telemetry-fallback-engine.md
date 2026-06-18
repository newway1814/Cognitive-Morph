# Use Telemetry Fallback Engine for Fallback Telemetry

To ensure the library remains functional for users without a camera or when webcam permissions are blocked, we will build a Telemetry Fallback Engine. This engine will monitor mouse movement velocity, scroll acceleration curves, and keyboard input cadence to estimate the User Visual State and toggle Morph Modes, ensuring a continuous adaptive UI experience with appropriate status indicators.
