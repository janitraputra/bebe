import { useState } from "react";
import "./App.css";
import UploadView from "./components/UploadView";
import QuizList from "./components/QuizList";
import QuizPlayer from "./components/QuizPlayer";

export default function App() {
  const [view, setView] = useState("list"); // 'list' | 'upload' | 'play'
  const [activeQuizId, setActiveQuizId] = useState(null);

  function playQuiz(id) {
    setActiveQuizId(id);
    setView("play");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>
          <span className="logo-emoji">🌸</span> HafalYuk
        </h1>
        <nav>
          <span
            className="nav-pill"
            style={{
              transform: `translateX(${view === "upload" ? "100%" : "0"})`,
              opacity: view === "play" ? 0 : 1,
            }}
          />
          <button
            className={view === "list" ? "nav-btn active" : "nav-btn"}
            onClick={() => setView("list")}
          >
            Kuis Saya
          </button>
          <button
            className={view === "upload" ? "nav-btn active" : "nav-btn"}
            onClick={() => setView("upload")}
          >
            Unggah Soal
          </button>
        </nav>
      </header>

      <main className="app-main">
        <div key={view} className="view-enter">
          {view === "upload" && (
            <UploadView
              onQuizSaved={(id) => {
                playQuiz(id);
              }}
            />
          )}
          {view === "list" && <QuizList onPlay={playQuiz} />}
          {view === "play" && (
            <QuizPlayer quizId={activeQuizId} onExit={() => setView("list")} />
          )}
        </div>
      </main>
    </div>
  );
}
