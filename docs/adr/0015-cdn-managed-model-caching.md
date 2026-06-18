# Use CDN-Managed Browser Caching for Model Weights

To ensure fast page load times and avoid network latency for the 2–3MB MediaPipe FaceMesh model, we will use version-locked URLs from public CDNs (e.g., jsDelivr or unpkg) and rely on standard HTTP Cache-Control headers to cache the model files in the browser's native cache. This avoids the complexity of building custom IndexedDB or Cache API loaders while ensuring reliable cache invalidation via version numbers.
