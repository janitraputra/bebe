import { useCountUp } from "../lib/useCountUp";

export default function ResultSummary({ total, score, onRetry, onExit }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const animatedScore = useCountUp(score);

  return (
    <div className="result-summary">
      <h2>Selesai!</h2>
      <p className="score-big">
        {animatedScore} / {total}
      </p>
      <p className="hint">Kamu menjawab benar {pct}% dari soal.</p>
      <div className="result-actions">
        <button className="primary" onClick={onRetry}>
          Ulangi Kuis
        </button>
        <button className="ghost" onClick={onExit}>
          Kembali ke Daftar Kuis
        </button>
      </div>
    </div>
  );
}
