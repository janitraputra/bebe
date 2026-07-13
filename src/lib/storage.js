import { get, set, del } from "idb-keyval";

const INDEX_KEY = "eca_quiz_index";

function quizKey(id) {
  return `eca_quiz_${id}`;
}

export async function listQuizzes() {
  const index = (await get(INDEX_KEY)) || [];
  return index;
}

export async function saveQuiz({ name, questions, warnings, sourceType }) {
  const id = `quiz_${Date.now()}`;
  const quiz = {
    id,
    name,
    createdAt: new Date().toISOString(),
    sourceType,
    warnings,
    questions,
  };
  await set(quizKey(id), quiz);
  const index = await listQuizzes();
  index.unshift({
    id,
    name,
    createdAt: quiz.createdAt,
    questionCount: questions.length,
  });
  await set(INDEX_KEY, index);
  return quiz;
}

export async function getQuiz(id) {
  return get(quizKey(id));
}

export async function deleteQuiz(id) {
  await del(quizKey(id));
  const index = await listQuizzes();
  await set(
    INDEX_KEY,
    index.filter((q) => q.id !== id)
  );
}
