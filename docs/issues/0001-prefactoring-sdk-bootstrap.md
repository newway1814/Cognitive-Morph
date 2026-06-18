# 0001: Prefactoring & SDK Architecture Bootstrap — ✅ DONE

## What to build

Build the core project architecture, bundler build process, and testing suite. Implement the programmatic `CognitiveMorph` JS SDK class skeleton with the Unified Input-Output Testing Seam. The seam must allow passing a custom mock Web Worker instance to simulate telemetry streams, and testing tools can assert behavior against the SDK's state changes and public lifecycle listeners.

## Acceptance criteria

- [x] Project setup contains configured package managers, package.json, and bundler (e.g., Vite/Rollup) supporting double distribution output formats (ESM and UMD).
- [x] Test suite is set up with Vitest and JSDOM to enable headless browser state assertions.
- [x] The `CognitiveMorph` SDK class can be imported as a module and instantiated with options, including passing a custom/mock Web Worker instance.
- [x] The SDK class supports `.boot()` and `.destroy()` lifecycle methods, which properly bind/unbind DOM and window event listeners to prevent resource leaks.
- [x] A JSDOM automated test verifies that posting a test telemetry message from the mock worker to the SDK triggers the public subscription callback (e.g., `cm.onMorphModeChange`) and updates the internal state.

## Blocked by

None - can start immediately
