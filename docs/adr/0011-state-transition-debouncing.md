# Debounce State Transitions to Prevent Mode Thrashing

To prevent UI instability and rapid layout shifts (mode thrashing) when visual inputs fluctuate, we will implement a state-transition debounce window. The system will require the user to continuously exhibit a new Visual State for a minimum duration (e.g., 2 seconds for Focus/Skimming, 3 seconds for Fatigue) before initiating a transition to the corresponding Morph Mode.
