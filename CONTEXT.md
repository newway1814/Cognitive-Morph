# Cognitive-Morph Domain Model

An Attention-Aware Frontend User Interface (UI) System that uses real-time, privacy-first computer vision to adapt web layout, typography, and contrast to the user's active User Visual State.

## Bounded Contexts

Cognitive-Morph is organized into three bounded contexts that divide system responsibilities:

1. **Telemetry Context**: Responsible for raw camera streaming, facial landmark detection, input device monitoring, baseline calibration, and classifying the active User Visual State.
2. **Morphing Context**: Responsible for managing active Morph Modes, tracking layout reflow anchors, resolving scroll offsets, mapping elements (Target Reading and Morph Peripheral), and applying layout/typography modifications.
3. **Control Context**: Responsible for coordinating user overrides, configuration endpoints, status alerts, and the transition preview toast.

---

## 1. Telemetry Context Language

**User Visual State**:
* **Definition**: The classification of a user's current reading posture, gaze movement pattern, and blinking metrics.
* **What it is NOT**: The user's internal cognitive, emotional, or psychological state (e.g., happy, bored).
* **Example**: A steady horizontal eye-tracking pattern indicates the user is in the Focus state.
* _Avoid_: cognitive state, attention state, user state, cognitive status, visual state

**Gaze Dynamics**:
* **Definition**: The mathematical tracking of eye-movement velocity and variance vectors over a sliding window rather than absolute coordinates.
* **What it is NOT**: Absolute screen pixel coordinate tracking (e.g., knowing the exact word or button looked at).
* **Example**: Computing high vertical eye velocity variance to detect rapid darting across the viewport.
* _Avoid_: gaze position, gaze coordinates, coordinate tracking, gaze vector dynamics

**Passive Baseline Calibration**:
* **Definition**: The background profiling of the user's natural reading patterns (head tilt, blink duration, eye aperture, movement speed) during the initial 10 seconds of camera activation.
* **What it is NOT**: An active interactive onboarding tutorial requiring clicking screen targets or keeping the head perfectly still.
* **Example**: Measuring average blink duration to calculate the threshold for an "extended blink".
* _Avoid_: active calibration, spatial calibration, training phase

**Face Occlusion**:
* **Definition**: The temporary state when the camera's view of the user's eyes or face is blocked, causing low confidence scores and pausing metric evaluations.
* **What it is NOT**: A camera hardware disconnection or software crash.
* **Example**: Pausing posture and blink tracking when the user rubs their face or drinks from a cup.
* _Avoid_: landmark loss, camera block, sensor failure, tracking occlusion

**Off-Axis Adaptive Baselines**:
* **Definition**: The calibration offset that recenters the gaze vector space to accommodate users looking at monitors not aligned with their webcams.
* **What it is NOT**: A mechanical camera repositioning command or a physical monitor mounting configuration.
* **Example**: Recentering the baseline head yaw coordinate to 15 degrees to support a dual-screen monitor setup.
* _Avoid_: screen alignment, offset mapping, angle adjustment

**Telemetry Fallback Engine**:
* **Definition**: The fallback telemetry engine that infers the user's User Visual State using mouse movement, scrolling acceleration, and keyboard input telemetry.
* **What it is NOT**: A simulated webcam video feed or synthetic camera pixels generator.
* **Example**: Inferring a Skimming state when scroll acceleration spikes and mouse movement velocity exceeds 1000px/s.
* _Avoid_: webcam simulator, interaction tracker, device tracker, interaction-based estimator

---

## 2. Morphing Context Language

**Morph Mode**:
* **Definition**: A specific active UI display configuration corresponding to a classified User Visual State.
* **What it is NOT**: A generic theme toggle (like light/dark mode) or application editing state (like read/write mode).
* **Example**: Collapsing grids to a single-column layout when switching to Fatigue Mitigation Morph Mode.
* _Avoid_: UI mode, layout mode, display mode

**Focus Reading Morph Mode**:
* **Definition**: The Morph Mode optimized for deep, linear text reading.
* **What it is NOT**: A browser fullscreen mode or reading-list bookmarks panel.
* **Example**: Dimming Morph Peripheral Elements to 10% opacity to isolate a central text paragraph.
* _Avoid_: Focus Mode, Reading Mode, Focus Reading Mode

**Skimming Morph Mode**:
* **Definition**: The Morph Mode optimized for rapid text scanning and quick information extraction.
* **What it is NOT**: A text summarization tool or speed-reading presentation view.
* **Example**: Highlighting headers and adding a soft pulsing outline to the primary call-to-action button.
* _Avoid_: Scanning Mode, Speed Mode, Skimming Mode

**Fatigue Mitigation Morph Mode**:
* **Definition**: The Morph Mode optimized to reduce eye strain and slouching posture.
* **What it is NOT**: A night mode or blue light filter utility.
* **Example**: Expanding paragraph line-heights and increasing font size from 16px to 22px.
* _Avoid_: Fatigue Mode, Night Mode, Strain Mode, Fatigue Mitigation Mode

**Layout Reflow Anchor**:
* **Definition**: A specific, natural interruption in reading (such as a scroll pause or an extended blink) during which structural layout reflow is permitted.
* **What it is NOT**: A layout transition animation or a keyframe curve.
* **Example**: Postponing a font-size resize until the user pauses scrolling for 500ms.
* _Avoid_: reflow trigger, layout event, transition anchor

**Scroll Anchoring**:
* **Definition**: The browser technique that pins the active reading viewport to the current text block, preventing place-loss during font/layout resizing.
* **What it is NOT**: A scroll locking command that prevents the user from scrolling.
* **Example**: Ensuring the viewport scroll position shifts dynamically as the font sizes expand so the same paragraph remains centered.
* _Avoid_: viewport lock, scroll lock

**Target Reading Element**:
* **Definition**: The targeted DOM container representing the primary text layout that the user is actively reading.
* **What it is NOT**: The entire webpage window or a generic parent element like the `<body>` tag.
* **Example**: The central blog post `<article>` tag marked with the `data-morph="main"` attribute.
* _Avoid_: text container, main content, reading block, main element

**Morph Peripheral Element**:
* **Definition**: Layout components secondary to the primary content (such as sidebars, ads, headers, and footers) that are dimmed or hidden during Focus Reading Morph Mode.
* **What it is NOT**: Any text or images nested inside the main reading article.
* **Example**: An aside navigation panel marked with `data-morph="peripheral"`.
* _Avoid_: sidebar, footer, banner, visual noise, peripheral element

---

## 3. Control Context Language

**User Override**:
* **Definition**: A manual interaction command that allows the user to force-lock, pause, or reverse a Morph Mode transition.
* **What it is NOT**: A system calibration toggle or browser reset command.
* **Example**: Clicking the "Undo" button on a transition toast to cancel an impending layout shift.
* _Avoid_: manual toggle, system override

**Telemetry Status Widget**:
* **Definition**: The floating visual indicator displaying active tracking health, baseline status, and manual configuration controls.
* **What it is NOT**: The main browser settings page or a dashboard.
* **Example**: A persistent bottom-right circle that turns yellow during passive calibration and blue when camera tracking is active.
* _Avoid_: settings panel, control bar, status widget

**Transition Preview Toast**:
* **Definition**: The alert notification that warns the user of an impending automated Morph Mode shift and provides a countdown to undo it.
* **What it is NOT**: A persistent error message or success alert.
* **Example**: A floating alert stating "Entering Fatigue Mitigation Mode in 3s... Undo" with a countdown circle.
* _Avoid_: prompt alert, notice bar

---

## Key Invariants

1. **Local Privacy Invariant**: Under no circumstances shall webcam video frames, raw pixel data, or face coordinate arrays be saved, cached in persistent storage, or transmitted across the network. All computer vision processing must remain local and volatile in memory.
2. **Transition Anchoring Invariant**: A structural reflow of the Target Reading Element or parent grid must never trigger during active eye movement or scrolling. Reflows can only execute when a Layout Reflow Anchor is active.
3. **Single Active Morph Mode Invariant**: The system must have exactly one active Morph Mode at any given time.
4. **Fallback Availability Invariant**: The system must transition to the Telemetry Fallback Engine if camera access is denied, lost, or Face Occlusion exceeds 5 seconds.
5. **No Layout Interferences Invariant**: Toggle changes must be executed by altering the global body classes only, allowing the page to manage its stylesheet overrides natively.
