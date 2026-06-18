# Layout Shifts via Layout Reflow Anchors and Scroll Anchoring

To avoid visual disorientation and place-loss during dynamic layout morphing, we will restrict structural reflows to specific user interaction breaks (referred to as Layout Reflow Anchors, such as a scroll pause or an extended blink). Simultaneously, we will use browser scroll anchoring to pin the viewport relative to the Target Reading Element during any text resizing or layout collapse.
