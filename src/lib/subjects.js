import {
  Atom, FlaskConical, Dna, BookOpenText, Languages, Moon, ScrollText, Cpu, Sigma, Landmark,
} from "lucide-react";

// The single source of truth for which subjects exist — shared by the
// student app (App.jsx) and the teacher dashboard (TeacherDashboard.jsx),
// so a subject added here shows up in both places automatically.
//
// `grades` is omitted for subjects taught in both years. Islamic Studies is
// Grade-11-only and Pakistan Studies is Grade-12-only on the real Punjab
// Board course load (confirmed by the student, not just a missing-syllabus
// gap) — set explicitly so grade-scoped views (sidebar, progress report)
// hide them instead of showing an empty/inapplicable subject.
export const SUBJECTS = [
  { id: "physics", label: "Physics", urdu: "طبیعیات", icon: Atom },
  { id: "chemistry", label: "Chemistry", urdu: "کیمیا", icon: FlaskConical },
  { id: "biology", label: "Biology", urdu: "حیاتیات", icon: Dna },
  { id: "english", label: "English", urdu: "انگریزی", icon: BookOpenText },
  { id: "urdu", label: "Urdu", urdu: "اردو", icon: Languages },
  { id: "islamiat", label: "Islamic Studies", urdu: "اسلامیات", icon: Moon, grades: [11] },
  { id: "tarjumah", label: "Tarjumah-tul-Quran", urdu: "ترجمۃ القرآن", icon: ScrollText },
  { id: "computerscience", label: "Computer Science", urdu: "کمپیوٹر سائنس", icon: Cpu },
  { id: "math", label: "Mathematics", urdu: "ریاضی", icon: Sigma },
  { id: "pakstudy", label: "Pakistan Studies", urdu: "مطالعہ پاکستان", icon: Landmark, grades: [12] },
];

export function subjectsForGrade(grade) {
  return SUBJECTS.filter((s) => !s.grades || s.grades.includes(grade));
}
