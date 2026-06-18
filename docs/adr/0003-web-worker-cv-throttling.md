# Offload Computer Vision to Web Worker with Throttling

To prevent CPU/GPU thrashing and battery drain—which actively increase user fatigue—we will offload all webcam frame processing and MediaPipe FaceMesh landmark detection to a background Web Worker. Additionally, we will throttle the frame inference rate to 5-10 FPS, using main-thread CSS transitions to smooth out the resulting UI updates.
