import { useMemo } from "react";

const PARTICLES = ["🎉", "✨", "💗", "⭐", "🌸"];

// A small celebratory burst shown once when `active` becomes true.
export default function Confetti({ active }) {
  const pieces = useMemo(() => {
    if (!active) return [];
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      emoji: PARTICLES[i % PARTICLES.length],
      tx: Math.round((Math.random() - 0.5) * 220),
      ty: Math.round(-(60 + Math.random() * 90)),
      rot: Math.round((Math.random() - 0.5) * 360),
      delay: (Math.random() * 0.15).toFixed(2),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
            "--rot": `${p.rot}deg`,
            animationDelay: `${p.delay}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
