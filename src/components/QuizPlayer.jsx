import { useEffect, useState } from "react";
import { getQuiz } from "../lib/storage";
import QuestionCardMC from "./QuestionCardMC";
import QuestionCardBlank from "./QuestionCardBlank";
import ResultSummary from "./ResultSummary";

export default function QuizPlayer({ quizId, onExit }) {
  const [quiz, setQuiz] = useState(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    getQuiz(quizId).then(setQuiz);
  }, [quizId]);

  if (!quiz) return <p>Memuat kuis...</p>;

  const question = quiz.questions[index];
  const isLast = index === quiz.questions.length - 1;

  function handleAnswered(correct) {
    setScore((s) => s + (correct ? 1 : 0));
    setAnswered(true);
  }

  function next() {
    setAnswered(false);
    if (isLast) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  if (finished) {
    return (
      <ResultSummary
        total={quiz.questions.length}
        score={score}
        onRetry={() => {
          setIndex(0);
          setScore(0);
          setAnswered(false);
          setFinished(false);
        }}
        onExit={onExit}
      />
    );
  }

  const progressPct = Math.round(((index + (answered ? 1 : 0)) / quiz.questions.length) * 100);

  return (
    <div className="quiz-player">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="quiz-player-header">
        <button className="ghost" onClick={onExit}>
          &larr; Keluar
        </button>
        <span>
          Soal {index + 1} dari {quiz.questions.length}
        </span>
        <span className="score-chip" key={score}>
          Skor: {score}
        </span>
      </div>

      {question.type === "mc" ? (
        <QuestionCardMC key={question.id} question={question} onAnswered={handleAnswered} />
      ) : (
        <QuestionCardBlank key={question.id} question={question} onAnswered={handleAnswered} />
      )}

      {answered && (
        <button className="primary next-btn" onClick={next}>
          {isLast ? "Selesai" : "Soal Berikutnya"}
        </button>
      )}
    </div>
  );
}
