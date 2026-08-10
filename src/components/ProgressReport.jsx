import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Rocket, Flame, Trophy, Award, Star, Target, ListChecks, Printer } from "lucide-react";
import { PIE_COLORS } from "../lib/progress";

// One icon per achievement id from computeAchievements() in lib/progress.js
// — kept here rather than in the data layer since it's purely presentational.
const ACHIEVEMENT_ICONS = {
  "first-quiz": Rocket,
  "streak-3": Flame,
  "streak-7": Trophy,
  "subject-master": Award,
  "well-rounded": Star,
  "perfect-score": Target,
  "quiz-regular": ListChecks,
};

// Pure presentational — reused for both the logged-in student's own
// "Progress report" tab and, per-student, inside the teacher dashboard.
// `weakTopics` + `onPractice` are optional: the teacher dashboard omits
// them, since "practice this" only makes sense from the student's own view.
// `achievements` is optional too, but shown in both views (read-only, no
// callback needed) since a teacher seeing a student's earned badges isn't
// a privacy concern — it's the same mastery data already on this page.
export default function ProgressReport({ styles, grade, studentName, pieData, overallPct, subjects, mastery, attempts, weakTopics, onPractice, achievements }) {
  return (
    <div style={{ padding: "4px 4px 24px" }}>
      <div style={styles.dmc} className="print-report">
        <div style={styles.dmcHeader}>
          <div>
            <div style={styles.dmcTitle}>Progress Report</div>
            <div style={styles.dmcSub}>{studentName || "Student"} · Grade {grade}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="no-print"
              style={styles.printBtn}
              onClick={() => window.print()}
              title="Print or save this report as a PDF"
            >
              <Printer size={14} /> Print / Save PDF
            </button>
            {overallPct !== null && (
              <div className="stamp" style={styles.stampCircle}>
                <div style={styles.stampPct}>{overallPct}%</div>
                <div style={styles.stampLabel}>overall</div>
              </div>
            )}
          </div>
        </div>

        {onPractice && weakTopics && weakTopics.length > 0 && (
          <div style={styles.focusCard}>
            <div style={styles.focusTitle}>Focus areas</div>
            <div style={styles.focusSub}>Your lowest-scoring topics — practice these next.</div>
            {weakTopics.map((t) => (
              <div key={`${t.subjectId}-${t.topic}`} style={styles.focusRow}>
                <div style={styles.focusInfo}>
                  <div style={styles.focusTopic}>{t.topic}</div>
                  <div style={styles.focusMeta}>{t.subjectLabel} · {t.pct}% · {t.attempts} quiz{t.attempts === 1 ? "" : "zes"}</div>
                </div>
                <button style={styles.focusBtn} onClick={() => onPractice(t.subjectId, t.topic)}>
                  Practice this
                </button>
              </div>
            ))}
          </div>
        )}

        {achievements && achievements.length > 0 && (
          <div style={styles.achievementsCard}>
            <div style={styles.focusTitle}>Achievements</div>
            <div style={styles.achievementsGrid}>
              {achievements.map((a) => {
                const Icon = ACHIEVEMENT_ICONS[a.id];
                return (
                  <div
                    key={a.id}
                    style={{ ...styles.badge, ...(a.earned ? styles.badgeEarned : styles.badgeLocked) }}
                    title={a.description}
                  >
                    <Icon size={18} />
                    <span>{a.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={styles.reportGrid}>
          <div style={styles.pieWrap}>
            {pieData.length === 0 ? (
              <div style={styles.emptyState}>No quiz attempts yet. Use "Quiz me" in any subject to start tracking progress.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={PIE_COLORS[d.key]} stroke="#F5FAF3" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={styles.subjectTable}>
            {subjects.map((s) => {
              const m = mastery(s.id);
              const list = (attempts[grade] && attempts[grade][s.id]) || [];
              return (
                <div key={s.id} style={styles.tableRow}>
                  <div style={styles.tableSubject}>{s.label}</div>
                  <div style={styles.tableBarTrack}>
                    <div
                      style={{
                        ...styles.tableBarFill,
                        width: `${m ?? 0}%`,
                        background: m === null ? "#C9DDC3" : m >= 70 ? PIE_COLORS.mastered : PIE_COLORS.needsWork,
                      }}
                    />
                  </div>
                  <div style={styles.tableScore}>{m === null ? "—" : `${m}%`}</div>
                  <div style={styles.tableAttempts}>{list.length} quiz{list.length === 1 ? "" : "zes"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
