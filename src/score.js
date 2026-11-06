import { gradeQuestion } from './grade.js';

export function scoreExam(questions, answers, penaltyFactor) {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let pending = 0;

  questions.forEach((question, index) => {
    const status = gradeQuestion(question, answers[index]);
    if (status === 'correct') correct += 1;
    else if (status === 'incorrect') wrong += 1;
    else if (status === 'pending') pending += 1;
    else skipped += 1;
  });

  const penalty = Number.isFinite(penaltyFactor) ? penaltyFactor : 0;
  const raw = Math.max(0, correct - wrong * penalty);
  const total = questions.length;
  const scoreOutOf10 = total === 0 ? 0 : (raw / total) * 10;
  return {
    correct,
    wrong,
    skipped,
    pending,
    raw,
    scoreOutOf10,
    scoreLabel: scoreOutOf10.toFixed(2).replace('.00', '')
  };
}
