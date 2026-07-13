import { useState } from "react";
import { speak, isTtsSupported } from "../lib/speech";
import { playCorrect, playWrong } from "../lib/sound";
import Confetti from "./Confetti";

export default function QuestionCardMC({ question, onAnswered }) {
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);

  function choose(index) {
    if (answered) return;
    setSelected(index);
    setAnswered(true);
    const correct = index === question.correctIndex;
    if (correct) playCorrect();
    else playWrong();
    onAnswered(correct);
  }

  function readAloud() {
    const optionLabels = ["A", "B", "C", "D", "E"];
    const optionsText = question.options
      .map((opt, i) => `${optionLabels[i]}. ${opt}`)
      .join(". ");
    speak(`${question.stem}. ${optionsText}`);
  }

  const isCorrect = answered && selected === question.correctIndex;

  return (
    <div className="question-card">
      <div className="question-card-bg" />
      <Confetti active={isCorrect} />
      <div className="question-stem-row">
        <p className="question-stem">{question.stem}</p>
        {isTtsSupported() && (
          <button className="icon-btn" onClick={readAloud} title="Bacakan soal">
            🔊
          </button>
        )}
      </div>
      <div className="options">
        {question.options.map((opt, i) => {
          const letter = ["A", "B", "C", "D", "E"][i];
          let cls = "option";
          if (answered) {
            if (i === question.correctIndex) cls += " correct";
            else if (i === selected) cls += " wrong";
          } else if (i === selected) {
            cls += " selected";
          }
          return (
            <button key={i} className={cls} disabled={answered} onClick={() => choose(i)}>
              <span className="option-letter">{letter}</span>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
