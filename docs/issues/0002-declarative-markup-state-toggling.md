# 0002: Declarative Markup Selection & Global CSS State Toggling — ✅ DONE

## What to build

Implement the global CSS stylesheet and the state toggling system for the three core **Morph Modes**. Integrate declarative selection of DOM elements via `data-morph="main"` (**Target Reading Element**) and `data-morph="peripheral"` (**Morph Peripheral Element**) attributes. The SDK must manage these transitions by toggling global classes on the `<body>` element.

## Acceptance criteria

- [x] A global CSS stylesheet defines styles for:
  - **Focus Reading Morph Mode** (`cm-mode-focus-reading` class on body): Dims `data-morph="peripheral"` elements to 10% opacity and widens the `data-morph="main"` container.
  - **Skimming Morph Mode** (`cm-mode-skimming` class on body): Bolds headers, highlights bullet lists, and adds a soft pulsing outline animation to primary calls-to-action (CTAs).
  - **Fatigue Mitigation Morph Mode** (`cm-mode-fatigue-mitigation` class on body): Increases font size, expands line-heights, enhances text contrast, and collapses multi-column grids to a single-column layout.
- [x] Elements in the DOM marked with `data-morph="main"` and `data-morph="peripheral"` respond natively to body class shifts via CSS selectors without requiring JS style injection.
- [x] Calling the SDK's mode transitions applies the appropriate class on the `<body>` element, enforcing the **Single Active Morph Mode Invariant**.
- [x] Automated tests verify that invoking a mode transition updates the body class list, clears previous mode classes, and custom properties (like `--cm-opacity`, `--cm-font-size`) resolve to the correct values.

## Blocked by

- [0001: Prefactoring & SDK Architecture Bootstrap](file:///c:/Users/ANUJ%20GANDHI/OneDrive/Desktop/Cognitive-Morph/docs/issues/0001-prefactoring-sdk-bootstrap.md)
