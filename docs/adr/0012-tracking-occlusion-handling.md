# Handle Tracking Occlusion to Prevent False Fatigue Triggers

To prevent temporary events like eye-rubbing, face-touching, or camera blocks from falsely triggering Fatigue Mitigation Morph Mode, we will define a "Tracking Occlusion" state. When face landmark detection confidence drops below a threshold (indicating the eyes or face are blocked), the system will immediately pause all state timer evaluations and reset the transition debounce window, rather than interpreting landmark loss as slow-blinking or closed eyes.
