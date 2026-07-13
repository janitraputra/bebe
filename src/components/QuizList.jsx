import { useEffect, useState } from "react";
import { listQuizzes, deleteQuiz } from "../lib/storage";

export default function QuizList({ onPlay }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setQuizzes(await listQuizzes());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id) {
    if (!confirm("Hapus kuis ini?")) return;
    await deleteQuiz(id);
    refresh();
  }

  if (loading) return <p>Memuat...</p>;

  if (quizzes.length === 0) {
    return (
      <div className="quiz-list">
        <h2>Kuis Saya</h2>
        <div className="empty-state">
          <span className="empty-state-emoji">🌷</span>
          <p className="hint">
            Belum ada kuis di sini. Unggah file PDF/Word dulu di menu "Unggah Soal" ya!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-list">
      <h2>Kuis Saya</h2>
      <ul className="quiz-cards">
        {quizzes.map((q) => (
          <li key={q.id} className="quiz-card">
            <div className="quiz-card-info">
              <strong>{q.name}</strong>
              <span>{q.questionCount} soal</span>
              <span className="muted">
                {new Date(q.createdAt).toLocaleDateString("id-ID")}
              </span>
            </div>
            <div className="quiz-card-actions">
              <button className="primary" onClick={() => onPlay(q.id)}>
                Mulai
              </button>
              <button className="ghost" onClick={() => handleDelete(q.id)}>
                Hapus
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
