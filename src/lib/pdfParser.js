import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "./pdfWorkerEntry.js?worker&url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  await page.render({ canvasContext: ctx, viewport }).promise;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { pixels: imageData.data, width: canvas.width, height: canvas.height };
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

// Parses a PDF File/Blob into the same "lines" shape docxParser produces:
// an array of { segments: [{text, highlighted}], blank } objects.
export async function parsePdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const allLines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const [pixelInfo, textContent] = await Promise.all([
      renderPageToPixels(page, viewport),
      page.getTextContent(),
    ]);
    const lines = groupIntoLines(textContent.items, viewport, pixelInfo);
    allLines.push(...lines);
    allLines.push({ segments: [], blank: true }); // page break separator
  }
  return allLines;
}
