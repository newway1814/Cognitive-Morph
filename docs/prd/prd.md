# Product Requirement Document (PRD) — Cognitive-Morph

## 1. Problem Statement
Standard web page layouts are static and rigid, failing to adapt to a user's dynamic User Visual State. When reading long-form content or working on screens for extended periods, users experience cognitive fatigue, eye strain, and distractions. Existing solutions require manual layout or accessibility adjustments, creating friction. Cognitive-Morph solves this by dynamically and contextually morphing layout typography, contrast, and element presence based on real-time visual attention and fatigue cues.

## 2. Target User
* **Knowledge Workers & Active Digital Readers**: Software engineers reading documentation, researchers digesting academic papers, and students reading textbook materials online.
* **Characteristics**: Individuals who spend 6+ hours/day reading text-heavy web layouts, value distraction-free reading, experience optical strain or posture fatigue, and prefer automated, privacy-respecting adaptive interfaces.

## 3. Core MVP Features
1. **Local Telemetry Engine**: Local, privacy-first webcam processing using MediaPipe FaceMesh running inside a throttled Web Worker (5–10 FPS) to measure gaze dynamics, eye aperture, blink duration, and posture (slouching).
2. **Three Morph Modes**:
   * *Focus Reading Morph Mode*: Dims Morph Peripheral Elements to 10% opacity, widens the Target Reading Element, and hides visual distractions.
   * *Skimming Morph Mode*: Highlights bullet points, bolds headers, and applies soft pulsing animations to call-to-actions (CTAs).
   * *Fatigue Mitigation Morph Mode*: Scales up font size, expands line-heights, increases contrast ratio, and collapses multi-column grids into a single-column layout.
3. **Declarative DOM Marking**: Targeting DOM elements via `data-morph="main"` and `data-morph="peripheral"` to explicitly identify the Target Reading Element and Morph Peripheral Elements, falling back to semantic HTML5 tags (e.g., `<main>`, `<article>`).
4. **Passive Baseline Calibration**: Continuous background profiling of the user's natural gaze velocity, blink patterns, and posture offsets during the first 10 seconds of camera activation.
5. **Transition & Scroll Anchoring**: Morph transitions execute only at interaction breaks (Layout Reflow Anchors such as scrolling pauses or extended blinks) and use viewport scroll anchoring to prevent the user from losing their place.
6. **Telemetry Fallback Engine**: Telemetry fallback tracking mouse speed, scroll velocity, and keyboard cadence to estimate the User Visual State and toggle Morph Modes when camera permissions are denied or unavailable.
7. **Occlusion & Off-Axis Support**: 
   * Detects Face Occlusion (hand-blocks, eye rubs) and pauses state evaluation.
   * Adapts baselines to off-axis head angles (multi-monitor setups), falling back to the Telemetry Fallback Engine if yaw/pitch exceeds 30 degrees.
8. **User Overrides & Control Interface**: A Telemetry Status Widget that displays tracking status, allows manual Morph Mode lock/pause, and shows a 3-second countdown toast prior to automated Morph Mode transitions.
9. **SDK & Bundle Distribution**: Shipped as a programmatic JS SDK class for frontend application framework integration and a self-initializing CDN script tag for static web pages.
10. **Hybrid Settings Persistence**: Persists user control configuration overrides (like manual mode locks) in `localStorage` across page loads, but recalculates passive calibration baselines fresh on webcam initialization.
11. **CDN-Managed Model Caching**: Uses version-locked public CDN paths for model weights and leverages standard HTTP Cache-Control headers to cache the model files in the browser's native cache.

## 4. Explicit Non-Goals
* **No Server/Cloud Analytics**: Raw video frames or coordinates are never transmitted, cached, or stored on servers.
* **No Absolute Pixel Eye-Tracking**: No attempts to map gaze to exact screen coordinates or specific words; we track vector velocity and variance trends.
* **No General OS Accessibility Scope**: This is a frontend layout-adaptation library, not an OS-level reader, screen magnifier, or screen reader.
* **No Native/Mobile App Support**: Limited entirely to standard web applications running in modern desktop browsers.

## 5. Key Constraints
* **Performance Budget**: The CV model inference and state logic must run at a throttled rate (5-10 FPS) inside a Web Worker. Frame processing must not block the main UI thread.
* **Package Footprint**: The webcam landmark tracking models must be lazy-loaded from WebAssembly CDNs, keeping the library's initial core bundle size under 100KB, and the optional model weight bundle under 3MB.
* **Visual Stability**: Layout shifting must not cause distracting Cumulative Layout Shift (CLS) during active focus.

## 6. Open Questions Remaining
1. **Developer API Customization**: How will the initialization API structure look for threshold tuning (e.g., setting custom debounce windows or custom baseline durations)?

