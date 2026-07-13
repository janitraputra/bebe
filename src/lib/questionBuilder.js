// Turns the flat "lines" array produced by docxParser/pdfParser into
// structured quiz questions: multiple-choice (option highlighted = correct)
// or fill-in-the-blank (highlighted words inside the sentence = answers).

const QUESTION_START_RE = /^\s*(?:soal\s*)?(\d{1,3})[.\)]\s*/i;
const OPTION_START_RE = /^\s*([A-Ea-e])[.\)]\s*/;

function lineText(line) {
  return line.segments.map((s) => s.text).join("");
}

function stripQuestionPrefix(text) {
  return text.replace(QUESTION_START_RE, "").trim();
}

function stripOptionPrefix(text) {
  return text.replace(OPTION_START_RE, "").trim();
}

function groupLines(lines) {
  const startIndexes = [];
  lines.forEach((line, i) => {
    if (line.blank) return;
    if (QUESTION_START_RE.test(lineText(line))) startIndexes.push(i);
  });

  if (startIndexes.length > 0) {
    const groups = [];
    for (let g = 0; g < startIndexes.length; g++) {
      const start = startIndexes[g];
      const end = g + 1 < startIndexes.length ? startIndexes[g + 1] : lines.length;
      const groupLines = lines.slice(start, end).filter((l) => !l.blank);
      if (groupLines.length > 0) groups.push(groupLines);
    }
    return groups;
  }

  // fallback: no numbering detected anywhere, split on blank-line separators
  const groups = [];
  let current = [];
  for (const line of lines) {
    if (line.blank) {
      if (current.length > 0) groups.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function buildMultipleChoice(stemLines, optionLines) {
  const stemText = stripQuestionPrefix(stemLines.map(lineText).join(" ").trim());
  const options = optionLines.map((line) => ({
    text: stripOptionPrefix(lineText(line)),
    highlighted: line.segments.some((s) => s.highlighted),
  }));
  const correctIndexes = options
    .map((o, i) => (o.highlighted ? i : -1))
    .filter((i) => i !== -1);

  return {
    type: "mc",
    stem: stemText,
    options: options.map((o) => o.text),
    correctIndex: correctIndexes.length > 0 ? correctIndexes[0] : null,
    ambiguous: correctIndexes.length > 1,
    unresolved: correctIndexes.length === 0,
  };
}

function buildFillInBlank(groupLines) {
  // Flatten all segments across lines, inserting a space between lines.
  const flat = [];
  groupLines.forEach((line, idx) => {
    if (idx > 0) flat.push({ text: " ", highlighted: false });
    line.segments.forEach((seg) => flat.push({ ...seg }));
  });

  if (flat.length > 0) {
    // strip only the leading numbering, keep trailing whitespace intact so
    // spacing around an immediately-following blank isn't lost
    flat[0] = { ...flat[0], text: flat[0].text.replace(QUESTION_START_RE, "") };
  }

  let display = "";
  const answers = [];
  let i = 0;
  while (i < flat.length) {
    const seg = flat[i];
    if (seg.highlighted && seg.text.trim().length > 0) {
      let combined = "";
      while (i < flat.length && flat[i].highlighted) {
        combined += flat[i].text;
        i++;
      }
      display += "_____";
      answers.push(combined.trim());
    } else {
      display += seg.text;
      i++;
    }
  }

  return {
    type: "blank",
    stem: display.replace(/\s+/g, " ").trim(),
    answers,
    unresolved: answers.length === 0,
  };
}

export function buildQuestions(lines) {
  const groups = groupLines(lines);
  const questions = [];
  const warnings = [];

  groups.forEach((groupLines, idx) => {
    const optionLines = groupLines.filter((l) => OPTION_START_RE.test(lineText(l)));
    const stemLines = groupLines.filter((l) => !OPTION_START_RE.test(lineText(l)));

    let question;
    if (optionLines.length >= 2 && stemLines.length > 0) {
      question = buildMultipleChoice(stemLines, optionLines);
    } else {
      question = buildFillInBlank(groupLines);
    }

    if (!question.stem) return; // nothing usable

    if (question.unresolved) {
      warnings.push(
        `Soal ${idx + 1} dilewati: tidak ada jawaban yang ditandai stabilo terdeteksi.`
      );
      return;
    }
    if (question.ambiguous) {
      warnings.push(
        `Soal ${idx + 1}: lebih dari satu opsi ditandai, menggunakan yang pertama.`
      );
    }

    questions.push({ id: `q_${idx}_${Date.now()}`, ...question });
  });

  return { questions, warnings };
}
