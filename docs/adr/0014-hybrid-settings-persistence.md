# Use Hybrid Settings Persistence

To maintain a consistent user experience while ensuring calibration accuracy, we will adopt a hybrid settings persistence model. User configuration overrides (such as manual Morph Mode locks or pausing the system) will be persisted in the browser's `localStorage` across page refreshes. However, passive calibration baselines (gaze velocity, eye aperture, and posture offsets) will never be persisted; they must be recalculated from scratch on every webcam start to adapt to immediate lighting and user posture.
