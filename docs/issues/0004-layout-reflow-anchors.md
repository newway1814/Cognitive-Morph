# 0004: Layout Reflow Anchors & Scroll Anchoring

## What to build

Implement **Layout Reflow Anchors** and **Scroll Anchoring** to ensure visual stability during layout morphs. Toggles must not trigger layout changes while the user is actively scrolling or reading. Instead, changes must be deferred until a Layout Reflow Anchor (scroll pause of 500ms or an extended blink) is active. Implement scroll compensation to prevent the user from losing their place in the text during font-size and height resizing.

## Acceptance criteria

- [ ] A reflow blocker intercepts any queued Morph Mode change if the user is actively scrolling or if gaze metrics indicate eye movement.
- [ ] The system detects **Layout Reflow Anchors** under two conditions:
  - Scroll velocity remains zero for a continuous 500ms.
  - A telemetry event reports an "extended blink" pause.
- [ ] **Scroll Anchoring** dynamically calculates the vertical coordinate offset of the **Target Reading Element** relative to the viewport. When styling changes (like expanding font size in Fatigue Mitigation Mode) occur, the system adjusts the window scroll position to keep the text container pinned in the same visual location.
- [ ] Automated tests simulate active scrolling, queue a Morph Mode shift, and verify the shift remains pending. The test then simulates a scroll pause and verifies the mode class is applied to the body, and the scroll position is updated to compensate for size adjustments.

## Blocked by

- [0003: Telemetry Fallback Engine & User Visual State Inference](file:///c:/Users/ANUJ%20GANDHI/OneDrive/Desktop/Cognitive-Morph/docs/issues/0003-telemetry-fallback-engine.md)
