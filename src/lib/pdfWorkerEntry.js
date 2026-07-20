// pdf.js's worker runs in its own global scope (a separate thread), so the
// polyfills in main.jsx never reach it. This wrapper applies the same
// polyfills inside the worker before loading the real pdf.worker.mjs, so
// older Safari doesn't crash there too.
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

if (typeof URL.parse !== "function") {
  URL.parse = function (url, base) {
    try {
      return base !== undefined ? new URL(url, base) : new URL(url);
    } catch {
      return null;
    }
  };
}

// Re-export (not just side-effect import) so pdf.js's own fallback path -
// which does `import(workerSrc)` and reads `.WorkerMessageHandler` off the
// resulting module namespace when a real Worker isn't usable - still finds
// what it expects. A bare side-effect import leaves that export missing,
// which is what broke the fallback on iPadOS.
export { WorkerMessageHandler } from "pdfjs-dist/build/pdf.worker.mjs";
