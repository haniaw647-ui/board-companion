import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PIE_COLORS } from "../lib/progress";

// Pure presentational — reused for both the logged-in student's own
// "Progress report" tab and, per-student, inside the teacher dashboard.
export default function ProgressReport({ styles, grade, studentName, pieData, overallPct, subjects, mastery, attempts }) {
  return (
    <div style={{ padding: "4px 4px 24px" }}>
      <div style={styles.dmc}>
        <div style={styles.dmcHeader}>
          <div>
            <div style={styles.dmcTitle}>Progress Report</div>
            <div style={styles.dmcSub}>{studentName || "Student"} · Grade {grade}</div>
          </div>
          {overallPct !== null && (
            <div className="stamp" style={styles.stampCircle}>
              <div style={styles.stampPct}>{overallPct}%</div>
              <div style={styles.stampLabel}>overall</div>
            </div>
          )}
        </div>

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
