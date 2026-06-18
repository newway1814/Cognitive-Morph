# Use Gaze Dynamics for Gaze Tracking

To distinguish between user reading patterns, we will analyze the velocity and variance patterns of gaze vector changes over a sliding window (referred to as Gaze Dynamics) rather than absolute screen coordinates. This reduces dependency on strict spatial calibration, which is notoriously inaccurate on standard webcams, and filters out high-frequency coordinate jitter.
