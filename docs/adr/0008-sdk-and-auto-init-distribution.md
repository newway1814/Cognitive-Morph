# SDK and Self-Initializing Distribution

To ensure Cognitive-Morph is compatible with both modern frontend frameworks (React, Vue, Next.js) and legacy static websites, we will distribute the library in two formats: a programmatic JavaScript SDK class (`new CognitiveMorph()`) with full lifecycle methods (`.start()`, `.stop()`, `.onStateChange()`) and a self-initializing wrapper script that auto-boots on DOM load. This balances developer control with ease of installation.
