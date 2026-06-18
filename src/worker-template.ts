export const workerCode = `
  let faceMesh = null;
  let isLoaded = false;

  self.onmessage = async (event) => {
    const { type, image } = event.data ?? {};

    if (type === "start" || (image && !isLoaded)) {
      if (!isLoaded) {
        try {
          // Polyfill necessary window/document properties for legacy FaceMesh
          self.window = self;
          self.document = {
            createElement: (type) => {
              if (type === "canvas") {
                return new OffscreenCanvas(300, 150);
              }
              return null;
            }
          };

          self.importScripts("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
          
          faceMesh = new self.FaceMesh({
            locateFile: (file) => \`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/\${file}\`
          });

          faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });

          faceMesh.onResults((results) => {
            const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
            self.postMessage({
              type: "telemetry",
              landmarks: hasFace ? results.multiFaceLandmarks[0] : [],
              confidence: hasFace ? 1.0 : 0.0
            });
          });

          isLoaded = true;
          self.postMessage({ type: "loaded" });
        } catch (err) {
          self.postMessage({ type: "error", message: err.message });
        }
      }
    }

    if (image && isLoaded && faceMesh) {
      try {
        await faceMesh.send({ image });
      } catch (err) {
        self.postMessage({ type: "error", message: err.message });
      }
    }
  };
`;
