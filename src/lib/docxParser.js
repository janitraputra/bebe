import JSZip from "jszip";

// A .docx file is a zip of XML parts. Word marks highlighted text with a
// <w:highlight w:val="yellow|green|cyan|.../> element inside a run's
// properties (<w:rPr>), or sometimes with background shading (<w:shd>)
// instead. We treat any non-"none"/non-"auto"/non-white value on either
// as "highlighted", so it works regardless of which color was used.

function runIsHighlighted(rPr) {
  if (!rPr) return false;
  const highlight = rPr.getElementsByTagName("w:highlight")[0];
  if (highlight) {
    const val = highlight.getAttribute("w:val");
    if (val && val !== "none") return true;
  }
  const shd = rPr.getElementsByTagName("w:shd")[0];
  if (shd) {
    const fill = (shd.getAttribute("w:fill") || "").toLowerCase();
    if (fill && fill !== "auto" && fill !== "ffffff") return true;
  }
  return false;
}

function paragraphToLine(pNode) {
  const segments = [];
  const runs = pNode.getElementsByTagName("w:r");
  for (const run of Array.from(runs)) {
    const rPr = run.getElementsByTagName("w:rPr")[0];
    const highlighted = runIsHighlighted(rPr);
    const tNodes = run.getElementsByTagName("w:t");
    let text = "";
    for (const t of Array.from(tNodes)) text += t.textContent;
    if (run.getElementsByTagName("w:tab").length) text += "\t";
    if (!text) continue;
    segments.push({ text, highlighted });
  }
  return segments;
}

// Parses a .docx File/Blob into an array of "lines", each an array of
// { text, highlighted } segments, mirroring pdfParser's output shape so
// questionBuilder can treat both sources identically.
export async function parseDocx(file) {
  const zip = await JSZip.loadAsync(file);
  const docXmlEntry = zip.file("word/document.xml");
  if (!docXmlEntry) {
    throw new Error("File .docx tidak valid atau rusak (document.xml tidak ditemukan)");
  }
  const xmlText = await docXmlEntry.async("text");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");

  const parserError = xmlDoc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("Gagal membaca isi file .docx");
  }

  const paragraphs = xmlDoc.getElementsByTagName("w:p");
  const lines = [];
  for (const p of Array.from(paragraphs)) {
    const segments = paragraphToLine(p);
    const text = segments.map((s) => s.text).join("").trim();
    if (text.length === 0) {
      lines.push({ segments: [], blank: true });
    } else {
      lines.push({ segments, blank: false });
    }
  }
  return lines;
}
