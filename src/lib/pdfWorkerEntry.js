// pdf.js's worker runs in its own global scope (a separate thread), so the
// Promise.withResolvers polyfill in main.jsx never reaches it. This wrapper
// applies the same polyfill inside the worker before loading the real
// pdf.worker.mjs, so older Safari doesn't crash there too.
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import "pdfjs-dist/build/pdf.worker.mjs";
