import { speak, isTtsSupported } from "./speech";

// Feedback on answering: a spoken human-like voice via the browser's
// text-to-speech engine. Falls back to a plain beep tone if TTS isn't
// available on the device/browser.

let ctx = null;
function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
  }
  return ctx;
}

function beep({ freq, duration, delay = 0, type = "sine", gain = 0.2 }) {
  const audioCtx = getCtx();
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(audioCtx.destination);
  const start = audioCtx.currentTime + delay;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function beepCorrect() {
  try {
    beep({ freq: 660, duration: 0.12, delay: 0 });
    beep({ freq: 880, duration: 0.18, delay: 0.12 });
  } catch {
    // audio not available (e.g. autoplay blocked) - fail silently
  }
}

function beepWrong() {
  try {
    beep({ freq: 220, duration: 0.28, type: "sawtooth", gain: 0.15 });
  } catch {
    // ignore
  }
}

export function playCorrect() {
  if (isTtsSupported()) {
    speak("benar sayangku cintaku");
  } else {
    beepCorrect();
  }
}

export function playWrong() {
  if (isTtsSupported()) {
    speak("salah sayangku cintaku");
  } else {
    beepWrong();
  }
}
