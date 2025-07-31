/* NEXUS UI ELEMENTS */
let oscilloscope = new Nexus.Oscilloscope("#osc", {
  size: [300, 150],
});

let envelopeSelector = new Nexus.Multislider("env", {
  size: [300, 150],
  numberOfSliders: 4,
  min: 0,
  max: 1,
  step: 0.1,
  smoothing: 0,
  mode: "bar",
});

let waveformSelector = new Nexus.RadioButton("#wave", {
  size: [300, 30],
  numberOfButtons: 4,
  options: ["sine", "square", "sawtooth", "triangle"],
});

let volumeSlider = new Nexus.Slider("#vol", {
  size: [300, 30],
  min: 0,
  max: 1,
  step: 0.01,
});

/* SYNTH FUNCTIONS */
// Map keys to pitch
const keyFrequencies = {
  A: 261.63, // C3
  W: 277.18, // C#3
  S: 293.66, // D3
  E: 311.13, // D#3
  D: 329.63, // E3
  F: 349.23, // F3
  T: 369.99, // F#3
  G: 392.0, // G3
  Y: 415.3, // G#3
  H: 440.0, // A3
  U: 466.16, // A#3
  J: 493.88, // B3
  K: 523.25, // C4
  O: 554.37, // C#4
  L: 587.33, // D4
};

// ADSR envelope
const envelope = () => {
  const env = envelopeSelector.values;
  return {
    attack: env[0], // Attack (seconds)
    decay: env[1], // Decay
    sustain: env[2], // Sustain
    release: env[3], // Release
  };
};

// Function to get the correct frequency/octave
const octaveDisplay = document.querySelector("#octave");
let octave = 0; // Initial octave is 0
octaveDisplay.innerHTML = String(octave+3);
const getFrequencyForKey = (key) => {
  const baseFrequency = keyFrequencies[key];
  if (!baseFrequency) return null;

  // Adjust the frequency based on the octave
  const adjustedFrequency = baseFrequency * Math.pow(2, octave);
  return adjustedFrequency;
};

// Create audio context and gain node
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioContext.createGain();
gainNode.connect(audioContext.destination);
gainNode.gain.value = volumeSlider.value;

// Connect to oscilloscope for wave visualization
oscilloscope.connect(gainNode);

// Synth object
const synth = {
  voices: {}, // Keep track of the notes that are currently playing (voices)

  startNote: (note) => {
    const freq = getFrequencyForKey(note); // Get the frequency based on the key pressed
    if (freq) {
      // Create a new oscillator
      const oscillator = audioContext.createOscillator();
      oscillator.type = ["sine", "square", "sawtooth", "triangle"][
        waveformSelector.active
      ];
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);

      // Apply ADSR envelope
      const env = envelope();
      const gainEnv = audioContext.createGain();
      gainEnv.connect(gainNode);
      gainEnv.gain.setValueAtTime(0, audioContext.currentTime);
      gainEnv.gain.linearRampToValueAtTime(
        1,
        audioContext.currentTime + env.attack
      );
      gainEnv.gain.linearRampToValueAtTime(
        env.sustain,
        audioContext.currentTime + env.attack + env.decay
      );
      gainEnv.gain.setValueAtTime(
        env.sustain,
        audioContext.currentTime + env.attack + env.decay
      );
      gainEnv.gain.linearRampToValueAtTime(
        0,
        audioContext.currentTime + env.attack + env.decay + env.sustain
      );

      // Start oscillator
      oscillator.connect(gainEnv);
      oscillator.start();

      // Store the oscillator and gainEnv in voices
      synth.voices[note] = { oscillator, gainEnv, playing: true }; // Track the oscillator and gainEnv
    }
  },

  stopNote: (note) => {
    if (synth.voices[note]) {
      const { oscillator, gainEnv } = synth.voices[note];
      const env = envelope();
      gainEnv.gain.linearRampToValueAtTime(
        0,
        audioContext.currentTime + env.release
      );

      // Stop the oscillator after the release
      oscillator.stop(audioContext.currentTime + env.release);

      // Mark the note as not playing (so it can be played again)
      synth.voices[note].playing = false;
    }
  },

  triggerKey: (note, isPressed) => {
    if (isPressed && !synth.voices[note]?.playing) {
      synth.startNote(note); // Start the note unless it is already playing
    } else if (!isPressed) {
      synth.stopNote(note);
    }
  },
};

// Play a note or change the octave
document.addEventListener("keydown", (event) => {
  // Check if the focused element is an input or textarea
  if (
    document.activeElement.tagName === "INPUT" ||
    document.activeElement.tagName === "TEXTAREA"
  ) {
    return; // Don't play the note if typing in a form field
  }
  const note = event.key.toUpperCase();

  if (note === "X") {
    octave++; // Increase octave
    octaveDisplay.innerHTML = String(octave+3);
    console.log("Octave up: " + octave);
  } else if (note === "Z") {
    octave--; // Decrease octave
    octaveDisplay.innerHTML = String(octave+3);
    console.log("Octave down: " + octave);
  } else {
    synth.triggerKey(note, true); // Play a note
  }
});

// Stop a note
document.addEventListener("keyup", (event) => {
  // Check if the focused element is an input or textarea
  if (
    document.activeElement.tagName === "INPUT" ||
    document.activeElement.tagName === "TEXTAREA"
  ) {
    return; // Don't play the note if typing in a form field
  }
  const note = event.key.toUpperCase();

  // Ignore x and z keys since they are only for octave adjustment
  if (note !== "X" && note !== "Z") {
    synth.triggerKey(note, false); // On keyup, stop the note
  }
});

// Form elements (for saving patches)
const savedAdsr = document.querySelector("#savedAdsr");
const savedWaveform = document.querySelector("#savedWaveform");
const savedVolume = document.querySelector("#savedVolume");

// ADSR adjustment
envelopeSelector.on("change", (v) => {
  savedAdsr.value = v // Stores a float array
});

// Waveform adjustment
waveformSelector.on("change", (v) => {
  savedWaveform.value = v; // Stores the waveform index, not the waveform name
})

// Master volume adjustment
volumeSlider.on("change", (v) => {
  gainNode.gain.value = v;
  // Also rewrite the form element
  savedVolume.value = v;
});
