# Product Requirement Document (PRD) — Cognitive-Morph MVP

## Problem Statement

Standard web layouts are static and rigid. They ignore the reader's real-time attentional and physiological conditions, leading to ocular strain, physical fatigue (slouching), and visual distractions. Users reading long-form documentation or scanning pages for quick information must manually adjust zoom, scrolling, or styling configs, which creates reading friction. 

## Solution

Cognitive-Morph adapts webpage layouts dynamically using client-side webcam computer vision. The system profiles user gaze velocity, blinking patterns, and posture to toggle between three active **Morph Modes**:
* **Focus Reading Morph Mode** (dimming peripheral elements and widening text containers)
* **Skimming Morph Mode** (bolding headers, highlighting bullets, pulsing CTAs)
* **Fatigue Mitigation Morph Mode** (increasing font sizes, line heights, and collapsing columns)

The system ensures visual stability by executing reflows only at **Layout Reflow Anchors** (scroll pauses or extended blinks) and locking the reading viewport via **Scroll Anchoring**. It guarantees user privacy by keeping all processing local and volatile, and falls back to a **Telemetry Fallback Engine** (mouse/keyboard/scroll tracking) if webcam permissions are denied.

## User Stories

1. As a reader, I want the system to detect steady horizontal eye movements, so that the layout automatically activates **Focus Reading Morph Mode** and dims **Morph Peripheral Elements** to 10% opacity to minimize visual distractions.
2. As a reader scanning a page for key information, I want the system to detect rapid gaze shifts, so that it activates **Skimming Morph Mode** and bolds headers and highlights bullet points to guide my eyes.
3. As an ocular-fatigued reader, I want the system to detect slow blinking and squinting, so that it activates **Fatigue Mitigation Morph Mode** and increases font sizes, line heights, and contrast.
4. As a reader slouching at my desk, I want the system to detect my head posture dropping, so that it shifts the page to a single-column layout in **Fatigue Mitigation Morph Mode** to reduce visual complexity.
5. As a privacy-conscious user, I want all face and gaze tracking to run locally in-browser, so that my raw webcam feed and telemetry coordinates are never saved or sent to a server.
6. As a multi-monitor user, I want the system to automatically adjust for head rotation offsets, so that reading on an off-axis monitor does not trigger false distraction or fatigue indicators.
7. As a reader who rubs their eyes or blocks their face, I want the system to detect **Face Occlusion**, so that it pauses state timers and resets transition debounces rather than misinterpreting it as fatigue.
8. As a reader without a webcam, I want the system to fall back to a **Telemetry Fallback Engine**, so that my mouse movements and scroll acceleration can still estimate my **User Visual State** and trigger layout morphs.
9. As a reader, I want the system to delay layout morphs until I pause scrolling or blink deeply, so that text does not reflow or jump while I am actively reading.
10. As a reader, I want a floating **Telemetry Status Widget** on my screen, so that I can see the active calibration health, pause camera tracking, or manual-lock my preferred **Morph Mode**.
11. As a reader, I want to see a 3-second countdown **Transition Preview Toast** before any layout shift, so that I have the opportunity to undo and override the impending transition if it was a false trigger.
12. As a web developer, I want to use declarative `data-morph` attributes on my elements, so that I can explicitly define which elements are the **Target Reading Element** and which are **Morph Peripheral Elements** without writing custom CSS selectors.
13. As a developer integrating the library, I want a programmatic JS SDK class, so that I can easily boot, pause, configure thresholds, and subscribe to lifecycle events in my application framework (React/Next.js/Vue).

## Implementation Decisions

* **Background Web Worker Pipeline**: All webcam stream capture, MediaPipe FaceMesh processing, and **Gaze Dynamics** computations are executed inside a background Web Worker running at a throttled rate (5-10 FPS) to prevent main-thread latency and browser lag.
* **Global CSS State Toggling**: Layout morphs are executed by toggling global state classes (e.g., `cm-mode-focus-reading`) on the document `<body>` element. All resizing and transition interpolation curves are handled by standard CSS stylesheets leveraging CSS Custom Properties.
* **Passive Baseline Calibration**: The system profiles the user's natural gaze velocity, head yaw/pitch, and blink patterns for the first 10 seconds of camera boot to calculate moving-average baselines.
* **Off-Axis Pitch and Yaw Calibration**: The system measures off-axis head posture offsets during calibration. If head yaw/pitch exceeds 30 degrees (where camera landmarks degrade), it automatically transitions tracking to the **Telemetry Fallback Engine**.
* **Double Distribution Format**: The library is compiled and distributed as a programmatic JavaScript SDK class (`new CognitiveMorph()`) for modern build systems, and a self-initializing UMD script tag wrapper for static HTML sites.
* **Hysteresis & State Debouncing**: To prevent mode thrashing, a target state must be held continuously (2 seconds for Focus/Skimming, 3 seconds for Fatigue) before a **Morph Mode** change is queued.
* **Hybrid Persistence**: Persists user control overrides (like manual mode locks and tracker pauses) in `localStorage`, but recalculates all **Passive Baseline Calibration** metrics from scratch on every webcam start.

## Testing Decisions

* **Unified Input-Output Testing Seam**: Rather than exposing test-specific injection methods or verifying internal state machines, the entire SDK will be verified using a single, high-level black-box seam:
  1. **Input Interface**: The SDK constructor allows passing a custom, stubbed Web Worker object (`new CognitiveMorph({ worker: mockWorker })`). Test runners simulate camera telemetry by calling standard `postMessage` handlers on this mock object to emit mock eye apertures, blink intervals, yaw/pitch coordinates, and tracking occlusion events. Telemetry fallback is simulated by dispatching standard user interaction DOM events (mouse movement, scroll, keys) directly onto the test document.
  2. **Output Verification Interface**: Test assertions are made exclusively against standard public side effects: the DOM state (verifying that the correct global classes like `cm-mode-focus-reading` are applied to the `<body>` element and custom properties are correctly set) and lifecycle listeners (asserting callbacks like `.onModeChange` fire with expected modes).
* **Test Strategy**: Only test external behavioral contracts (mock worker messages or input DOM events mapping to body class updates and event callbacks) in standard headless testing environments (e.g., JSDOM in Jest or Vitest), keeping test files completely insulated from internal coordinate algorithms, model file compilation, or actual camera streaming.


## Out of Scope

* Server-side telemetry storage, cloud analytical logging, or model retraining pipelines.
* Absolute pixel screen-coordinate mapping (determining the exact word or button looked at).
* General operating system accessibility overlays or browser-extension-wide text modification.
* Native iOS or Android mobile application layout wrappers.

## Further Notes

* The library should load the 2-3MB MediaPipe weights file lazily only *after* the user explicitly enables the camera via the widget or SDK startup trigger, leveraging CDN-managed browser HTTP caching to ensure subsequent loads are instantaneous.
