# 0007a: Background Web Worker Pipeline & MediaPipe Lazy Loading — ✅ DONE

## What to build

Implement the **Background Web Worker Pipeline** skeleton and integration with the camera stream. The worker must lazily load MediaPipe FaceMesh from a CDN after the camera is enabled, capture the webcam stream, run facial landmark detection, and establish a communication channel (IPC) to pass raw coordinates to the main thread.

## Acceptance criteria

- [x] The SDK class initiates and manages a Web Worker instance.
- [x] MediaPipe files and weights are lazily loaded from a CDN only after the user enables camera access, ensuring no overhead on initial SDK load.
- [x] Web Worker establishes webcam access, streams frames, and computes FaceMesh landmarks.
- [x] Worker runs at a throttled rate (5-10 FPS) to prevent main-thread latency and posts coordinate arrays and tracking confidence scores to the main thread.
- [x] Automated tests verify that starting camera tracking spawns the worker and receiving messages from the worker publishes tracking metrics to the SDK's internal listeners.

## Blocked by

- [0001: Prefactoring & SDK Architecture Bootstrap](file:///c:/Users/ANUJ%20GANDHI/OneDrive/Desktop/Cognitive-Morph/docs/issues/0001-prefactoring-sdk-bootstrap.md)
