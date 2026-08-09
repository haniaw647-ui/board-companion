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
