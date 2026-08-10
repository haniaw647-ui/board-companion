import {
  Atom, FlaskConical, Dna, BookOpenText, Languages, Moon, ScrollText, Cpu, Sigma, Landmark,
} from "lucide-react";

// The single source of truth for which subjects exist — shared by the
// student app (App.jsx) and the teacher dashboard (TeacherDashboard.jsx),
// so a subject added here shows up in both places automatically.
export const SUBJECTS = [
  { id: "physics", label: "Physics", urdu: "طبیعیات", icon: Atom },
  { id: "chemistry", label: "Chemistry", urdu: "کیمیا", icon: FlaskConical },
  { id: "biology", label: "Biology", urdu: "حیاتیات", icon: Dna },
  { id: "english", label: "English", urdu: "انگریزی", icon: BookOpenText },
  { id: "urdu", label: "Urdu", urdu: "اردو", icon: Languages },
  { id: "islamiat", label: "Islamic Studies", urdu: "اسلامیات", icon: Moon },
  { id: "tarjumah", label: "Tarjumah-tul-Quran", urdu: "ترجمۃ القرآن", icon: ScrollText },
  { id: "computerscience", label: "Computer Science", urdu: "کمپیوٹر سائنس", icon: Cpu },
  { id: "math", label: "Mathematics", urdu: "ریاضی", icon: Sigma },
  { id: "pakstudy", label: "Pakistan Studies", urdu: "مطالعہ پاکستان", icon: Landmark },
];
