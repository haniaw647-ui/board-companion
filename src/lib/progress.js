// Pure mastery/progress math, shared by the student's own ProgressReport tab
// and the teacher dashboard's per-student view. `attempts` is always the
// nested shape { [grade]: { [subjectId]: [{score,total,date,topic}, ...] } }.

export const PIE_COLORS = { mastered: "#0F6B4F", needsWork: "#C3D888", notStarted: "#D3E5CD" };

export function subjectMastery(attempts, grade, subjectId) {
  const list = (attempts[grade] && attempts[grade][subjectId]) || [];
  if (list.length === 0) return null;
  const avg = list.reduce((s, a) => s + a.score / a.total, 0) / list.length;
  return Math.round(avg * 100);
}

export function computePieData(attempts, grade, subjects) {
  let mastered = 0, needsWork = 0, notStarted = 0;
  subjects.forEach((s) => {
    const m = subjectMastery(attempts, grade, s.id);
    if (m === null) notStarted += 1;
    else if (m >= 70) mastered += 1;
    else needsWork += 1;
  });
  return [
    { name: "Mastered", value: mastered, key: "mastered" },
    { name: "Needs work", value: needsWork, key: "needsWork" },
    { name: "Not started", value: notStarted, key: "notStarted" },
  ].filter((d) => d.value > 0);
}

export function overallPct(attempts, grade, subjects) {
  const scored = subjects.map((s) => subjectMastery(attempts, grade, s.id)).filter((v) => v !== null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}

// Every quiz attempt is tagged with the exact topic it was generated for
// (see quiz.topic / db.insertAttempt), so mastery can be rolled up per
// topic, not just per subject. Surfaces the weakest few (< 70%, most
// recent first among ties) so a student has a concrete next thing to do
// instead of just a subject-level percentage.
export function weakTopics(attempts, grade, subjects, limit = 5) {
  const byTopic = [];
  subjects.forEach((s) => {
    const list = (attempts[grade] && attempts[grade][s.id]) || [];
    const rolled = {};
    list.forEach((a) => {
      if (!a.topic) return;
      const row = rolled[a.topic] || (rolled[a.topic] = { scoreSum: 0, totalSum: 0, count: 0, lastDate: "" });
      row.scoreSum += a.score;
      row.totalSum += a.total;
      row.count += 1;
      if (a.date && a.date > row.lastDate) row.lastDate = a.date;
    });
    Object.entries(rolled).forEach(([topic, r]) => {
      byTopic.push({
        subjectId: s.id,
        subjectLabel: s.label,
        topic,
        pct: Math.round((r.scoreSum / r.totalSum) * 100),
        attempts: r.count,
        lastDate: r.lastDate,
      });
    });
  });
  return byTopic
    .filter((t) => t.pct < 70)
    .sort((a, b) => a.pct - b.pct || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit);
}

// Daily study streak, derived from quiz-attempt dates across every grade
// and subject combined (a streak is about showing up, not any one
// subject). No separate "activity log" exists — `taken_at` on `attempts`
// is the only per-day timestamp this app records — so a streak day is
// "took at least one quiz that day." Each subject's attempt list is
// capped to the most recent 10 (see rowsToAttemptsMap in db.js), which
// only undercounts a streak for a student doing more than 10 quizzes in
// a single subject within the current streak window — an acceptable
// approximation rather than a reason to change that cap.
export function computeStreak(attempts) {
  const dates = new Set();
  Object.values(attempts).forEach((bySubject) => {
    Object.values(bySubject).forEach((list) => {
      list.forEach((a) => { if (a.date) dates.add(a.date); });
    });
  });
  const sorted = [...dates].sort();
  if (sorted.length === 0) return { current: 0, longest: 0, activeToday: false };

  const dayDiff = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);

  let longest = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = dayDiff(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const today = new Date().toISOString().slice(0, 10);
  const last = sorted[sorted.length - 1];
  const gapToToday = dayDiff(last, today);

  let current = 0;
  if (gapToToday <= 1) {
    current = 1;
    for (let i = sorted.length - 1; i > 0; i--) {
      if (dayDiff(sorted[i - 1], sorted[i]) === 1) current += 1;
      else break;
    }
  }
  return { current, longest, activeToday: gapToToday === 0 };
}

// Milestone badges, computed fresh on every render rather than stored — all
// the inputs (attempts, streak) already exist, so persisting "earned" state
// separately would just be a second source of truth that could drift.
// Spans every grade in `attempts` (not just the currently-selected one),
// matching computeStreak's "showing up is what counts" scope.
export function computeAchievements(attempts, subjects) {
  const grades = Object.keys(attempts);
  let totalAttempts = 0;
  let anyPerfect = false;
  const masteredKeys = new Set();

  grades.forEach((g) => {
    subjects.forEach((s) => {
      const list = (attempts[g] && attempts[g][s.id]) || [];
      totalAttempts += list.length;
      list.forEach((a) => { if (a.total > 0 && a.score === a.total) anyPerfect = true; });
      const m = subjectMastery(attempts, g, s.id);
      if (m !== null && m >= 70) masteredKeys.add(`${g}:${s.id}`);
    });
  });

  const { longest } = computeStreak(attempts);

  return [
    { id: "first-quiz", label: "First Steps", description: "Take your first quiz", earned: totalAttempts >= 1 },
    { id: "streak-3", label: "On a Roll", description: "Reach a 3-day study streak", earned: longest >= 3 },
    { id: "streak-7", label: "Committed", description: "Reach a 7-day study streak", earned: longest >= 7 },
    { id: "subject-master", label: "Subject Master", description: "Master a subject (70%+ average)", earned: masteredKeys.size >= 1 },
    { id: "well-rounded", label: "Well-Rounded", description: "Master 3 different subjects", earned: masteredKeys.size >= 3 },
    { id: "perfect-score", label: "Perfect Score", description: "Score 100% on a quiz", earned: anyPerfect },
    { id: "quiz-regular", label: "Quiz Regular", description: "Take 10 quizzes total", earned: totalAttempts >= 10 },
  ];
}
