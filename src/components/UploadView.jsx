import { useRef, useState } from "react";
import { buildQuestions } from "../lib/questionBuilder";
import { saveQuiz } from "../lib/storage";

export default function UploadView({ onQuizSaved }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { warnings, count }
  const fileInputRef = useRef(null);

  async function handleFile(file) {
    setBusy(true);
    setError(null);
    setResult(null);
    setStatus("Membaca file...");
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      let lines;
      if (ext === "pdf") {
        const { parsePdf } = await import("../lib/pdfParser");
        lines = await parsePdf(file, setStatus);
      } else if (ext === "docx") {
        const { parseDocx } = await import("../lib/docxParser");
        lines = await parseDocx(file);
      } else {
        throw new Error("Format tidak didukung. Gunakan file .pdf atau .docx");
      }

      const { questions, warnings } = buildQuestions(lines);
      if (questions.length === 0) {
        throw new Error(
          "Tidak ada soal yang berhasil dikenali. Pastikan jawaban benar sudah ditandai stabilo di dalam file."
        );
      }

      const quiz = await saveQuiz({
        name: file.name.replace(/\.(pdf|docx)$/i, ""),
        questions,
        warnings,
        sourceType: ext,
      });

      setResult({ warnings, count: questions.length });
      onQuizSaved?.(quiz.id);
    } catch (err) {
      setError(err.message || "Gagal memproses file.");
    } finally {
      setBusy(false);
      setStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="upload-view">
      <h2>Unggah Soal</h2>
      <p className="hint">
        Unggah file PDF atau Word (.docx) berisi daftar soal. Tandai jawaban
        yang benar dengan stabilo (warna apa saja) sebelum diunggah &mdash;
        sistem akan otomatis menyembunyikannya dan membuat kuis interaktif.
      </p>

      <label
        className={`dropzone ${busy ? "busy" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {busy ? (
          <>
            <span className="spinner" />
            {status || "Memproses file..."}
          </>
        ) : (
          <>
            <span className="dropzone-icon">📄</span>
            Klik atau seret file PDF/Word ke sini
          </>
        )}
      </label>

      {error && <div className="alert error">{error}</div>}

      {result && (
        <div className="alert success">
          <p>
            Berhasil membuat {result.count} soal. Buka menu "Kuis Saya" untuk
            mulai belajar.
          </p>
          {result.warnings.length > 0 && (
            <details>
              <summary>{result.warnings.length} peringatan</summary>
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
