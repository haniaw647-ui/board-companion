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
