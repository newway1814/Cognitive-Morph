# Cognitive-Morph

An Attention-Aware Frontend User Interface (UI) System that uses real-time, privacy-first computer vision to adapt web layout, typography, and contrast to the user's active Visual State.

## Language

**Visual State**:
The user's active eye-movement, facial, and posture state (e.g., Focus, Skimming, Fatigue).
_Avoid_: Attention state, user state, cognitive state, cognitive status

**Morph Mode**:
An active UI display configuration corresponding to a specific Visual State.
_Avoid_: UI Mode, layout mode, display mode

**Focus Reading Morph Mode**:
The Morph Mode optimized for deep text consumption, which dims peripheral elements and widens text containers.
_Avoid_: Focus Mode, Reading Mode, Focus Reading Mode

**Skimming Morph Mode**:
The Morph Mode optimized for rapid page scanning, highlighting headers, bullet points, and pulsing call-to-action buttons.
_Avoid_: Scanning Mode, Speed Mode, Skimming Mode

**Fatigue Mitigation Morph Mode**:
The Morph Mode optimized to reduce eye strain when indicators like slow blinking, squinting, or slouching are detected, increasing text size and shifting to single-column layouts.
_Avoid_: Fatigue Mode, Night Mode, Strain Mode, Fatigue Mitigation Mode


**Gaze Vector Dynamics**:
The tracking of eye-movement velocity and variance vectors over a sliding time window to identify patterns, rather than absolute screen coordinates.
_Avoid_: Gaze position, gaze coordinates, coordinate tracking

**Transition Anchor**:
A natural break in user interaction (like a scroll pause or an extended blink) when the page layout is allowed to reflow.
_Avoid_: Reflow trigger, layout event

**Scroll Anchoring**:
The browser positioning technique that pins the active reading viewport to the current text block, preventing place-loss during font/layout resizing.
_Avoid_: Viewport lock, scroll lock

**Main Element**:
The primary container of text (marked with `data-morph="main"` or fallback semantic tags like `<main>` or `<article>`) that the user actively reads.
_Avoid_: Text container, main content, reading block

**Peripheral Element**:
Any layout component (marked with `data-morph="peripheral"` or fallback templates) that is secondary to reading (like sidebars, footers, headers) and is dimmed or hidden in Focus Reading Mode.
_Avoid_: Sidebar, footer, banner, visual noise

**Passive Baseline Calibration**:
The background analysis of a user's natural reading metrics (eye velocity, blink duration, posture, aperture) over the first 10 seconds of activation to establish baseline thresholds.
_Avoid_: Active calibration, spatial calibration, training phase

**Interaction-Based Estimator**:
The fallback detection engine that estimates the user's Visual State using device interaction telemetry (such as mouse velocity, scroll acceleration, and keyboard input cadence) when webcam access is denied or unavailable.
_Avoid_: Webcam simulator, interaction tracker, device tracker



