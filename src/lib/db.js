import { supabase } from "./supabaseClient";

const LOCAL_PREFIX = "board-companion:private:";
const IMPORT_DONE_KEY = LOCAL_PREFIX + "import-done";
const GRADES = [11, 12];
const SUBJECT_IDS = ["physics", "chemistry", "biology", "english", "urdu", "islamiat", "tarjumah"];

/* ---------- profile ---------- */

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role, class_id")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfileName(userId, name) {
  const { error } = await supabase.from("profiles").update({ name }).eq("id", userId);
  if (error) throw error;
}

/* ---------- attempts ---------- */

// Rows -> the nested { [grade]: { [subjectId]: [{score,total,date,topic}, ...capped 10] } }
// shape the rest of the app already expects, so progress.js/ProgressReport need no changes.
function rowsToAttemptsMap(rows) {
  const map = {};
  for (const row of rows) {
    const g = row.grade;
    map[g] = map[g] || {};
    map[g][row.subject_id] = map[g][row.subject_id] || [];
    map[g][row.subject_id].push({
      score: row.score,
      total: row.total,
      date: row.taken_at,
      topic: row.topic,
    });
  }
  for (const g of Object.keys(map)) {
    for (const subj of Object.keys(map[g])) {
      map[g][subj] = map[g][subj].slice(-10);
    }
  }
  return map;
}

export async function getAttempts(userId) {
  const { data, error } = await supabase
    .from("attempts")
    .select("grade, subject_id, score, total, taken_at, topic")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return rowsToAttemptsMap(data || []);
}

export async function insertAttempt(userId, grade, subjectId, { score, total, topic }) {
  const { error } = await supabase.from("attempts").insert({
    user_id: userId,
    grade,
    subject_id: subjectId,
    score,
    total,
    topic,
    taken_at: new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
}

export async function deleteAttemptsForSubject(userId, grade, subjectId) {
  const { error } = await supabase
    .from("attempts")
    .delete()
    .eq("user_id", userId)
    .eq("grade", grade)
    .eq("subject_id", subjectId);
  if (error) throw error;
}

/* ---------- chat history ---------- */

export async function getChatHistory(userId, grade, subjectId) {
  const { data, error } = await supabase
    .from("chat_history")
    .select("messages")
    .eq("user_id", userId)
    .eq("grade", grade)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.messages : [];
}

export async function saveChatHistory(userId, grade, subjectId, messages) {
  const { error } = await supabase
    .from("chat_history")
    .upsert(
      { user_id: userId, grade, subject_id: subjectId, messages, updated_at: new Date().toISOString() },
      { onConflict: "user_id,grade,subject_id" }
    );
  if (error) throw error;
}

export async function clearChatHistory(userId, grade, subjectId) {
  return saveChatHistory(userId, grade, subjectId, []);
}

/* ---------- classes ---------- */

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I mixups

function randomJoinCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  }
  return code;
}

// Every teacher has exactly one class for now (enforced by a unique
// constraint on classes.teacher_id). Created lazily on first dashboard load
// rather than at promotion time, since promotion happens via raw SQL
// (promote_teacher.sql) with no app code involved.
//
// This inserts first rather than "select, then insert if missing" —
// React 18 StrictMode (and just plain bad luck: two tabs, a fast reload)
// can run this twice concurrently, and a select-then-insert race lets both
// calls see "no existing class" and each create their own row. Inserting
// first and catching the unique-constraint conflict makes this atomic: the
// database decides who wins, and the loser just fetches the winner's row.
export async function getOrCreateClassForTeacher(teacherId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const join_code = randomJoinCode();
    const { data, error } = await supabase
      .from("classes")
      .insert({ teacher_id: teacherId, join_code })
      .select("id, name, join_code")
      .single();
    if (!error) return data;

    if (error.code === "23505" && error.message.includes("classes_teacher_id_key")) {
      // a concurrent call already created this teacher's class — use theirs
      const { data: existing, error: selectError } = await supabase
        .from("classes")
        .select("id, name, join_code")
        .eq("teacher_id", teacherId)
        .single();
      if (selectError) throw selectError;
      return existing;
    }
    if (error.code !== "23505") throw error; // a real error, not a code collision
    // else: join_code collided with someone else's class, retry with a new one
  }
  throw new Error("Could not create or find your class — try again.");
}

// Called during/after student signup with whatever code they typed in.
// Returns { joined: true, className } or { joined: false, error }.
export async function joinClassByCode(userId, code) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { joined: false, error: "Enter a class code." };

  const { data: cls, error: selectError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("join_code", trimmed)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!cls) return { joined: false, error: "That class code wasn't found." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ class_id: cls.id })
    .eq("id", userId);
  if (updateError) throw updateError;

  return { joined: true, className: cls.name };
}

/* ---------- teacher dashboard + class leaderboard ----------
   getStudentRoster/getAllAttemptsForRoster are shared by TeacherDashboard.jsx
   and the student-facing class leaderboard in App.jsx (see rankClassmates()
   in lib/progress.js) — same query, different RLS policy grants access
   depending on whether the caller is that class's teacher or a classmate. */

export async function getStudentRoster(classId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("role", "student")
    .eq("class_id", classId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Returns { [userId]: { [grade]: { [subjectId]: [attempts...] } } } so
// progress.js functions can be called per-student with the same signature
// used for the logged-in student's own data.
export async function getAllAttemptsForRoster(studentIds) {
  if (!studentIds.length) return {};
  const { data, error } = await supabase
    .from("attempts")
    .select("user_id, grade, subject_id, score, total, taken_at, topic")
    .in("user_id", studentIds)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const byUser = {};
  for (const row of data || []) {
    byUser[row.user_id] = byUser[row.user_id] || [];
    byUser[row.user_id].push(row);
  }
  const result = {};
  for (const id of studentIds) {
    result[id] = rowsToAttemptsMap(byUser[id] || []);
  }
  return result;
}

/* ---------- one-time import of pre-Supabase localStorage data ---------- */

export function hasLocalDataToImport() {
  if (localStorage.getItem(IMPORT_DONE_KEY)) return false;
  if (localStorage.getItem(LOCAL_PREFIX + "attempts")) return true;
  for (const g of GRADES) {
    for (const subj of SUBJECT_IDS) {
      if (localStorage.getItem(`${LOCAL_PREFIX}chat:${g}:${subj}`)) return true;
    }
  }
  return false;
}

export function markLocalImportDone() {
  localStorage.setItem(IMPORT_DONE_KEY, "1");
}

export async function importLocalProgress(userId) {
  const rawAttempts = localStorage.getItem(LOCAL_PREFIX + "attempts");
  if (rawAttempts) {
    const parsed = JSON.parse(rawAttempts);
    const rows = [];
    for (const grade of Object.keys(parsed)) {
      for (const subjectId of Object.keys(parsed[grade])) {
        for (const a of parsed[grade][subjectId]) {
          rows.push({
            user_id: userId,
            grade: Number(grade),
            subject_id: subjectId,
            score: a.score,
            total: a.total,
            topic: a.topic || null,
            taken_at: a.date || new Date().toISOString().slice(0, 10),
          });
        }
      }
    }
    if (rows.length) {
      const { error } = await supabase.from("attempts").insert(rows);
      if (error) throw error;
    }
  }

  for (const g of GRADES) {
    for (const subj of SUBJECT_IDS) {
      const raw = localStorage.getItem(`${LOCAL_PREFIX}chat:${g}:${subj}`);
      if (!raw) continue;
      const messages = JSON.parse(raw);
      if (messages.length) {
        await saveChatHistory(userId, g, subj, messages);
      }
    }
  }

  markLocalImportDone();
}
