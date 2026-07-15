import * as pdfjsLib from "pdfjs-dist";

// iPadOS/iOS (Safari and Chrome-on-iOS, which is WebKit underneath too)
// creates the module Worker without throwing, but it never actually
// responds - getDocument() just hangs. Desktop/Android browsers don't have
// this problem, so only iOS needs the main-thread fallback below.
function needsMainThreadFallback() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Any browser on iOS/iPadOS is WebKit underneath (Apple requires it, so
  // even Chrome/CriOS on an iPhone or iPad has the same worker problem).
  // iPadOS 13+ reports as "Macintosh" in its UA, distinguished from a real
  // Mac by touch support.
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOSDevice) return true;
  // On desktop, only genuine Safari uses WebKit - Chrome/Edge/etc. on a Mac
  // include "Safari" in their UA too (for legacy compat) but also mention
  // their real engine, so exclude those.
  const isChromiumFamily = /Chrome|Chromium|CriOS|Edg|OPR/.test(ua);
  const mentionsSafari = /Safari/.test(ua);
  return mentionsSafari && !isChromiumFamily;
}

// We create the Worker ourselves (Vite's officially-supported pattern for
// bundling workers) and hand it to pdf.js as a `port`, instead of giving
// pdf.js a `workerSrc` URL string and letting it create the Worker
// internally. pdf.js's own internal creation path has an automatic fallback
// for when a real Worker can't be made, but that fallback dynamically
// import()s the same URL and reads a named export off it - and Vite's
// worker-chunk build strips that export, so the fallback itself throws
// instead of falling back cleanly. Wiring up our own Worker sidesteps that
// fragile path - but on iOS, we skip the real Worker entirely (it silently
// never responds there) and run pdf.js on the main thread instead: we
// import the same polyfilled module normally (not through Vite's `?worker`
// pipeline, so its exports/side effects survive), which sets
// `globalThis.pdfjsWorker` - pdf.js checks for that before ever trying to
// create a real Worker, so it goes straight to (working) main-thread mode.
async function createPdfWorker() {
  if (needsMainThreadFallback()) {
    await import("./pdfWorkerEntry.js");
    return null;
  }
  const port = new Worker(new URL("./pdfWorkerEntry.js", import.meta.url), {
    type: "module",
  });
  return new pdfjsLib.PDFWorker({ port });
}

// Highlights show up in two very different ways depending on how the PDF was
// produced:
//  1. Real "Highlight" annotations (e.g. drawn with Acrobat's highlighter).
//  2. A colored rectangle baked directly into the page content (this is what
//     Word/LibreOffice produce when you export a document that has
//     highlighted text to PDF - there's no annotation object at all).
// Rather than special-case both, we render the page to a canvas (which
// composites annotations + page content exactly like a PDF viewer would)

// and then sample the pixel color behind each word. Any patch of saturated,
// non-white, non-black color behind a word means it's highlighted -
// regardless of which mechanism produced it or what color was used.

function isHighlightPixel(r, g, b, a) {
  if (a < 40) return false; // transparent
  if (r > 248 && g > 248 && b > 248) return false; // near-white background
  if (r < 80 && g < 80 && b < 80) return false; // dark text ink
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min > 10; // tinted color (even pale), not a gray/black/white shade
}

function sampleIsHighlighted(pixels, canvasWidth, canvasHeight, cx0, cy0, cx1, cy1) {
  const x0 = Math.max(0, Math.floor(cx0));
  const y0 = Math.max(0, Math.floor(cy0));
  const x1 = Math.min(canvasWidth - 1, Math.ceil(cx1));
  const y1 = Math.min(canvasHeight - 1, Math.ceil(cy1));
  if (x1 <= x0 || y1 <= y0) return false;

  const stepX = Math.max(1, Math.floor((x1 - x0) / 6));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 4));
  let total = 0;
  let hits = 0;
  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      const idx = (y * canvasWidth + x) * 4;
      total++;
      if (isHighlightPixel(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3])) {
        hits++;
      }
    }
  }
  return total > 0 && hits / total > 0.08;
}

function itemToPdfRect(item) {
  // transform = [scaleX, skewX, skewY, scaleY, translateX, translateY]
  const x0 = item.transform[4];
  const y0 = item.transform[5];
  const height = Math.abs(item.transform[3]) || Math.abs(item.transform[0]) || 1;
  const width = item.width || 1;
  return { minX: x0, maxX: x0 + width, minY: y0, maxY: y0 + height };
}

async function renderPageToPixels(page, viewport) {
  const canvas = document.createElement("canvas");
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  await page.render({ canvasContext: ctx, viewport }).promise;
  const imageData = ctx.getImageData(0, 0, width, height);
  // Free the canvas backing store promptly - large documents render many of
  // these in a row, and low-memory devices (e.g. iPads) can struggle if they
  // pile up before garbage collection catches up.
  canvas.width = 0;
  canvas.height = 0;
  return { pixels: imageData.data, width, height };
}

// Groups text items into visual lines by rounding their baseline Y,
// then sorts each line left-to-right by X.
function groupIntoLines(items, viewport, pixelInfo) {
  const withRects = items
    .filter((it) => it.str.length > 0)
    .map((it) => ({ item: it, rect: itemToPdfRect(it) }));

  const rows = new Map();
  for (const entry of withRects) {
    const y = Math.round(entry.rect.minY / 3) * 3; // tolerance bucket
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(entry);
  }

  const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a); // top to bottom (PDF y grows upward)
  const lines = [];
  for (const y of sortedYs) {
    const rowEntries = rows.get(y).sort((a, b) => a.rect.minX - b.rect.minX);
    const segments = [];
    for (const { item, rect } of rowEntries) {
      if (!item.str) continue;
      const p1 = viewport.convertToViewportPoint(rect.minX, rect.minY);
      const p2 = viewport.convertToViewportPoint(rect.maxX, rect.maxY);
      const cx0 = Math.min(p1[0], p2[0]);
      const cx1 = Math.max(p1[0], p2[0]);
      const cy0 = Math.min(p1[1], p2[1]);
      const cy1 = Math.max(p1[1], p2[1]);
      const highlighted = sampleIsHighlighted(
        pixelInfo.pixels,
        pixelInfo.width,
        pixelInfo.height,
        cx0,
        cy0,
        cx1,
        cy1
      );
      segments.push({ text: item.str, highlighted });
    }
    const text = segments.map((s) => s.text).join("").trim();
    if (text.length === 0) {
      lines.push({ segments: [], blank: true });
    } else {
      lines.push({ segments, blank: false });
    }
  }
  return lines;
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function safeDestroy(resource) {
  if (!resource) return;
  if (typeof resource.destroy === "function") {
    resource.destroy();
  } else if (typeof resource.cleanup === "function") {
    resource.cleanup();
  } else if (typeof resource.terminate === "function") {
    resource.terminate();
  }
}

// Parses a PDF File/Blob into the same "lines" shape docxParser produces:
// an array of { segments: [{text, highlighted}], blank } objects.
// `onProgress(status)` is called with short human-readable status strings so
// slow devices (this renders every page to a canvas to detect highlighter
// color, which is memory/CPU heavy) can show real progress instead of
// looking frozen.
// pdfjs-dist ships cmap/standard-font/wasm/icc resources it needs for PDFs
// using non-embedded fonts or certain image codecs; without an explicit
// path it guesses a default that doesn't exist on our deployment (a
// GitHub Pages project site under a /bebe/ subpath), and on at least
// Safari/WebKit that missing-resource fetch appears to hang the whole
// document load rather than failing fast. These are copied into public/
// (see public/pdfjs/) at their exact pdfjs-dist versions.
const PDFJS_ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`;

export async function parsePdf(file, onProgress = () => {}) {
  const arrayBuffer = await file.arrayBuffer();
  onProgress("Menyiapkan pemroses PDF...");
  const worker = await createPdfWorker(); // null on iOS - main-thread fallback

  let pdf;
  try {
    pdf = await withTimeout(
      pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
        wasmUrl: `${PDFJS_ASSET_BASE}wasm/`,
        iccUrl: `${PDFJS_ASSET_BASE}iccs/`,
        ...(worker ? { worker } : {}),
      }).promise,
      30000,
      "Gagal memuat PDF: proses tidak merespons. Coba muat ulang halaman dan unggah lagi, atau coba dengan file yang lebih kecil."
    );

    const allLines = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress(`Memproses halaman ${pageNum} dari ${pdf.numPages}...`);
      const page = await pdf.getPage(pageNum);
      // A lower render scale keeps memory/CPU cost down on weaker devices
      // (e.g. iPads) - we only need enough resolution to reliably tell
      // highlighted text from plain text, not sharp visual quality.
      const viewport = page.getViewport({ scale: 1.25 });
      const [pixelInfo, textContent] = await Promise.all([
        renderPageToPixels(page, viewport),
        page.getTextContent(),
      ]);
      const lines = groupIntoLines(textContent.items, viewport, pixelInfo);
      allLines.push(...lines);
      allLines.push({ segments: [], blank: true }); // page break separator
      page.cleanup();
    }
    return allLines;
  } finally {
    safeDestroy(worker);
    safeDestroy(pdf);
  }
}
