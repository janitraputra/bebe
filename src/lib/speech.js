// Thin wrappers around the browser's built-in speech APIs.
// TTS (speechSynthesis) is widely supported; STT (SpeechRecognition) is
// Chrome/Edge only today, so callers must feature-detect before using it.

export function isTtsSupported() {
  return "speechSynthesis" in window;
}

// Voices load asynchronously in most browsers - the first call to
// getVoices() often returns an empty list until "voiceschanged" fires.
let cachedVoices = [];
if (isTtsSupported()) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

// Picks the most natural-sounding installed voice for a language, favoring
// higher-quality engines (Google/Natural/Neural/Online) over the default
// robotic-sounding system voice.
function pickVoice(lang) {
  const prefix = lang.split("-")[0];
  const candidates = cachedVoices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (candidates.length === 0) return null;
  const qualityRe = /google|natural|neural|online/i;
  const preferred = candidates.find((v) => qualityRe.test(v.name));
  return preferred || candidates[0];
}

export function speak(text, { lang = "id-ID", rate = 0.8, pitch = 1 } = {}) {
  if (!isTtsSupported() || !text) return;
  window.speechSynthesis.cancel(); // stop anything currently playing
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = rate;
  utter.pitch = pitch;
  const voice = pickVoice(lang);
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}

export function isSttSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Records a single utterance and resolves with the recognized text.
// Returns a controller so the caller can cancel an in-flight listen.
export function listenOnce({ lang = "id-ID" } = {}) {
  const SpeechRecognitionImpl =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionImpl) {
    return {
      promise: Promise.reject(new Error("Speech recognition not supported")),
      cancel: () => {},
    };
  }

  const recognition = new SpeechRecognitionImpl();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const promise = new Promise((resolve, reject) => {
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript ?? "";
      resolve(text);
    };
    recognition.onerror = (event) => {
      reject(new Error(event.error || "speech recognition error"));
    };
    recognition.onend = () => {
      // if it ended without ever firing onresult (e.g. no speech detected),
      // resolve empty; a prior onresult call already "won" the promise
      resolve("");
    };
    recognition.start();
  });

  return {
    promise,
    cancel: () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    },
  };
}
