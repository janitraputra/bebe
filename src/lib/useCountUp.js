import { useEffect, useState } from "react";

// Animates a number counting up from 0 to `target` over `duration` ms.
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start = null;
    let raf;
    function tick(timestamp) {
      if (start === null) start = timestamp;
      const progress = Math.min(1, (timestamp - start) / duration);
      setValue(Math.round(progress * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
