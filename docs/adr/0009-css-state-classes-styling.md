# Apply Styles via Global CSS State Classes

To keep layout changes performant, clean, and developer-customizable, we will apply visual styling changes by toggling global state classes (e.g., `cm-mode-focus-reading`, `cm-mode-skimming`, `cm-mode-fatigue-mitigation`) on the `<body>` element. All styling transitions, sizes, and layout resets will be defined in a standard CSS stylesheet leveraging CSS variables, rather than manipulating inline style properties in JavaScript.
