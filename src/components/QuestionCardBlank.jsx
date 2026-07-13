import { useState } from "react";
import { speak, isTtsSupported, isSttSupported, listenOnce } from "../lib/speech";
import { playCorrect, playWrong } from "../lib/sound";
import { isCloseEnough } from "../lib/fuzzyMatch";
import Confetti from "./Confetti";

const BLANK_TOKEN = "_____";

export default function QuestionCardBlank({ question, onAnswered }) {
  const parts = question.stem.split(BLANK_TOKEN);
  const [values, setValues] = useState(question.answers.map(() => ""));
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]); // per-blank correctness
  const [listeningAt, setListeningAt] = useState(null);
  const [recognitionCtl, setRecognitionCtl] = useState(null);

  function updateValue(i, val) {
    setValues((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  }

  function readAloud() {
    const spoken = parts.join(" titik-titik ");
    speak(spoken);
  }

  async function startListening(i) {
    if (answered) return;
    setListeningAt(i);
    const { promise, cancel } = listenOnce();
    setRecognitionCtl({ cancel });
    try {
      const text = await promise;
      if (text) updateValue(i, text);
    } catch {
      // recognition failed or was denied - user can still type manually
    } finally {
      setListeningAt(null);
      setRecognitionCtl(null);
    }
  }

  function stopListening() {
    recognitionCtl?.cancel();
    setListeningAt(null);
  }

  function check() {
    const perBlank = question.answers.map((answer, i) => isCloseEnough(values[i], answer));
    const allCorrect = perBlank.every(Boolean);
    setResults(perBlank);
    setAnswered(true);
    if (allCorrect) playCorrect();
    else playWrong();
    onAnswered(allCorrect);
  }

  const canCheck = values.every((v) => v.trim().length > 0);
  const isCorrect = answered && results.every(Boolean);

  return (
    <div className="question-card">
      <div className="question-card-bg" />
      <Confetti active={isCorrect} />
      <div className="question-stem-row">
        <p className="question-stem blank-stem">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < question.answers.length && (
                <span className="blank-input-group">
                  <input
                    type="text"
                    value={values[i]}
                    disabled={answered}
                    onChange={(e) => updateValue(i, e.target.value)}
                    placeholder="jawaban"
                    className={
                      answered ? (results[i] ? "blank-input ok" : "blank-input bad") : "blank-input"
                    }
                  />
                  {isSttSupported() && !answered && (
                    <button
                      type="button"
                      className={`icon-btn mic ${listeningAt === i ? "listening" : ""}`}
                      title="Jawab dengan suara"
                      onClick={() => (listeningAt === i ? stopListening() : startListening(i))}
                    >
                      🎤
                    </button>
                  )}
                </span>
              )}
            </span>
          ))}
        </p>
        {isTtsSupported() && (
          <button className="icon-btn" onClick={readAloud} title="Bacakan soal">
            🔊
          </button>
        )}
      </div>

      {!answered && (
        <button className="primary" disabled={!canCheck} onClick={check}>
          Periksa Jawaban
        </button>
      )}
    </div>
  );
}
