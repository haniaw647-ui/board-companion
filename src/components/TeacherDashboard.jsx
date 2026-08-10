import React, { useEffect, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import * as db from "../lib/db";
import { subjectMastery as masteryFor, computePieData, overallPct as overallPctFor, computeAchievements, PIE_COLORS } from "../lib/progress";
import { SUBJECTS, subjectsForGrade } from "../lib/subjects";
import ProgressReport from "./ProgressReport";

// Teacher-only view: a roster of students with per-student progress/mastery.
// Deliberately never imports or calls anything chat-related — that stays
// private to each student, both here (by omission) and at the database
// layer (chat_history has no teacher-read RLS policy at all).
//
// The roster only ever shows students who joined THIS teacher's class via
// their join code — not every student in the app. See is_teacher_of() in
// supabase/schema.sql for the RLS side of that scoping.
export default function TeacherDashboard({ styles, teacherId, teacherName, onSignOut }) {
  const [grade, setGrade] = useState(11);
  const [classInfo, setClassInfo] = useState(null);
  const [roster, setRoster] = useState([]);
  const [attemptsByUser, setAttemptsByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const gradeSubjects = subjectsForGrade(grade);

  useEffect(() => {
    (async () => {
      const cls = await db.getOrCreateClassForTeacher(teacherId);
      setClassInfo(cls);
      const students = await db.getStudentRoster(cls.id);
      setRoster(students);
      const attempts = await db.getAllAttemptsForRoster(students.map((s) => s.id));
      setAttemptsByUser(attempts);
      setLoading(false);
    })();
  }, [teacherId]);

  function copyJoinCode() {
    if (!classInfo) return;
    navigator.clipboard?.writeText(classInfo.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={styles.homePage}>
      <div style={styles.headerTop}>
        <div style={styles.headerLeft}>
          <div style={styles.crest} />
          <div style={styles.headerWordmark}>Board Companion</div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.gradeToggle}>
            {[11, 12].map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                style={{ ...styles.gradeBtn, ...(grade === g ? styles.gradeBtnActive : {}) }}
              >
                Grade {g}
              </button>
            ))}
          </div>
          <div style={styles.nameForm}>
            <div style={styles.studentBadge}>{teacherName || "Teacher"}</div>
            <button onClick={onSignOut} style={styles.nameBtn}>
              <LogOut size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div style={styles.hero}>
        <div style={styles.heroText}>Teacher Dashboard</div>
        <div style={styles.heroSub}>Grade {grade} roster · progress only, chats stay private to each student.</div>
      </div>

      {classInfo && (
        <div style={styles.importBanner}>
          <span>
            Your class code: <strong style={{ letterSpacing: 2 }}>{classInfo.join_code}</strong> — share it with students so they can join when they sign up.
          </span>
          <button style={styles.nameBtn} onClick={copyJoinCode}>
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>
      )}

      <div style={{ padding: "4px 24px 40px" }}>
        <div style={styles.dmc}>
          {loading ? (
            <div style={styles.emptyState}>Loading roster…</div>
          ) : roster.length === 0 ? (
            <div style={styles.emptyState}>No students yet — share your class code above so students can join.</div>
          ) : (
            roster.map((student) => {
              const attempts = attemptsByUser[student.id] || {};
              const pct = overallPctFor(attempts, grade, gradeSubjects);
              const isOpen = expandedId === student.id;
              return (
                <div key={student.id} style={{ borderBottom: "1px solid #C9DDC3" }}>
                  <button
                    onClick={() => setExpandedId(isOpen ? null : student.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", background: "none", border: "none", cursor: "pointer",
                      padding: "14px 4px", fontFamily: "Arial, sans-serif", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 14, color: "#2F3D30", fontWeight: 600 }}>{student.name || "Unnamed student"}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999,
                          background: pct === null ? "#DCEED7" : pct >= 70 ? "#D9F0E4" : "#E3EFC4",
                          color: pct === null ? "#7C8870" : pct >= 70 ? PIE_COLORS.mastered : PIE_COLORS.needsWork,
                        }}
                      >
                        {pct === null ? "No attempts" : `${pct}% overall`}
                      </span>
                      <ChevronDown
                        size={16}
                        color="#93A683"
                        style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                      />
                    </span>
                  </button>
                  {isOpen && (
                    <ProgressReport
                      styles={styles}
                      grade={grade}
                      studentName={student.name}
                      pieData={computePieData(attempts, grade, gradeSubjects)}
                      overallPct={pct}
                      subjects={gradeSubjects}
                      mastery={(subj) => masteryFor(attempts, grade, subj)}
                      attempts={attempts}
                      achievements={computeAchievements(attempts, SUBJECTS)}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
