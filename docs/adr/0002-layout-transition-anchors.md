# Layout Shifts via Transition Anchors and Scroll Anchoring

To avoid visual disorientation and place-loss during dynamic layout morphing, we will restrict structural reflows to specific user interaction "anchors" (such as a scroll pause or an extended blink). Simultaneously, we will use browser scroll-anchoring algorithms to pin the viewport relative to the active reading element during any text resizing or layout collapse.
