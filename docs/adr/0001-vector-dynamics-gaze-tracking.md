# Use Vector Dynamics for Gaze Tracking

To distinguish between user reading modes, we will analyze the velocity and variance patterns of gaze vector changes over a sliding window rather than absolute screen coordinates. This reduces dependency on strict spatial calibration, which is notoriously inaccurate on standard webcams, and filters out high-frequency coordinate jitter.
