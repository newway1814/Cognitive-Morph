# Client-Side Only Processing for Webcam Privacy

To guarantee user privacy and establish trust, all video stream capture and model inference will be executed entirely in the client-side browser memory (local WASM). No video frames, coordinates, or telemetry data will be saved, cached, or transmitted to any external server. We will visually reassure the user by showing an abstract wireframe avatar overlay instead of raw video.
