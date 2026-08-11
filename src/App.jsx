import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Sparkles, ClipboardList, Layers, ListChecks, RotateCcw,
  GraduationCap, ChevronDown, Loader2, Trash2, GitBranch, RefreshCw, X, Flame, Timer, Printer,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import * as db from "./lib/db";
import {
  subjectMastery as masteryFor,
  computePieData,
  overallPct as overallPctFor,
  weakTopics as weakTopicsFor,
  computeStreak,
  weekActivity,
  computeAchievements,
  rankClassmates,
  PIE_COLORS,
} from "./lib/progress";
import { SUBJECTS, subjectsForGrade } from "./lib/subjects";
import AuthScreen from "./components/AuthScreen";
import TeacherDashboard from "./components/TeacherDashboard";
import ProgressReport from "./components/ProgressReport";

/* ---------- Static config ---------- */

const CHAT_EXAMPLE_PROMPT = {
  physics: "Explain Newton's laws",
  chemistry: "Explain chemical bonding",
  biology: "Explain cell structure",
  english: "Explain a grammar rule",
  urdu: "Explain a poem's theme",
  islamiat: "Explain a Hadith's teaching",
  tarjumah: "Explain a verse's meaning",
  computerscience: "Explain how a for loop works",
  math: "Explain how to solve a quadratic equation",
  pakstudy: "Explain Pakistan's constitutional history",
};

const TOPIC_EXAMPLE = {
  physics: "Force and Motion",
  chemistry: "Chemical Bonding",
  biology: "Cell Structure",
  english: "Parts of Speech",
  urdu: "Ghazal",
  islamiat: "Pillars of Islam",
  tarjumah: "Surah Al-Fatiha",
  computerscience: "Python Programming",
  math: "Quadratic Equations",
  pakstudy: "Constitutional Development",
};

const QUICK_ACTIONS = [
  { id: "explain", label: "Explain a concept", icon: Sparkles, type: "chat", prompt: "Explain the topic I mention next in simple, board-exam-friendly language, with a short example." },
  { id: "notes", label: "Make revision notes", icon: ClipboardList, type: "notes" },
  { id: "flashcards", label: "Flashcards", icon: Layers, type: "flashcards" },
  { id: "mindmap", label: "Mind map", icon: GitBranch, type: "mindmap" },
  { id: "quiz", label: "Quiz me", icon: ListChecks, type: "quiz" },
];

const MODEL = "claude-sonnet-4-6";

/* ---------- Real Grade 11 syllabus: chapter/topic titles only, from the
   official PECTAA textbook table of contents. No book prose is stored or
   used here, only the structural list of chapter names, which lets the
   tutor reference the correct chapter when asked "chapter 1" etc. ---------- */

const SYLLABUS_11 = {
  physics: [
    "1. Measurements", "2. Force and Motion", "3. Circular and Rotational Motion",
    "4. Work, Energy and Power", "5. Solids and Fluid Dynamics", "6. Heat and Thermodynamics",
    "7. Waves and Vibrations", "8. Physical Optics and Gravitational Waves",
    "9. Electrostatics and Current Electricity", "10. Electromagnetism",
    "11. Special Theory of Relativity", "12. Nuclear and Particle Physics",
  ],
  chemistry: [
    "1. Periodic Table and Periodic Properties", "2. Atomic Structure", "3. Chemical Bonding",
    "4. Stoichiometry", "5. States and Phases of Matter", "6. Chemical Energetics",
    "7. Reaction Kinetics", "8. Chemical Equilibrium", "9. Acid-Base Chemistry",
    "10. Electrochemistry", "11. Hydrocarbons", "12. Nitrogen and Sulfur", "13. Halogens",
    "14. Atmosphere", "15. Basic Separation Techniques", "16. Lab Safety and Practical Skills",
  ],
  biology: [
    "1. Biodiversity and Classification", "2. Bacteria and Viruses",
    "3. Cells and Subcellular Organelles", "4. Molecular Biology", "5. Enzymes",
    "6. Bioenergetics", "7. Structural and Computational Biology", "8. Plant Physiology",
    "9. Human Digestive System", "10. Human Respiratory System", "11. Human Circulatory System",
    "12. Human Skeletal and Muscular Systems",
  ],
  islamiat: [
    "Bab 1: Quran-o-Hadith (Uloom-ul-Quran, Uloom-ul-Hadith)",
    "Bab 2: Imaniyat-o-Ibadaat (Tauheed, Malaika, Aakhirat par Iman; falsafa-e-Namaz/Saum/Hajj-o-Qurbani)",
    "Bab 3: Seerat-un-Nabi (SAW) — sarbarah-e-khandan, sarbarah-e-riyasat, sipahsalar, maeeshi taleemat",
    "Bab 4: Ikhlaq-o-Adaab (ijtemai khair-khwahi, akhlaqi razail se ijtenaab, muashrati taleemat)",
    "Bab 5: Husn-e-Muamlaat-o-Muashrat (huqooq-ul-ibaad, wirasat, nikah-o-talaq ki Islami taleemat)",
    "Bab 6: Barakat-e-Sirat-o-Mashaheer-e-Islam (Khilafat-e-Rashida, Ahl-e-Bait, Sufia-e-Karam)",
    "Bab 7: Islami Taleemat aur Asr-e-Hazir ke Taqaze (qanoon ki pasdari, nifaz-e-Islam ki zimmedariyan)",
    "Model Paper section (compulsory Islamiat, Grade 11)",
  ],
  urdu: {
    "Hamd-o-Naat": ["Hamd", "Naat"],
    "Nasr (Prose)": [
      "Akhlaq-e-Nabvi (SAW)", "Faaqe Mein Roza", "Makateeb-e-Ghalib",
      "Aik Ustad aur Adalat ke Kathghare Mein", "Charpai", "Aur Pakistan Ban Gaya",
      "Naya Qanoon", "Wallis", "Tareekh-e-Kafan", "Pakistani Zabanein aur Un ka Baahmi Rishta",
    ],
    "Nazm (Poetry)": [
      "Aye Wadi-e-Lolaab (Allama Iqbal)", "Aaunay Se Aanay Waalay Bata (Akhtar Sherani)",
      "Azaadi (Ehsan Danish)", "Ikhlas (Rehman Baba, trans. Prof. M. Tahir Khan)",
      "Kathra Uzhar (Syed Muhammad Jaffri)",
    ],
    "Ghazal": ["Mir Taqi Mir", "Firaq Gorakhpuri", "Muneer Niazi", "Ahmad Faraz", "Parveen Shakir"],
  },
  english: [
    "14 integrated units, each combining: Vocabulary & Grammar / Oral Communication Skills / Writing Skills.",
    "Recurring writing-skill strands across the year: paragraph & essay writing (informative, argumentative, analytical), objective summary & precis, book review, formal letter/email, narrative & descriptive writing, dialogue writing, editing & proofreading.",
    "Recurring grammar strands: parts of speech, tenses, word formation, prepositions, conjunctions, sentence structure, direct/indirect speech, idioms & proverbs.",
  ],
  tarjumah: [
    "Adaab-e-Tilawat-e-Quran-e-Majeed (etiquette of Quran recitation) — intro section",
    "Surah Al-Baqarah: Ayat 1-7, Ayat-ul-Kursi (255), Ayat 275, Ayat 284-286",
    "Surah Aal-e-Imran: Ayat 26-27, Ayat 102-104, Ayat 123-125, Ayat 134, Ayat 190-194",
    "Surah Al-Anfal: Ayat 1-4, Ayat 15, Ayat 45-48",
    "Surah At-Taubah: Ayat 24, Ayat 38-41, Ayat 60, Ayat 71-72, Ayat 100, Ayat 119, Ayat 128-129",
  ],
  computerscience: [
    "1. Introduction to Software Development",
    "2. Python Programming",
    "3. Algorithms and Problem Solving",
    "4. Computational Structures",
    "5. Data Analytics",
    "6. Emerging Technologies",
    "7. Legal and Ethical Aspects of Computing System",
    "8. Online Research and Digital Literacy",
    "9. Entrepreneurship in Digital Age",
  ],
  math: [
    "1. Complex Numbers",
    "2. Functions and Graphs",
    "3. Theory of Quadratic Functions",
    "4. Matrices and Determinants",
    "5. Partial Fractions",
    "6. Sequences and Series",
    "7. Permutations and Combinations",
    "8. Mathematical Inductions and Binomial Theorem",
    "9. Division of Polynomials",
    "10. Trigonometric Identities",
    "11. Trigonometric Functions and their Graphs",
    "12. Limit and Continuity",
    "13. Differentiation",
    "14. Vectors in Space",
  ],
};

/* ---------- Real Grade 12 syllabus, same TOC-only extraction method as
   Grade 11 above. Chapter numbering continues from Grade 11 where the
   official book does (e.g. Chemistry 17-33, Biology 13-25) — left as-is
   rather than renumbered, so it matches what's printed in the real
   textbook. Islamiat and Tarjumah-tul-Quran have no Grade 12 source PDF
   yet, so they're absent here (the tutor falls back to asking the student
   to confirm the chapter name, same as any other subject/grade with no
   confirmed list). ---------- */

const SYLLABUS_12 = {
  physics: [
    "1. Thermal Physics",
    "2. Simple Harmonic Motion",
    "3. Physical Optics",
    "4. Electrostatics",
    "5. Alternating Current",
    "6. Quantum Physics",
    "7. Nuclear and Particle Physics",
    "8. Medical Physics",
    "9. Space and Environment",
  ],
  chemistry: [
    "17. Group 2 Elements",
    "18. Transition Metals",
    "19. Basics of Organic Chemistry",
    "20. Aromatic Hydrocarbons",
    "21. Halogenoalkanes",
    "22. Hydroxy Compounds",
    "23. Carbonyl Compounds and Carboxylic Acids",
    "24. Organic Nitrogen Compounds",
    "25. Organic Synthesis",
    "26. Polymers",
    "27. Biochemistry",
    "28. Chromatography",
    "29. Spectroscopy-1",
    "30. Spectroscopy-2 NMR",
    "31. Materials and Energy",
    "32. Medicine, Agriculture and Industry",
    "33. Water",
  ],
  biology: [
    "13. Thermoregulation and Osmoregulation",
    "14. Human Urinary System",
    "15. Human Nervous System",
    "16. Human Endocrine System",
    "17. Human Reproductive Systems",
    "18. Inheritance",
    "19. Chromosomes and DNA",
    "20. Biotechnology",
    "21. Immunity",
    "22. Biostatistics",
    "23. Pharmacology",
    "24. Evolution",
    "25. Ecology",
  ],
  math: [
    "1. Graphical Representation of Functions",
    "2. Further Differentiation",
    "3. Integration",
    "4. Differential Equations",
    "5. Analytical Geometry",
    "6. Conic Section",
    "7. Kinematics",
    "8. Numerical Method",
    "9. Inverse Trigonometric Functions and Their Graphs",
    "10. Solution of Trigonometric Equations",
    "11. Vector Valued Functions and Their Differentiations",
  ],
  english: [
    "1. Journey to Taif",
    "2. The Last Lesson",
    "3. On His Blindness (Poem)",
    "4. The Power of Digital Learning",
    "5. The Giving Tree",
    "6. The Fun They Had",
    "7. Because I could Not Stop for Death (Poem)",
    "8. The Devoted Friend",
    "9. The Doll's House",
    "10. All the World's a Stage (Poem)",
    "11. A Letter to God",
    "12. A Visit to the Swat Valley",
    "13. The Pearl (Novel)",
  ],
  computerscience: [
    "1. Computer Networks",
    "2. Computational Thinking & Algorithms",
    "3. Object Oriented Programming Using Python",
    "4. Development of Graphical User Interface (GUI)",
    "5. Code Testing and Debugging",
    "6. Data and Analysis",
    "7. Hypothesis Testing",
    "8. Applications of Computer Science",
    "9. Cybersecurity and Safe Digital Collaboration",
  ],
  pakstudy: [
    "1. Islam and Pakistan",
    "2. Constitutional and Political Developments in Pakistan",
    "3. Constitutional and Administrative System",
    "4. Pakistan and International Affairs",
    "5. Education, Sports and Tourism in Pakistan",
    "6. Resources and Economic Development of Pakistan",
  ],
  // Complete (unlike the earlier partial version) — this book has no table
  // of contents, but every lesson is numbered 1-22 in its own glossary
  // ("Farhang") index at the back, which was read directly page-by-page
  // (OCR couldn't handle the decorative script, so this was done visually).
  urdu: {
    "Hamd-o-Naat": ["Hamd", "Naat"],
    "Nasr (Prose)": [
      "Hijrat-e-Habsha (Migration to Abyssinia)", "Maan Ji", "Kaafi",
      "Rustam-o-Sohrab (drama)", "Mahshar", "Minar",
      "Sair Dusre Darvesh Ki (from Bagh-o-Bahar)", "Bahadur Khan Ki Sarguzasht",
      "Hakeem Ehsanullah Khan", "Nazariya-e-Pakistan",
    ],
    "Nazm (Poetry)": [
      "Insan-e-Kamil ki Barkaat (Hafeez Jalandhari)",
      "Dastaan Tayyari Mein Bagh Ki (Mir Hasan)",
      "Sabaat Mein Teri Galiyon Ke... (Faiz Ahmed Faiz)",
      "Nai Nasl Ka Lauha (Amjad Islam Amjad)",
      "Main Roze Se Hoon (Syed Zameer Jafri)",
    ],
    "Ghazal": [
      "Ghazal (Khwaja Mir Dard)", "Ghazal (Mirza Ghalib)", "Ghazal (Allama Iqbal)",
      "Ghazal (Ada Jafri)", "Ghazal (Mohsin Ehsan)",
    ],
  },
};

function syllabusFor(grade, subjectId) {
  if (grade === 11) return SYLLABUS_11[subjectId];
  if (grade === 12) return SYLLABUS_12[subjectId];
  return undefined;
}

function syllabusText(subjectId, grade) {
  const s = syllabusFor(grade, subjectId);
  if (!s) return "";
  if (Array.isArray(s)) return s.join("\n");
  return Object.entries(s)
    .map(([section, items]) => `${section}: ${items.join(" | ")}`)
    .join("\n");
}

/* ---------- Claude API call (proxied through /api/claude, see api/claude.js) ---------- */

async function askClaude(systemPrompt, userText) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
    }),
  });
  const data = await res.json();
  const text = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  return text || "Sorry, I couldn't generate a response just now — try again.";
}

const URDU_RESPONSE_SUBJECTS = ["urdu", "islamiat", "tarjumah"];

function languageInstruction(subject) {
  if (!URDU_RESPONSE_SUBJECTS.includes(subject.id)) return "";
  return ` The student may write to you in English or Roman Urdu, but you must always respond in Urdu script (اردو) — never in English. ` +
    `This applies to all actual content (explanations, notes, flashcard text, quiz questions and options, mind map labels). ` +
    `Any JSON field names required below must stay exactly as specified in English so the app can read them; only the text VALUES inside those fields should be in Urdu.`;
}

function syllabusInstruction(subject, grade, forJson) {
  const syllabus = syllabusText(subject.id, grade);
  if (!syllabus) {
    return `\n\nNote: you don't have the confirmed official Grade ${grade} chapter order for this subject yet, so if the student references a chapter number, ask them to confirm the chapter name rather than guessing.`;
  }
  return `\n\nThe OFFICIAL chapter order for this subject (Grade ${grade}, PECTAA textbook) is:\n${syllabus}\n` +
    `When the student refers to a chapter by number or name (e.g. "chapter 1", "chapter 3"), you MUST use THIS list to identify which topic they mean — never guess or substitute a different textbook's order. ` +
    `Do not quote or closely paraphrase textbook prose; teach the topic using your own general knowledge and explanations.`;
}

function subjectSystemPrompt(subject, grade) {
  return `You are a strict but encouraging Punjab Board tutor for Grade ${grade} (Intermediate / F.Sc) students in Pakistan, teaching ${subject.label}. ` +
    `Follow the Punjab Textbook Board syllabus. Explain simply, use short examples, and where relevant mirror Punjab Board exam style (MCQs, short questions, long questions, numericals). ` +
    `Keep answers focused and exam-relevant, not overly long. Use plain text formatting (no markdown tables).` +
    languageInstruction(subject) +
    syllabusInstruction(subject, grade);
}

function quizSystemPrompt(subject, grade, topic, count = 5) {
  return `You are a Punjab Board exam question setter for Grade ${grade} ${subject.label}. ` +
    `The student has asked for a quiz on: "${topic}". Generate exactly ${count} board-style MCQs that stay STRICTLY within this exact topic/chapter — do not switch to a different chapter or a "similar" topic, and do not mix in content from other chapters. ` +
    `If "${topic}" refers to a chapter number (e.g. "chapter 1", "1st chapter", "topic 1"), resolve it using the official chapter list below, not your own guess.` +
    languageInstruction(subject) +
    syllabusInstruction(subject, grade) +
    ` Set the "topic" field in your JSON response to the exact chapter/topic name you used, so the student can see what it actually covered. ` +
    `Respond with ONLY valid JSON, no preamble, no markdown fences, in this exact shape: ` +
    `{"topic":"...","questions":[{"q":"...","options":["A text","B text","C text","D text"],"correct":0}]}. ` +
    `"correct" is the 0-based index of the right option.`;
}

function notesSystemPrompt(subject, grade) {
  return `You are a Punjab Board tutor creating concise, board-exam-style revision notes for Grade ${grade} ${subject.label} students. ` +
    `The student will name a topic or chapter. Stay STRICTLY within that exact topic — do not drift into a different chapter or a "related" topic instead. If it's a chapter number, resolve it using the official chapter list below, not a guess. ` +
    `Produce well-organized notes: a short title, and 3-6 sections each with a heading and 2-5 short bullet points (each point one line, exam-relevant, definitions/formulas/key facts). ` +
    `Do not quote or closely paraphrase textbook prose; write in your own words.${languageInstruction(subject)}${syllabusInstruction(subject, grade)} ` +
    `Respond with ONLY valid JSON, no preamble, no markdown fences, in this exact shape: ` +
    `{"title":"...","sections":[{"heading":"...","points":["...","..."]}]}`;
}

function flashcardSystemPrompt(subject, grade) {
  return `You are a Punjab Board tutor creating quick-revision flashcards for Grade ${grade} ${subject.label} students. ` +
    `The student will name a topic or chapter. Stay STRICTLY within that exact topic — do not drift into a different chapter or a "related" topic instead. If it's a chapter number, resolve it using the official chapter list below, not a guess. ` +
    `Produce exactly 6 flashcards: short question/term on the front, concise answer/definition on the back (1-2 lines max). ` +
    `Do not quote or closely paraphrase textbook prose; write in your own words.${languageInstruction(subject)}${syllabusInstruction(subject, grade)} ` +
    `Respond with ONLY valid JSON, no preamble, no markdown fences, in this exact shape: ` +
    `{"topic":"...","cards":[{"front":"...","back":"..."}]}`;
}

function mindmapSystemPrompt(subject, grade) {
  return `You are a Punjab Board tutor building a mind map for Grade ${grade} ${subject.label} students. ` +
    `The student will name a topic or chapter. Stay STRICTLY within that exact topic — do not drift into a different chapter or a "related" topic instead. If it's a chapter number, resolve it using the official chapter list below, not a guess. ` +
    `Break it into 4-6 main branches (key sub-topics within that same topic), and for each branch give 2-4 short child points (terms, facts, or examples, each under 6 words). ` +
    `Do not quote or closely paraphrase textbook prose; use your own words.${languageInstruction(subject)}${syllabusInstruction(subject, grade)} ` +
    `Respond with ONLY valid JSON, no preamble, no markdown fences, in this exact shape: ` +
    `{"topic":"...","branches":[{"label":"...","children":["...","..."]}]}`;
}

/* ---------- Decorative boho shape strip (header) ---------- */

function BohoShapeStrip() {
  return (
    <svg viewBox="0 0 1200 130" style={styles.bohoSvg} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {/* olive brush strokes, left */}
      <g stroke="#6B7A3D" strokeWidth="5" strokeLinecap="round" opacity="0.55">
        <line x1="20" y1="105" x2="70" y2="30" />
        <line x1="38" y1="110" x2="88" y2="35" />
        <line x1="56" y1="112" x2="104" y2="42" />
        <line x1="74" y1="115" x2="118" y2="52" />
      </g>
      {/* sage ring */}
      <circle cx="175" cy="78" r="34" fill="none" stroke="#0F6B4F" strokeWidth="16" />
      {/* dark sage half circle */}
      <path d="M 235 95 A 42 42 0 0 1 319 95 Z" fill="#1B3B2F" opacity="0.85" />
      {/* olive brush strokes, mid */}
      <g stroke="#6B7A3D" strokeWidth="5" strokeLinecap="round" opacity="0.5">
        <line x1="360" y1="95" x2="410" y2="20" />
        <line x1="378" y1="100" x2="425" y2="30" />
        <line x1="396" y1="103" x2="438" y2="40" />
      </g>
      {/* olive ring, small */}
      <circle cx="560" cy="82" r="26" fill="none" stroke="#93A683" strokeWidth="13" />
      {/* gold wedge */}
      <path d="M 615 100 L 685 100 L 650 35 Z" fill="#B6CC8E" opacity="0.9" />
      {/* dot cluster */}
      <g fill="#6B7A3D" opacity="0.6">
        {Array.from({ length: 26 }).map((_, i) => (
          <circle key={i} cx={790 + (i % 6) * 9 + ((i * 7) % 5)} cy={55 + Math.floor(i / 6) * 9} r="2" />
        ))}
      </g>
      {/* gold egg / blob */}
      <ellipse cx="960" cy="78" rx="46" ry="52" fill="#6B7A3D" opacity="0.9" />
      {/* scribble circles */}
      <g fill="none" stroke="#93A683" strokeWidth="1.6" opacity="0.7">
        <circle cx="1090" cy="75" r="30" />
        <circle cx="1100" cy="65" r="24" />
        <circle cx="1078" cy="88" r="20" />
      </g>
    </svg>
  );
}

/* ---------- Home / landing page ---------- */

const FEATURES = [
  { title: "Tutor chat", body: "Ask any topic across all 10 subjects and get board-style, syllabus-aligned explanations.", icon: Sparkles, target: "chat" },
  { title: "Practice quizzes", body: "Auto-generated MCQs on high-yield topics, graded instantly.", icon: ListChecks, target: "quiz" },
  { title: "Progress report", body: "A subject-by-subject mastery pie chart, saved privately to you.", icon: ClipboardList, target: "progress" },
];

// hero-bg.png is 1024x1536 (portrait, aspect ~0.667). background-size:cover
// scales it up until it fills the container in both dimensions, cropping
// whichever axis has "extra" — on a container that's landscape (wider than
// tall), covering the height requires scaling the image up so much that its
// width blows past the container and gets cropped from both sides, which is
// exactly where the rope artwork sits. There's no single background-size
// value that both fills a variable-shape container edge-to-edge AND never
// crops a fixed-shape image — so this measures the container's actual
// rendered aspect ratio and only falls back to "contain" (never crops, but
// can letterbox) on the landscape screens where "cover" would otherwise eat
// the ropes; everything closer to the image's own portrait shape keeps the
// full-bleed "cover" look.
const HERO_BG_ASPECT = 1024 / 1536;

function HomePage({ session, studentName, onEnter }) {
  const topRef = useRef(null);
  const subjectsRef = useRef(null);
  const aboutRef = useRef(null);
  const cardRef = useRef(null);
  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const [bgSize, setBgSize] = useState("cover");
  // Width of the empty side margin beside the centered content column, and
  // how visible the doodle is within it. On desktop (generous margin) the
  // doodle spreads to fill most of that space at a soft opacity; on mobile
  // (content already fills the width, ~0 real margin) it shrinks to a thin,
  // fainter sliver hugging the very edge rather than disappearing — content
  // itself is always opaque on top, so the sliver only ever shows through
  // the actual empty gaps (page padding, between-section spacing), never
  // over cards/text/buttons.
  const [doodleWidth, setDoodleWidth] = useState(0);
  const [doodleOpacity, setDoodleOpacity] = useState(0.5);
  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const recompute = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const containerAspect = width / height;
      // once the container is noticeably more landscape than the image's
      // own portrait shape, cover's crop becomes severe enough to lose the
      // side ropes entirely — switch to contain rather than let that happen
      setBgSize(containerAspect > HERO_BG_ASPECT * 1.35 ? "contain" : "cover");

      // widest content column is clamp(560px, 76vw, 1200px) — mirrored here
      // in JS (featureRow/aboutInner in the styles object) so the doodle's
      // available margin always matches the content's actual rendered
      // width instead of a stale fixed number. Never narrows the content,
      // only ever occupies space already outside that column.
      const contentWidth = Math.min(1200, Math.max(560, width * 0.76));
      const margin = (width - contentWidth) / 2;
      if (margin > 60) {
        setDoodleWidth(Math.min(460, margin - 24));
        setDoodleOpacity(0.5);
      } else {
        setDoodleWidth(30);
        setDoodleOpacity(0.28);
      }
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, []);

  return (
    <div style={{ ...styles.homePage, backgroundSize: bgSize }} ref={topRef}>
      {doodleWidth > 0 && (
        <>
          <div style={{ ...styles.doodleStrip, left: 0, width: doodleWidth, opacity: doodleOpacity, backgroundSize: `${Math.min(doodleWidth, 230)}px auto` }} />
          <div style={{ ...styles.doodleStrip, right: 0, width: doodleWidth, opacity: doodleOpacity, backgroundSize: `${Math.min(doodleWidth, 230)}px auto` }} />
        </>
      )}

      <div style={styles.homeNav}>
        <div style={styles.headerLeft}>
          <div style={styles.crest} />
          <div style={styles.headerWordmark}>Board Companion</div>
        </div>
        <nav style={styles.homeNavLinks}>
          <div style={styles.homeNavCtaGroup}>
            <button style={styles.homeNavAboutBtn} onClick={() => scrollTo(topRef)}>
              Home
            </button>
            <button style={styles.homeNavAboutBtn} onClick={() => scrollTo(subjectsRef)}>
              Subjects
            </button>
            <button style={styles.homeNavAboutBtn} onClick={() => scrollTo(aboutRef)}>
              About
            </button>
            <button
              style={styles.homeNavCta}
              onClick={() => (session ? onEnter() : scrollTo(cardRef))}
            >
              {session ? "Enter" : "Get started"}
            </button>
          </div>
        </nav>
      </div>

      <div style={styles.hero}>
        <div style={styles.heroText}>Welcome.</div>
        <div style={styles.heroSub}>
          A Punjab Board study companion for Grade 11 &amp; 12 — Biology, Chemistry, Physics,
          Computer Science, Mathematics, English, Urdu, Islamic Studies, Pakistan Studies &amp;
          Tarjumah-tul-Quran, all in one place.
        </div>
      </div>

      <BohoShapeStrip />

      <div style={styles.featureRow}>
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.title}
              className="hoverable-card"
              onClick={() => (session ? onEnter(f.target) : scrollTo(cardRef))}
              style={{ ...styles.featureCard, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
            >
              <div style={styles.featureIcon}><Icon size={18} color="#1B3B2F" /></div>
              <div style={styles.featureTitle}>{f.title}</div>
              <div style={styles.featureBody}>{f.body}</div>
            </button>
          );
        })}
      </div>

      <div style={styles.aboutSection} ref={aboutRef}>
        <div style={styles.aboutInner}>
          <div style={styles.aboutEyebrow}>About</div>
          <div style={styles.aboutTitle}>Built for Punjab Board students, subject by subject.</div>
          <div style={styles.aboutBody}>
            Board Companion is a study space for Grade 11 &amp; 12 (Intermediate Part I &amp; II) students
            following the Punjab Textbook Board syllabus. Pick a subject, ask questions in plain language,
            generate revision notes or flashcards, and quiz yourself on high-yield topics — all matched to
            board exam style. Every student's chats and quiz results are kept private to them, so this same
            companion can be shared with classmates without mixing up progress.
          </div>

          <div style={styles.aboutSubjectGrid} ref={subjectsRef}>
            {SUBJECTS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  className="hoverable-chip"
                  onClick={() => (session ? onEnter("chat", s.id) : scrollTo(cardRef))}
                  style={{ ...styles.aboutSubjectChip, cursor: "pointer", fontFamily: "inherit" }}
                >
                  <Icon size={14} color="#1B3B2F" />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div ref={cardRef}>
        {session ? (
          <div style={styles.homeCard}>
            <div style={styles.homeCardTitle}>Welcome back, {studentName || "there"}.</div>
            <button style={styles.loginBtn} onClick={() => onEnter()}>
              Continue to companion
            </button>
            <div style={styles.homeCardNote}>Your chats and progress are private to you.</div>
          </div>
        ) : (
          <AuthScreen styles={styles} />
        )}
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export default function BoardCompanion() {
  const [screen, setScreen] = useState("home"); // home | app
  const [grade, setGrade] = useState(11);
  const [subjectId, setSubjectId] = useState("physics");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const studentName = profile?.name || "";
  const [tab, setTab] = useState("study"); // study | progress
  const [showSyllabus, setShowSyllabus] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState({ chat: false, activity: false, progress: false });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null); // {topic, questions}
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [attempts, setAttempts] = useState({}); // {grade: {subject: [{score,total,date}]}}
  const [leaderboard, setLeaderboard] = useState([]); // classmates ranked by streak, see rankClassmates()
  const [initLoaded, setInitLoaded] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'notes' | 'flashcards' | 'mindmap' | null
  const [topicDraft, setTopicDraft] = useState("");
  const [quizLength, setQuizLength] = useState(5);
  const [showTimer, setShowTimer] = useState(false);
  const [streakCelebration, setStreakCelebration] = useState(null); // {current, longest} | null
  const [notesData, setNotesData] = useState(null); // {title, sections:[{heading,points}]}
  const [flashcardsData, setFlashcardsData] = useState(null); // {topic, cards:[{front,back}]}
  const [mindmapData, setMindmapData] = useState(null); // {topic, branches:[{label,children}]}
  const scrollRef = useRef(null);
  const pendingPrefillRef = useRef(null); // topic to prefill after a subject switch triggered by "Practice this"

  const subject = SUBJECTS.find((s) => s.id === subjectId);

  /* auth: pick up the current session and keep listening for changes */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* once logged in, load this account's profile + attempts */
  useEffect(() => {
    if (!session) {
      setProfile(null);
      setAttempts({});
      setInitLoaded(false);
      return;
    }
    (async () => {
      const [p, savedAttempts] = await Promise.all([
        db.getProfile(session.user.id),
        db.getAttempts(session.user.id),
      ]);
      setProfile(p);
      setAttempts(savedAttempts);
      setInitLoaded(true);
      if (db.hasLocalDataToImport()) setShowImportPrompt(true);
    })();
  }, [session]);

  /* class leaderboard: only fetchable once we know our own class_id (a
     student who hasn't entered a class code has none, and gets no
     leaderboard — see rankClassmates() for the ranking itself) */
  useEffect(() => {
    if (!profile?.class_id) {
      setLeaderboard([]);
      return;
    }
    (async () => {
      const roster = await db.getStudentRoster(profile.class_id);
      const attemptsByUser = await db.getAllAttemptsForRoster(roster.map((s) => s.id));
      setLeaderboard(rankClassmates(roster, attemptsByUser));
    })();
  }, [profile?.class_id]);

  /* load chat history whenever subject/grade changes */
  useEffect(() => {
    if (!initLoaded || !session) return;
    (async () => {
      const saved = await db.getChatHistory(session.user.id, grade, subjectId);
      setMessages(saved);
      setQuiz(null);
      setQuizResult(null);
      setQuizAnswers({});
      setShowSyllabus(false);
      setShowDeleteMenu(false);
      setDeleteSelection({ chat: false, activity: false, progress: false });
      setNotesData(null);
      setFlashcardsData(null);
      setMindmapData(null);
      if (pendingPrefillRef.current) {
        setTab("study");
        setPendingAction("quiz");
        setTopicDraft(pendingPrefillRef.current);
        pendingPrefillRef.current = null;
      } else {
        setPendingAction(null);
        setTopicDraft("");
      }
    })();
  }, [grade, subjectId, initLoaded, session]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const persistMessages = useCallback(async (msgs) => {
    if (!session) return;
    await db.saveChatHistory(session.user.id, grade, subjectId, msgs);
  }, [grade, subjectId, session]);

  async function performDelete() {
    if (deleteSelection.chat) {
      setMessages([]);
      if (session) await db.clearChatHistory(session.user.id, grade, subjectId);
    }
    if (deleteSelection.activity) {
      setQuiz(null); setQuizResult(null); setQuizAnswers({});
      setNotesData(null); setFlashcardsData(null); setMindmapData(null);
      setPendingAction(null); setTopicDraft("");
    }
    if (deleteSelection.progress) {
      const updated = { ...attempts };
      if (updated[grade]) {
        updated[grade] = { ...updated[grade] };
        delete updated[grade][subjectId];
      }
      setAttempts(updated);
      if (session) await db.deleteAttemptsForSubject(session.user.id, grade, subjectId);
    }
    setDeleteSelection({ chat: false, activity: false, progress: false });
    setShowDeleteMenu(false);
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await askClaude(subjectSystemPrompt(subject, grade), text);
      const withReply = [...next, { role: "assistant", content: reply }];
      setMessages(withReply);
      persistMessages(withReply);
    } finally {
      setLoading(false);
    }
  }

  async function startQuiz(topic, count = quizLength) {
    setLoading(true);
    clearActivities();
    try {
      const raw = await askClaude(quizSystemPrompt(subject, grade, topic, count), "Generate the quiz now.");
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setQuiz(parsed);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't build the quiz just now — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function pickAnswer(qIdx, optIdx) {
    if (quizResult) return;
    setQuizAnswers((a) => ({ ...a, [qIdx]: optIdx }));
  }

  async function submitQuiz() {
    if (!quiz || !session) return;
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) score += 1;
    });
    const total = quiz.questions.length;
    setQuizResult({ score, total });

    const wasActiveToday = streak.activeToday;
    await db.insertAttempt(session.user.id, grade, subjectId, { score, total, topic: quiz.topic });
    const updated = await db.getAttempts(session.user.id);
    setAttempts(updated);

    // celebrate once per day — the moment this quiz is what extends today's
    // streak, not every quiz after that in the same sitting
    const newStreak = computeStreak(updated);
    if (!wasActiveToday && newStreak.activeToday) {
      setStreakCelebration(newStreak);
    }
  }

  function clearActivities() {
    setQuiz(null); setQuizResult(null); setQuizAnswers({});
    setNotesData(null); setFlashcardsData(null); setMindmapData(null);
    setPendingAction(null); setTopicDraft("");
  }

  async function generateNotes(topic) {
    setLoading(true);
    clearActivities();
    try {
      const raw = await askClaude(notesSystemPrompt(subject, grade), `Topic: ${topic}`);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setNotesData(parsed);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't build notes just now — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function generateFlashcards(topic) {
    setLoading(true);
    clearActivities();
    try {
      const raw = await askClaude(flashcardSystemPrompt(subject, grade), `Topic: ${topic}`);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setFlashcardsData(parsed);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't build flashcards just now — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function generateMindmap(topic) {
    setLoading(true);
    clearActivities();
    try {
      const raw = await askClaude(mindmapSystemPrompt(subject, grade), `Topic: ${topic}`);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setMindmapData(parsed);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't build the mind map just now — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickAction(action) {
    if (action.type === "chat") {
      setPendingAction(null);
      setInput(action.prompt + " ");
      return;
    }
    // quiz | notes | flashcards | mindmap — all need a topic first, locked to that exact topic
    setTab("study");
    setQuiz(null); setQuizResult(null); setQuizAnswers({});
    setNotesData(null); setFlashcardsData(null); setMindmapData(null);
    setPendingAction(action.type);
    setTopicDraft("");
  }

  function submitTopicDraft() {
    const topic = topicDraft.trim();
    if (!topic) return;
    if (pendingAction === "notes") generateNotes(topic);
    else if (pendingAction === "flashcards") generateFlashcards(topic);
    else if (pendingAction === "mindmap") generateMindmap(topic);
    else if (pendingAction === "quiz") startQuiz(topic);
  }

  /* ---------- Progress math ---------- */

  function subjectMastery(subj) {
    return masteryFor(attempts, grade, subj);
  }
  const gradeSubjects = subjectsForGrade(grade);
  const pieData = computePieData(attempts, grade, gradeSubjects);
  const overallPct = overallPctFor(attempts, grade, gradeSubjects);
  const focusAreas = weakTopicsFor(attempts, grade, gradeSubjects, 5);
  const streak = computeStreak(attempts); // spans both grades — showing up is what counts
  const achievements = computeAchievements(attempts, SUBJECTS); // also spans both grades

  // Islamic Studies (Grade 11 only) and Pakistan Studies (Grade 12 only)
  // don't exist in the other grade — if the currently-viewed subject isn't
  // offered in the grade being switched to, fall back to the first subject
  // that is, rather than leaving the sidebar's selection on a subject that
  // just disappeared from the list.
  function switchGrade(g) {
    setGrade(g);
    if (!subjectsForGrade(g).some((s) => s.id === subjectId)) {
      setSubjectId(subjectsForGrade(g)[0].id);
    }
  }

  // Jumps to a subject's quiz tab with the topic prefilled (not
  // auto-submitted — generation still needs the student's one click, same
  // as every other quiz/notes/flashcards/mindmap flow in this app).
  function practiceTopic(subjId, topic) {
    if (subjId === subjectId) {
      setTab("study");
      setQuiz(null); setQuizResult(null); setQuizAnswers({});
      setNotesData(null); setFlashcardsData(null); setMindmapData(null);
      setPendingAction("quiz");
      setTopicDraft(topic);
    } else {
      pendingPrefillRef.current = topic;
      setSubjectId(subjId);
    }
  }

  /* ---------- Render ---------- */

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes stampIn { from { transform: scale(1.4) rotate(-8deg); opacity: 0 } to { transform: scale(1) rotate(-8deg); opacity: 1 } }
        .stamp { animation: stampIn 0.5s ease-out; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #A9C39F; border-radius: 4px; }
        .fade-in { animation: fadein .35s ease; }
        @keyframes fadein { from {opacity:0; transform: translateY(4px);} to {opacity:1; transform:none;} }
        button:focus-visible, input:focus-visible { outline: 2px solid #B6CC8E; outline-offset: 2px; }
        .hoverable-card, .hoverable-chip { transition: border-color 0.15s, outline-color 0.15s; }
        .hoverable-card:hover, .hoverable-card:active { border-color: #B6CC8E; outline: 2px solid #B6CC8E; outline-offset: 2px; }
        .hoverable-chip:hover, .hoverable-chip:active { outline: 2px solid #B6CC8E; outline-offset: 2px; }
        @media print {
          .no-print { display: none !important; }
          body, .print-report { background: #fff !important; }
          .print-report { border: none !important; box-shadow: none !important; }
        }
      `}</style>

      {authLoading ? (
        <div style={styles.homeCardNote}>Loading…</div>
      ) : !session || screen === "home" ? (
        <HomePage
          session={session}
          studentName={studentName}
          onEnter={(dest, subjId) => {
            setScreen("app");
            if (subjId) setSubjectId(subjId);
            if (dest === "progress") {
              setTab("progress");
            } else if (dest === "quiz") {
              setTab("study");
              setQuiz(null); setQuizResult(null); setQuizAnswers({});
              setNotesData(null); setFlashcardsData(null); setMindmapData(null);
              setPendingAction("quiz");
              setTopicDraft("");
            } else if (dest === "chat") {
              setTab("study");
              setPendingAction(null);
            }
          }}
        />
      ) : profile?.role === "teacher" ? (
        <TeacherDashboard
          styles={styles}
          teacherId={session.user.id}
          teacherName={studentName}
          onSignOut={() => { supabase.auth.signOut(); setScreen("home"); }}
        />
      ) : (
      <>
      {/* Header / cover strip */}
      <header style={styles.header} className="no-print">
        <div style={styles.headerTop}>
          <div style={styles.headerLeft}>
            <button style={styles.crestBtn} onClick={() => setScreen("home")} aria-label="Go home">
              <div style={styles.crest} />
            </button>
            <div style={styles.headerWordmark}>Board Companion</div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.gradeToggle}>
              {[11, 12].map((g) => (
                <button
                  key={g}
                  onClick={() => switchGrade(g)}
                  style={{ ...styles.gradeBtn, ...(grade === g ? styles.gradeBtnActive : {}) }}
                >
                  Grade {g}
                </button>
              ))}
            </div>
            {streak.current > 0 && (
              <div
                style={{ ...styles.streakChip, opacity: streak.activeToday ? 1 : 0.6 }}
                title={
                  streak.activeToday
                    ? `${streak.current}-day streak — longest: ${streak.longest}`
                    : `${streak.current}-day streak — take a quiz today to keep it going (longest: ${streak.longest})`
                }
              >
                <Flame size={14} color={streak.activeToday ? "#F2A93B" : "#93A683"} fill={streak.activeToday ? "#F2A93B" : "none"} />
                {streak.current}
              </div>
            )}
            <div style={styles.nameForm}>
              <div style={styles.studentBadge}>{studentName || "Student"}</div>
              <button
                onClick={() => { supabase.auth.signOut(); setScreen("home"); }}
                style={styles.nameBtn}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div style={styles.hero}>
          <div style={styles.heroText}>Welcome{studentName ? `, ${studentName}` : ""}.</div>
          <div style={styles.heroSub}>Punjab Board · Intermediate Part I &amp; II — every subject, one companion.</div>
        </div>

        <BohoShapeStrip />
      </header>

      {streakCelebration && (
        <StreakCelebration
          streak={streakCelebration}
          week={weekActivity(attempts)}
          onClose={() => setStreakCelebration(null)}
        />
      )}

      {showImportPrompt && (
        <div style={styles.importBanner}>
          <span>We found progress saved on this device — import it into your account?</span>
          <div style={styles.importBannerActions}>
            <button
              style={styles.nameBtn}
              disabled={importBusy}
              onClick={async () => {
                setImportBusy(true);
                await db.importLocalProgress(session.user.id);
                const [updatedAttempts, updatedChat] = await Promise.all([
                  db.getAttempts(session.user.id),
                  db.getChatHistory(session.user.id, grade, subjectId),
                ]);
                setAttempts(updatedAttempts);
                setMessages(updatedChat);
                setImportBusy(false);
                setShowImportPrompt(false);
              }}
            >
              {importBusy ? "Importing…" : "Yes, import"}
            </button>
            <button
              style={styles.authToggle}
              onClick={() => { db.markLocalImportDone(); setShowImportPrompt(false); }}
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      <div style={styles.body}>
        {/* Subject register (sidebar) */}
        <aside style={styles.sidebar} className="no-print">
          <div style={styles.sidebarLabel}>Subjects</div>
          {gradeSubjects.map((s) => {
            const Icon = s.icon;
            const m = subjectMastery(s.id);
            return (
              <button
                key={s.id}
                onClick={() => { setSubjectId(s.id); setTab("study"); }}
                style={{ ...styles.subjectBtn, ...(subjectId === s.id ? styles.subjectBtnActive : {}) }}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: "left" }}>{s.label}</span>
                {m !== null && (
                  <span style={{ ...styles.miniScore, color: m >= 70 ? PIE_COLORS.mastered : PIE_COLORS.needsWork }}>
                    {m}%
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ height: 1, background: "#C9DDC3", margin: "14px 0" }} />

          <button
            onClick={() => setTab("progress")}
            style={{ ...styles.subjectBtn, ...(tab === "progress" ? styles.subjectBtnActive : {}), fontWeight: 600 }}
          >
            <ClipboardList size={17} />
            <span>Progress report</span>
          </button>
        </aside>

        {/* Main panel */}
        <main style={styles.main}>
          {tab === "study" ? (
            <>
              <div style={styles.subjectHeader}>
                <div style={{ flex: 1 }}>
                  <div style={styles.subjectTitle}>{subject.label} <span style={styles.subjectUrdu}>{subject.urdu}</span></div>
                  <div style={styles.subjectMeta}>
                    Grade {grade} · Punjab Textbook Board syllabus
                    {syllabusFor(grade, subjectId) && (
                      <button style={styles.syllabusToggle} onClick={() => setShowSyllabus((v) => !v)}>
                        {showSyllabus ? "Hide chapters" : "View chapters"}
                      </button>
                    )}
                  </div>
                  {showSyllabus && syllabusFor(grade, subjectId) && (
                    <div style={styles.syllabusBox}>
                      {Array.isArray(syllabusFor(grade, subjectId))
                        ? syllabusFor(grade, subjectId).map((c, i) => <div key={i} style={styles.syllabusLine}>{c}</div>)
                        : Object.entries(syllabusFor(grade, subjectId)).map(([section, items]) => (
                            <div key={section} style={{ marginBottom: 6 }}>
                              <div style={styles.syllabusSection}>{section}</div>
                              <div style={styles.syllabusLine}>{items.join(" · ")}</div>
                            </div>
                          ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.quickRow}>
                {QUICK_ACTIONS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button key={a.id} onClick={() => handleQuickAction(a)} style={styles.chip}>
                      <Icon size={14} /> {a.label}
                    </button>
                  );
                })}
                <button onClick={() => setShowTimer((v) => !v)} style={showTimer ? styles.chipActive : styles.chip}>
                  <Timer size={14} /> Focus timer
                </button>
                {(messages.length > 0 || quiz || notesData || flashcardsData || mindmapData || ((attempts[grade] && attempts[grade][subjectId] || []).length > 0)) && (
                  <div style={styles.deleteWrap}>
                    <button onClick={() => setShowDeleteMenu((v) => !v)} style={styles.chipGhost}>
                      <Trash2 size={14} /> Delete...
                    </button>
                    {showDeleteMenu && (
                      <div className="fade-in" style={styles.deleteMenu}>
                        <div style={styles.deleteMenuTitle}>What do you want to delete?</div>
                        <label style={styles.deleteOption}>
                          <input
                            type="checkbox"
                            checked={deleteSelection.chat}
                            onChange={(e) => setDeleteSelection((s) => ({ ...s, chat: e.target.checked }))}
                            disabled={messages.length === 0}
                          />
                          Chat messages ({messages.length})
                        </label>
                        <label style={styles.deleteOption}>
                          <input
                            type="checkbox"
                            checked={deleteSelection.activity}
                            onChange={(e) => setDeleteSelection((s) => ({ ...s, activity: e.target.checked }))}
                            disabled={!quiz && !notesData && !flashcardsData && !mindmapData}
                          />
                          Current quiz / notes / flashcards / mind map on screen
                        </label>
                        <label style={styles.deleteOption}>
                          <input
                            type="checkbox"
                            checked={deleteSelection.progress}
                            onChange={(e) => setDeleteSelection((s) => ({ ...s, progress: e.target.checked }))}
                            disabled={((attempts[grade] && attempts[grade][subjectId]) || []).length === 0}
                          />
                          Quiz progress history for {subject.label} ({((attempts[grade] && attempts[grade][subjectId]) || []).length} attempts)
                        </label>
                        <div style={styles.deleteMenuActions}>
                          <button
                            onClick={performDelete}
                            disabled={!deleteSelection.chat && !deleteSelection.activity && !deleteSelection.progress}
                            style={{
                              ...styles.chipDanger,
                              opacity: (!deleteSelection.chat && !deleteSelection.activity && !deleteSelection.progress) ? 0.5 : 1,
                            }}
                          >
                            Delete selected
                          </button>
                          <button onClick={() => { setShowDeleteMenu(false); setDeleteSelection({ chat: false, activity: false, progress: false }); }} style={styles.deleteMenuCancel}>
                            Cancel
                          </button>
                        </div>
                        <div style={styles.deleteMenuNote}>This can't be undone.</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showTimer && <StudyTimer onClose={() => setShowTimer(false)} />}

              {pendingAction && (
                <div className="fade-in" style={styles.topicBar}>
                  <span style={styles.topicBarLabel}>
                    {pendingAction === "notes" ? "Notes on:" : pendingAction === "flashcards" ? "Flashcards on:" : pendingAction === "mindmap" ? "Mind map of:" : "Quiz on:"}
                  </span>
                  <input
                    autoFocus
                    value={topicDraft}
                    onChange={(e) => setTopicDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitTopicDraft()}
                    placeholder={`e.g. ${TOPIC_EXAMPLE[subjectId] || "Chemical Bonding"}`}
                    style={styles.topicInput}
                  />
                  {pendingAction === "quiz" && (
                    <select
                      value={quizLength}
                      onChange={(e) => setQuizLength(Number(e.target.value))}
                      style={styles.quizLengthSelect}
                      title="Number of questions"
                    >
                      {[5, 10, 15, 20].map((n) => (
                        <option key={n} value={n}>{n} questions</option>
                      ))}
                    </select>
                  )}
                  <button onClick={submitTopicDraft} style={styles.topicGoBtn} disabled={!topicDraft.trim()}>
                    Generate
                  </button>
                  <button onClick={() => setPendingAction(null)} style={styles.topicCancelBtn}>
                    <X size={14} />
                  </button>
                </div>
              )}

              <div ref={scrollRef} style={styles.chatArea}>
                {messages.length === 0 && !quiz && !notesData && !flashcardsData && !mindmapData && !pendingAction && (
                  <div style={styles.emptyState}>
                    Pick a quick action above, or ask a {subject.label} question directly — e.g. "{CHAT_EXAMPLE_PROMPT[subjectId] || "Explain a concept"}" or "Give me 5 MCQs on chapter 3."
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className="fade-in" style={{ ...styles.bubbleRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ ...styles.bubble, ...(m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant) }}>
                      {m.content}
                    </div>
                  </div>
                ))}

                {notesData && <NotesCard data={notesData} />}
                {flashcardsData && <FlashcardDeck data={flashcardsData} />}
                {mindmapData && <MindMapView data={mindmapData} />}

                {quiz && (
                  <div className="fade-in" style={styles.quizCard}>
                    <div style={styles.quizTopic}>Quiz · {quiz.topic}</div>
                    {quiz.questions.map((q, qi) => (
                      <div key={qi} style={styles.quizQ}>
                        <div style={styles.quizQText}>{qi + 1}. {q.q}</div>
                        {q.options.map((opt, oi) => {
                          const chosen = quizAnswers[qi] === oi;
                          const isCorrect = quizResult && oi === q.correct;
                          const isWrongChosen = quizResult && chosen && oi !== q.correct;
                          return (
                            <button
                              key={oi}
                              onClick={() => pickAnswer(qi, oi)}
                              style={{
                                ...styles.quizOpt,
                                ...(chosen ? styles.quizOptChosen : {}),
                                ...(isCorrect ? styles.quizOptCorrect : {}),
                                ...(isWrongChosen ? styles.quizOptWrong : {}),
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                    {!quizResult ? (
                      <button
                        onClick={submitQuiz}
                        disabled={Object.keys(quizAnswers).length < quiz.questions.length}
                        style={{ ...styles.submitBtn, opacity: Object.keys(quizAnswers).length < quiz.questions.length ? 0.5 : 1 }}
                      >
                        Submit answers
                      </button>
                    ) : (
                      <div style={styles.quizResultRow}>
                        <div style={styles.quizResultText}>Score: {quizResult.score} / {quizResult.total}</div>
                        <button onClick={() => startQuiz(quiz.topic)} style={styles.retryBtn}><RotateCcw size={14} /> New quiz (same topic)</button>
                      </div>
                    )}
                  </div>
                )}

                {loading && (
                  <div style={styles.bubbleRow}>
                    <div style={{ ...styles.bubble, ...styles.bubbleAssistant, display: "flex", gap: 8, alignItems: "center" }}>
                      <Loader2 size={14} className="spin" style={{ animation: "spin 1s linear infinite" }} /> thinking…
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.inputRow}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                  placeholder={`Ask about ${subject.label}...`}
                  style={styles.textInput}
                />
                <button onClick={() => sendMessage(input)} style={styles.sendBtn} disabled={loading}>
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <ProgressReport
              styles={styles}
              grade={grade}
              studentName={studentName}
              pieData={pieData}
              overallPct={overallPct}
              subjects={gradeSubjects}
              mastery={subjectMastery}
              attempts={attempts}
              weakTopics={focusAreas}
              onPractice={practiceTopic}
              achievements={achievements}
              leaderboard={leaderboard}
              myId={session?.user?.id}
            />
          )}
        </main>
      </div>
      </>
      )}
    </div>
  );
}

/* ---------- Visual: Notes card ---------- */

function NotesCard({ data }) {
  return (
    <div className="fade-in" style={styles.notesCard}>
      <div style={styles.notesTitle}>{data.title}</div>
      {data.sections.map((sec, i) => (
        <div key={i} style={styles.notesSection}>
          <div style={styles.notesHeading}>{sec.heading}</div>
          <ul style={styles.notesList}>
            {sec.points.map((p, j) => (
              <li key={j} style={styles.notesPoint}>{p}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ---------- Streak celebration screen ----------
   Shown once per day, the moment a quiz completion first extends today's
   streak (see the wasActiveToday check around insertAttempt() in
   submitQuiz()) — not on every quiz, or a student doing five quizzes in one
   sitting would see it five times. Bold orange/gold flame on a dark
   backdrop is a deliberate, scoped exception to the app's all-green
   palette (same category as the achievement badges — see CLAUDE.md),
   matching the reference image the student provided; everywhere else in
   the app keeps the green theme untouched. */
function StreakCelebration({ streak, week, onClose }) {
  return (
    <div style={styles.streakOverlay} onClick={onClose}>
      <div style={styles.streakCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.streakGlowWrap}>
          <div style={styles.streakGlow} />
          <Flame size={72} color="#FFC94A" fill="#FFC94A" style={{ position: "relative" }} />
        </div>
        <div style={styles.streakBigNumber}>{streak.current}</div>
        <div style={styles.streakBigLabel}>day streak!</div>

        <div style={styles.streakWeekRow}>
          {week.map((d, i) => (
            <div key={i} style={styles.streakWeekDay}>
              <div style={{ ...styles.streakWeekLetter, ...(d.isToday ? styles.streakWeekLetterToday : {}) }}>
                {d.letter}
              </div>
              <div style={{ ...styles.streakWeekDot, ...(d.active ? styles.streakWeekDotActive : {}) }} />
            </div>
          ))}
        </div>

        <button style={styles.streakCloseBtn} onClick={onClose}>Nice!</button>
      </div>
    </div>
  );
}

/* ---------- Study focus timer (Pomodoro-style, purely client-side) ---------- */

const TIMER_MODE_LABELS = { focus: "Focus", short: "Short break", long: "Long break" };
const TIMER_DEFAULT_MINUTES = { focus: 25, short: 5, long: 15 };
const TIMER_MINUTE_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 50, 60, 90];

function StudyTimer({ onClose }) {
  const [mode, setMode] = useState("focus");
  const [durations, setDurations] = useState(TIMER_DEFAULT_MINUTES); // minutes per mode, student-editable
  const [secondsLeft, setSecondsLeft] = useState(TIMER_DEFAULT_MINUTES.focus * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  function switchMode(next) {
    setMode(next);
    setRunning(false);
    setSecondsLeft(durations[next] * 60);
  }

  function changeDuration(minutes) {
    setDurations((d) => ({ ...d, [mode]: minutes }));
    setRunning(false);
    setSecondsLeft(minutes * 60);
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(durations[mode] * 60);
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const done = secondsLeft === 0;

  return (
    <div className="fade-in" style={styles.timerCard}>
      <div style={styles.timerModeRow}>
        {Object.keys(TIMER_MODE_LABELS).map((key) => (
          <button
            key={key}
            onClick={() => switchMode(key)}
            style={{ ...styles.timerModeBtn, ...(mode === key ? styles.timerModeBtnActive : {}) }}
          >
            {TIMER_MODE_LABELS[key]}
          </button>
        ))}
        <button onClick={onClose} style={{ ...styles.topicCancelBtn, marginLeft: "auto" }} title="Hide timer">
          <X size={14} />
        </button>
      </div>
      <div style={{ ...styles.timerDisplay, color: done ? "#C1594A" : "#1B3B2F" }}>
        {done ? "Time's up!" : `${mm}:${ss}`}
      </div>
      {!running && (
        <select
          value={durations[mode]}
          onChange={(e) => changeDuration(Number(e.target.value))}
          style={styles.quizLengthSelect}
          title={`${TIMER_MODE_LABELS[mode]} duration`}
        >
          {TIMER_MINUTE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} min</option>
          ))}
        </select>
      )}
      <div style={styles.timerControls}>
        <button
          onClick={() => (done ? reset() : setRunning((r) => !r))}
          style={styles.topicGoBtn}
        >
          {done ? "Start again" : running ? "Pause" : secondsLeft === durations[mode] * 60 ? "Start" : "Resume"}
        </button>
        <button onClick={reset} style={styles.deleteMenuCancel}>Reset</button>
      </div>
    </div>
  );
}

/* ---------- Visual: Flashcard deck (single-card reveal, like Anki/Quizlet) ---------- */

function FlashcardDeck({ data }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const cards = data.cards || [];
  const card = cards[index];

  function go(delta) {
    setRevealed(false);
    setIndex((i) => Math.max(0, Math.min(cards.length - 1, i + delta)));
  }

  if (!card) return null;

  return (
    <div className="fade-in" style={styles.fcWrap}>
      <div style={styles.fcTopRow}>
        <div style={styles.fcTopic}>{data.topic}</div>
        <div style={styles.fcCounter}>{index + 1} / {cards.length}</div>
      </div>
      <div style={styles.fcCard} onClick={() => setRevealed((r) => !r)}>
        <div style={styles.fcQuestion}>{card.front}</div>
        {revealed ? (
          <div style={styles.fcAnswer}>{card.back}</div>
        ) : (
          <div style={styles.fcSeeAnswer}>Tap to see answer</div>
        )}
      </div>
      <div style={styles.fcNavRow}>
        <button onClick={() => go(-1)} disabled={index === 0} style={{ ...styles.fcNavBtn, opacity: index === 0 ? 0.35 : 1 }}>
          ← Prev
        </button>
        <button onClick={() => setRevealed((r) => !r)} style={styles.fcFlipBtn}>
          <RefreshCw size={13} /> Flip
        </button>
        <button onClick={() => go(1)} disabled={index === cards.length - 1} style={{ ...styles.fcNavBtn, opacity: index === cards.length - 1 ? 0.35 : 1 }}>
          Next →
        </button>
      </div>
    </div>
  );
}

/* ---------- Visual: Mind map (horizontal, collapsible, zoomable) ---------- */

function estWidth(text, fontSize = 12.5) {
  return Math.max(90, Math.round(text.length * fontSize * 0.56) + 26);
}

function MindMapView({ data }) {
  // Keyed by branch index, not label text — two AI-generated branches can
  // legitimately share a label (e.g. two "Examples" branches), and keying
  // by text would make toggling one silently toggle both.
  const [expanded, setExpanded] = useState(() => {
    const init = {};
    (data.branches || []).forEach((b, i) => { init[i] = true; });
    return init;
  });
  const [zoom, setZoom] = useState(1);

  const rowH = 46;
  const xRoot = 20;
  const xBranch = 260;
  const xChild = 520;
  const rootW = estWidth(data.topic, 14);
  const branches = data.branches || [];

  const rows = branches.map((b, i) => (expanded[i] && b.children?.length ? b.children.length : 1));
  const total = rows.reduce((a, b) => a + b, 0) || 1;
  const totalHeight = total * rowH + 20;

  let cursor = 0;
  const positioned = branches.map((b, i) => {
    const rCount = rows[i];
    const bandTop = cursor * rowH + 10;
    const bandCenter = bandTop + (rCount * rowH) / 2;
    cursor += rCount;
    const isOpen = expanded[i] && b.children?.length;
    const children = isOpen
      ? b.children.map((c, j) => ({ text: c, y: bandTop + rowH * j + rowH / 2, w: estWidth(c, 11.5) }))
      : [];
    return { label: b.label, y: bandCenter, w: estWidth(b.label, 12.5), hasChildren: !!b.children?.length, children };
  });

  const rootY = totalHeight / 2;
  const svgWidth = xChild + 260;

  function toggle(i) {
    setExpanded((e) => ({ ...e, [i]: !e[i] }));
  }

  return (
    <div className="fade-in" style={styles.mmWrap}>
      <div style={styles.mmControls}>
        <button
          style={styles.mmCtrlBtn}
          onClick={() => {
            const allOpen = branches.every((b, i) => expanded[i]);
            const next = {};
            branches.forEach((b, i) => { next[i] = !allOpen; });
            setExpanded(next);
          }}
          title="Expand/collapse all"
        >
          <GitBranch size={14} />
        </button>
        <button style={styles.mmCtrlBtn} onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))} title="Zoom in">+</button>
        <button style={styles.mmCtrlBtn} onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))} title="Zoom out">−</button>
      </div>
      <div style={styles.mmScroll}>
        <svg
          width={svgWidth * zoom}
          height={totalHeight * zoom}
          viewBox={`0 0 ${svgWidth} ${totalHeight}`}
          style={{ display: "block" }}
        >
          {/* root -> branch lines */}
          {positioned.map((b, i) => (
            <path
              key={"line-" + i}
              d={`M ${xRoot + rootW} ${rootY} C ${(xRoot + rootW + xBranch) / 2} ${rootY}, ${(xRoot + rootW + xBranch) / 2} ${b.y}, ${xBranch} ${b.y}`}
              fill="none" stroke="#7C93C9" strokeWidth="1.6" opacity="0.8"
            />
          ))}
          {/* branch -> child lines */}
          {positioned.map((b, i) =>
            b.children.map((c, j) => (
              <path
                key={`cline-${i}-${j}`}
                d={`M ${xBranch + b.w} ${b.y} C ${(xBranch + b.w + xChild) / 2} ${b.y}, ${(xBranch + b.w + xChild) / 2} ${c.y}, ${xChild} ${c.y}`}
                fill="none" stroke="#8AA0A8" strokeWidth="1.2" opacity="0.65"
              />
            ))
          )}
          {/* root node */}
          <g>
            <rect x={xRoot} y={rootY - 19} width={rootW} height={38} rx={10} fill="#454B63" stroke="#6C7492" />
            <text x={xRoot + rootW / 2} y={rootY + 5} textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#EAF3E7" fontFamily="Arial, sans-serif">
              {data.topic}
            </text>
          </g>
          {/* branch nodes */}
          {positioned.map((b, i) => (
            <g key={"b-" + i} style={{ cursor: b.hasChildren ? "pointer" : "default" }} onClick={() => b.hasChildren && toggle(i)}>
              <rect x={xBranch} y={b.y - 16} width={b.w} height={32} rx={9} fill="#3A3F52" stroke="#5B6280" />
              <text x={xBranch + b.w / 2} y={b.y + 4.5} textAnchor="middle" fontSize="12" fill="#F0ECE2" fontFamily="Arial, sans-serif">
                {b.label}
              </text>
              {b.hasChildren && (
                <g transform={`translate(${xBranch + b.w + 6}, ${b.y - 8})`}>
                  <circle cx="8" cy="8" r="9" fill="#5B6280" />
                  <text x="8" y="11.5" textAnchor="middle" fontSize="10" fill="#F0ECE2" fontFamily="Arial, sans-serif">
                    {expanded[i] ? "–" : "+"}
                  </text>
                </g>
              )}
            </g>
          ))}
          {/* child nodes */}
          {positioned.map((b, i) =>
            b.children.map((c, j) => (
              <g key={`c-${i}-${j}`}>
                <rect x={xChild} y={c.y - 14} width={c.w} height={28} rx={8} fill="#2E3340" stroke="#4A5068" />
                <text x={xChild + c.w / 2} y={c.y + 4} textAnchor="middle" fontSize="11" fill="#D8DCE6" fontFamily="Arial, sans-serif">
                  {c.text}
                </text>
              </g>
            ))
          )}
        </svg>
      </div>
    </div>
  );
}

/* ---------- Progress report ---------- */

/* ---------- Styles (Punjab Board register theme) ---------- */

const styles = {
  page: {
    minHeight: "100vh",
    background: "#EAF3E7",
    color: "#2F3D30",
    fontFamily: "'Georgia', 'Iowan Old Style', serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: "#F3FAF0",
    borderBottom: "1px solid #C9DDC3",
    padding: "18px 28px 0",
    display: "flex",
    flexDirection: "column",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  crestBtn: { background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex" },
  crest: {
    width: 30, height: 30, borderRadius: "50%",
    background: "linear-gradient(135deg, #B6CC8E, #0F6B4F)",
    flexShrink: 0,
  },
  headerWordmark: {
    fontSize: 15, letterSpacing: 1.5, textTransform: "uppercase",
    fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#6B7A5D",
    fontWeight: 500,
  },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  gradeToggle: { display: "flex", background: "#DCEED7", borderRadius: 999, padding: 3 },
  gradeBtn: {
    border: "none", background: "transparent", color: "#6B7A5D", padding: "6px 14px",
    borderRadius: 999, fontSize: 12, cursor: "pointer", fontFamily: "Arial, sans-serif",
  },
  gradeBtnActive: { background: "#0F6B4F", color: "#FBFDFA", fontWeight: 700 },
  streakChip: {
    display: "flex", alignItems: "center", gap: 4, background: "#F5FAF3", border: "1px solid #C9DDC3",
    borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, color: "#1B3B2F",
    fontFamily: "Arial, sans-serif", cursor: "default",
  },
  streakOverlay: {
    position: "fixed", inset: 0, background: "rgba(10,10,18,0.88)", zIndex: 200,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
  },
  streakCard: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    maxWidth: 340, width: "100%", textAlign: "center",
  },
  streakGlowWrap: {
    position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
    width: 140, height: 140, marginBottom: 6,
  },
  streakGlow: {
    position: "absolute", inset: 0, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,201,74,0.55) 0%, rgba(255,201,74,0) 70%)",
  },
  streakBigNumber: {
    fontSize: 72, fontWeight: 800, color: "#FFC94A", fontFamily: "Arial, sans-serif", lineHeight: 1,
  },
  streakBigLabel: {
    fontSize: 18, fontWeight: 700, color: "#FFC94A", fontFamily: "Arial, sans-serif", marginBottom: 20,
  },
  streakWeekRow: {
    display: "flex", gap: 10, background: "rgba(255,255,255,0.06)", borderRadius: 16,
    padding: "16px 18px", marginBottom: 26,
  },
  streakWeekDay: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  streakWeekLetter: { fontSize: 11, fontWeight: 700, color: "#8A8A9A", fontFamily: "Arial, sans-serif" },
  streakWeekLetterToday: { color: "#FFC94A" },
  streakWeekDot: { width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.12)" },
  streakWeekDotActive: { background: "#FFC94A", boxShadow: "0 0 10px rgba(255,201,74,0.7)" },
  streakCloseBtn: {
    background: "#FFC94A", color: "#2A1E00", border: "none", borderRadius: 999,
    padding: "14px 48px", fontSize: 15, fontWeight: 800, fontFamily: "Arial, sans-serif",
    cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5,
  },
  studentBadge: {
    background: "#B6CC8E", color: "#2F3D30", padding: "6px 14px", borderRadius: 999,
    fontSize: 12, fontFamily: "Arial, sans-serif", fontWeight: 600,
  },
  nameForm: { display: "flex", gap: 6 },
  nameInput: {
    padding: "6px 12px", borderRadius: 999, border: "1px solid #C9DDC3", fontSize: 12, width: 110,
    fontFamily: "Arial, sans-serif", background: "#fff",
  },
  nameBtn: {
    background: "#0F6B4F", color: "#FBFDFA", border: "none", borderRadius: 999,
    padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700, fontFamily: "Arial, sans-serif",
  },
  hero: { textAlign: "center", padding: "22px 0 6px" },
  heroText: {
    fontSize: 40, fontWeight: 400, color: "#1B3B2F", letterSpacing: 0.5,
    fontFamily: "'Georgia', serif",
  },
  heroSub: {
    fontSize: 13, color: "#7C8870", marginTop: 6, fontFamily: "Arial, sans-serif",
  },
  bohoSvg: { width: "100%", height: 90, display: "block", marginTop: 10 },
  body: { display: "flex", flex: 1, minHeight: 560, background: "#F3FAF0" },
  sidebar: {
    width: 210, borderRight: "1px solid #C9DDC3", padding: "20px 12px",
    display: "flex", flexDirection: "column", gap: 4, flexShrink: 0,
  },
  sidebarLabel: {
    fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#93A683",
    fontFamily: "Arial, sans-serif", padding: "0 12px 10px",
  },
  subjectBtn: {
    display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 999,
    border: "none", background: "transparent", cursor: "pointer", fontSize: 13.5,
    color: "#2F3D30", textAlign: "left", fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  subjectBtnActive: { background: "#D9F0E4", fontWeight: 700, color: "#1B3B2F" },
  miniScore: { fontSize: 11, fontFamily: "Arial, sans-serif", fontWeight: 700 },
  main: { flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", minWidth: 0, background: "#FBFDFA" },
  subjectHeader: { marginBottom: 12 },
  subjectTitle: { fontSize: 24, fontWeight: 400, color: "#1B3B2F", fontFamily: "'Georgia', serif" },
  subjectUrdu: { fontSize: 15, color: "#93A683", marginLeft: 8, fontWeight: 400 },
  subjectMeta: { fontSize: 12, color: "#93A683", fontFamily: "Arial, sans-serif", marginTop: 3, display: "flex", alignItems: "center", gap: 10 },
  syllabusToggle: {
    background: "transparent", border: "1px solid #C9DDC3", color: "#1B3B2F", borderRadius: 999,
    padding: "3px 10px", fontSize: 11, cursor: "pointer", fontFamily: "Arial, sans-serif",
  },
  syllabusBox: {
    marginTop: 10, background: "#F5FAF3", border: "1px solid #C9DDC3", borderRadius: 14,
    padding: "12px 16px", fontFamily: "Arial, sans-serif",
  },
  syllabusSection: { fontSize: 12, fontWeight: 700, color: "#1B3B2F", marginBottom: 2 },
  syllabusLine: { fontSize: 12, color: "#2F3D30", lineHeight: 1.7 },
  quickRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  chip: {
    display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #C9DDC3",
    borderRadius: 999, padding: "7px 14px", fontSize: 12.5, cursor: "pointer",
    fontFamily: "Arial, sans-serif", color: "#1B3B2F",
  },
  chipGhost: {
    display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px dashed #C9DDC3",
    borderRadius: 999, padding: "7px 14px", fontSize: 12.5, cursor: "pointer",
    fontFamily: "Arial, sans-serif", color: "#7C8870",
  },
  chipActive: {
    display: "flex", alignItems: "center", gap: 6, background: "#0F6B4F", border: "1px solid #0F6B4F",
    borderRadius: 999, padding: "7px 14px", fontSize: 12.5, cursor: "pointer",
    fontFamily: "Arial, sans-serif", color: "#FBFDFA",
  },
  timerCard: {
    background: "#F5FAF3", border: "1px solid #C9DDC3", borderRadius: 18,
    padding: "16px 18px", marginBottom: 16, display: "flex", flexDirection: "column",
    alignItems: "center", gap: 10,
  },
  timerModeRow: { display: "flex", alignItems: "center", gap: 6, alignSelf: "stretch" },
  timerModeBtn: {
    background: "#fff", border: "1px solid #C9DDC3", borderRadius: 999,
    padding: "5px 12px", fontSize: 11.5, cursor: "pointer", fontFamily: "Arial, sans-serif",
    color: "#4A5A2E",
  },
  timerModeBtnActive: { background: "#D9F0E4", borderColor: "#B6CC8E", color: "#0F6B4F", fontWeight: 700 },
  timerDisplay: { fontSize: 44, fontWeight: 700, fontFamily: "'Georgia', serif", letterSpacing: 1 },
  timerControls: { display: "flex", gap: 8 },
  chipDanger: {
    display: "flex", alignItems: "center", gap: 6, background: "#F5DED4", border: "1px solid #C1594A",
    borderRadius: 999, padding: "7px 14px", fontSize: 12.5, cursor: "pointer",
    fontFamily: "Arial, sans-serif", color: "#8C3A24", fontWeight: 700,
  },
  deleteWrap: { position: "relative", marginLeft: "auto" },
  deleteMenu: {
    position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#FBFDFA",
    border: "1px solid #C9DDC3", borderRadius: 16, padding: 16, width: 300, zIndex: 10,
    boxShadow: "0 8px 24px rgba(92,75,62,0.15)",
  },
  deleteMenuTitle: { fontSize: 12.5, fontWeight: 700, color: "#2F3D30", fontFamily: "Arial, sans-serif", marginBottom: 10 },
  deleteOption: {
    display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#2F3D30",
    fontFamily: "Arial, sans-serif", marginBottom: 9, lineHeight: 1.4, cursor: "pointer",
  },
  deleteMenuActions: { display: "flex", gap: 8, marginTop: 8 },
  deleteMenuCancel: {
    background: "transparent", border: "1px solid #C9DDC3", borderRadius: 999, padding: "7px 14px",
    fontSize: 12, cursor: "pointer", fontFamily: "Arial, sans-serif", color: "#2F3D30",
  },
  deleteMenuNote: { fontSize: 10.5, color: "#93A683", fontFamily: "Arial, sans-serif", marginTop: 8 },
  chatArea: {
    flex: 1, overflowY: "auto", background: "#F5FAF3", border: "1px solid #C9DDC3",
    borderRadius: 18, padding: 18, minHeight: 300, display: "flex", flexDirection: "column", gap: 10,
  },
  emptyState: { color: "#93A683", fontSize: 13.5, fontFamily: "Arial, sans-serif", padding: 10 },
  bubbleRow: { display: "flex" },
  bubble: {
    maxWidth: "78%", padding: "10px 15px", borderRadius: 16, fontSize: 13.5, lineHeight: 1.55,
    whiteSpace: "pre-wrap", fontFamily: "Arial, sans-serif",
  },
  bubbleUser: { background: "#0F6B4F", color: "#FBFDFA", borderBottomRightRadius: 4 },
  bubbleAssistant: { background: "#DCEED7", color: "#2F3D30", borderBottomLeftRadius: 4 },
  inputRow: { display: "flex", gap: 8, marginTop: 14 },
  textInput: {
    flex: 1, padding: "12px 16px", borderRadius: 999, border: "1px solid #C9DDC3",
    fontSize: 13.5, fontFamily: "Arial, sans-serif", background: "#fff",
  },
  sendBtn: {
    background: "#0F6B4F", color: "#fff", border: "none", borderRadius: "50%",
    width: 44, height: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  quizCard: { background: "#fff", border: "1px solid #C9DDC3", borderRadius: 18, padding: 18 },
  quizTopic: { fontWeight: 700, fontSize: 14, marginBottom: 12, fontFamily: "Arial, sans-serif", color: "#1B3B2F" },
  quizQ: { marginBottom: 16 },
  quizQText: { fontSize: 13.5, marginBottom: 7, fontFamily: "Arial, sans-serif", fontWeight: 600 },
  quizOpt: {
    display: "block", width: "100%", textAlign: "left", padding: "9px 14px", marginBottom: 6,
    borderRadius: 999, border: "1px solid #C9DDC3", background: "#F5FAF3", cursor: "pointer",
    fontSize: 12.5, fontFamily: "Arial, sans-serif",
  },
  quizOptChosen: { borderColor: "#0F6B4F", background: "#D9F0E4" },
  quizOptCorrect: { borderColor: "#8C9A5B", background: "#EAEEDB" },
  quizOptWrong: { borderColor: "#C1594A", background: "#F5DED4" },
  submitBtn: {
    background: "#0F6B4F", color: "#FBFDFA", border: "none", borderRadius: 999,
    padding: "10px 20px", fontSize: 13, cursor: "pointer", fontFamily: "Arial, sans-serif", fontWeight: 700,
  },
  quizResultRow: { display: "flex", alignItems: "center", gap: 14 },
  quizResultText: { fontWeight: 700, fontFamily: "Arial, sans-serif", color: "#1B3B2F" },
  retryBtn: {
    display: "flex", alignItems: "center", gap: 6, background: "transparent",
    border: "1px solid #C9DDC3", borderRadius: 999, padding: "8px 14px", cursor: "pointer",
    fontFamily: "Arial, sans-serif", fontSize: 12.5, color: "#2F3D30",
  },

  /* Topic prompt bar (notes/flashcards/mindmap) */
  topicBar: {
    display: "flex", alignItems: "center", gap: 8, background: "#D9F0E4", border: "1px solid #C9DDC3",
    borderRadius: 999, padding: "8px 10px 8px 16px", marginBottom: 12,
  },
  topicBarLabel: { fontSize: 12.5, color: "#4A5A2E", fontFamily: "Arial, sans-serif", fontWeight: 700, flexShrink: 0 },
  topicInput: {
    flex: 1, border: "1px solid #C9DDC3", borderRadius: 999, padding: "7px 14px",
    fontSize: 12.5, fontFamily: "Arial, sans-serif", background: "#fff",
  },
  topicGoBtn: {
    background: "#0F6B4F", color: "#FBFDFA", border: "none", borderRadius: 999,
    padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Arial, sans-serif",
  },
  quizLengthSelect: {
    border: "1px solid #C9DDC3", borderRadius: 999, padding: "7px 10px",
    fontSize: 12, fontFamily: "Arial, sans-serif", background: "#fff", color: "#2F3D30",
    flexShrink: 0, cursor: "pointer",
  },
  topicCancelBtn: {
    background: "transparent", border: "none", color: "#4A5A2E", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 6,
  },

  /* Notes card */
  notesCard: { background: "#fff", border: "1px solid #C9DDC3", borderRadius: 18, padding: 20 },
  notesTitle: { fontSize: 17, fontWeight: 400, color: "#1B3B2F", fontFamily: "'Georgia', serif", marginBottom: 12 },
  notesSection: { marginBottom: 14 },
  notesHeading: { fontSize: 13, fontWeight: 700, color: "#1B3B2F", fontFamily: "Arial, sans-serif", marginBottom: 5 },
  notesList: { margin: 0, paddingLeft: 18 },
  notesPoint: { fontSize: 12.5, color: "#2F3D30", fontFamily: "Arial, sans-serif", lineHeight: 1.65, marginBottom: 2 },

  /* Flashcard deck */
  fcWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  fcTopRow: { display: "flex", justifyContent: "space-between", width: "100%", maxWidth: 460 },
  fcTopic: { fontSize: 12, fontWeight: 700, color: "#1B3B2F", fontFamily: "Arial, sans-serif" },
  fcCounter: { fontSize: 12, color: "#7C8870", fontFamily: "Arial, sans-serif" },
  fcCard: {
    width: "100%", maxWidth: 460, minHeight: 180, background: "#2E3340", borderRadius: 20,
    padding: "28px 26px", display: "flex", flexDirection: "column", justifyContent: "center",
    alignItems: "center", textAlign: "center", cursor: "pointer", gap: 16, userSelect: "none",
  },
  fcQuestion: { fontSize: 17, fontWeight: 600, color: "#EAF3E7", fontFamily: "Arial, sans-serif", lineHeight: 1.4 },
  fcSeeAnswer: { fontSize: 12.5, color: "#9AA3B8", fontFamily: "Arial, sans-serif" },
  fcAnswer: { fontSize: 14.5, color: "#9FD8B0", fontFamily: "Arial, sans-serif", lineHeight: 1.45 },
  fcNavRow: { display: "flex", alignItems: "center", gap: 10 },
  fcNavBtn: {
    background: "transparent", border: "1px solid #C9DDC3", borderRadius: 999, padding: "7px 14px",
    fontSize: 12.5, cursor: "pointer", fontFamily: "Arial, sans-serif", color: "#2F3D30",
  },
  fcFlipBtn: {
    display: "flex", alignItems: "center", gap: 6, background: "#0F6B4F", color: "#fff", border: "none",
    borderRadius: 999, padding: "7px 16px", fontSize: 12.5, cursor: "pointer", fontFamily: "Arial, sans-serif", fontWeight: 700,
  },

  /* Mind map */
  mmWrap: { background: "#22242F", borderRadius: 18, padding: 14, position: "relative" },
  mmControls: { position: "absolute", top: 14, left: 14, display: "flex", flexDirection: "column", gap: 6, zIndex: 2 },
  mmCtrlBtn: {
    width: 26, height: 26, borderRadius: 8, background: "#3A3F52", border: "1px solid #5B6280",
    color: "#F0ECE2", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
  },
  mmScroll: { overflow: "auto", maxHeight: 420, marginLeft: 40 },

  dmc: {
    background: "#FBFDFA", border: "1px solid #C9DDC3", borderRadius: 22, padding: 28,
    maxWidth: 880, margin: "0 auto",
  },
  dmcHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  dmcTitle: { fontSize: 26, fontWeight: 400, color: "#1B3B2F", fontFamily: "'Georgia', serif" },
  dmcSub: { fontSize: 12.5, color: "#93A683", fontFamily: "Arial, sans-serif", marginTop: 4 },
  stampCircle: {
    width: 76, height: 76, borderRadius: "50%", border: "3px solid #0F6B4F", color: "#1B3B2F",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    transform: "rotate(-6deg)", background: "#F5FAF3",
  },
  printBtn: {
    display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #C9DDC3",
    borderRadius: 999, padding: "8px 14px", fontSize: 12, cursor: "pointer",
    fontFamily: "Arial, sans-serif", color: "#1B3B2F", flexShrink: 0,
  },
  stampPct: { fontSize: 18, fontWeight: 700, lineHeight: 1 },
  stampLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, fontFamily: "Arial, sans-serif" },
  focusCard: {
    background: "#F5FAF3", border: "1px solid #C9DDC3", borderRadius: 18,
    padding: "16px 18px", marginBottom: 22,
  },
  focusTitle: { fontSize: 14, fontWeight: 700, color: "#1B3B2F", fontFamily: "Arial, sans-serif" },
  focusSub: { fontSize: 11.5, color: "#93A683", fontFamily: "Arial, sans-serif", marginBottom: 12 },
  focusRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    padding: "9px 0", borderTop: "1px solid #DCEED7",
  },
  focusInfo: { display: "flex", flexDirection: "column", gap: 2 },
  focusTopic: { fontSize: 12.5, fontWeight: 600, color: "#2F3D30", fontFamily: "Arial, sans-serif" },
  focusMeta: { fontSize: 11, color: "#93A683", fontFamily: "Arial, sans-serif" },
  focusBtn: {
    background: "#0F6B4F", color: "#fff", border: "none", borderRadius: 999,
    padding: "7px 14px", fontSize: 11.5, fontFamily: "Arial, sans-serif", fontWeight: 600,
    cursor: "pointer", flexShrink: 0,
  },
  achievementsCard: {
    background: "#F5FAF3", border: "1px solid #C9DDC3", borderRadius: 18,
    padding: "16px 18px", marginBottom: 22,
  },
  achievementsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))",
    gap: 8, marginTop: 10,
  },
  badge: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 5, borderRadius: 14, aspectRatio: "1 / 1", padding: "6px 4px", maxWidth: 88,
    boxShadow: "0 3px 7px rgba(27,59,47,0.12)", cursor: "default",
  },
  badgeLocked: { background: "#E7EFE2", boxShadow: "none" },
  badgeLabelEarned: {
    fontSize: 8.5, fontWeight: 800, fontFamily: "Arial, sans-serif", color: "#fff",
    textAlign: "center", textTransform: "uppercase", letterSpacing: 0.2, lineHeight: 1.15,
  },
  badgeLabelLocked: {
    fontSize: 8.5, fontWeight: 800, fontFamily: "Arial, sans-serif", color: "#B6C4AE",
    textAlign: "center", textTransform: "uppercase", letterSpacing: 0.2, lineHeight: 1.15,
  },
  leaderboardCard: {
    background: "#F5FAF3", border: "1px solid #C9DDC3", borderRadius: 18,
    padding: "16px 18px", marginBottom: 22,
  },
  leaderboardRow: {
    display: "grid", gridTemplateColumns: "32px 1fr auto auto", alignItems: "center", gap: 10,
    padding: "8px 0", borderTop: "1px solid #DCEED7",
  },
  leaderboardRowMe: { background: "#D9F0E4", borderRadius: 10, padding: "8px 8px" },
  leaderboardRank: { fontSize: 11.5, fontWeight: 700, color: "#93A683", fontFamily: "Arial, sans-serif" },
  leaderboardName: { fontSize: 12.5, fontWeight: 600, color: "#2F3D30", fontFamily: "Arial, sans-serif" },
  leaderboardStreak: {
    display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700,
    color: "#4A5A2E", fontFamily: "Arial, sans-serif",
  },
  leaderboardTotal: { fontSize: 11, color: "#93A683", fontFamily: "Arial, sans-serif", whiteSpace: "nowrap" },
  reportGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  pieWrap: { display: "flex", alignItems: "center", justifyContent: "center" },
  subjectTable: { display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" },
  tableRow: { display: "grid", gridTemplateColumns: "110px 1fr 40px 70px", alignItems: "center", gap: 8 },
  tableSubject: { fontSize: 12, fontFamily: "Arial, sans-serif", fontWeight: 600, color: "#2F3D30" },
  tableBarTrack: { height: 7, background: "#DCEED7", borderRadius: 999, overflow: "hidden" },
  tableBarFill: { height: "100%", borderRadius: 999 },
  tableScore: { fontSize: 11.5, fontFamily: "Arial, sans-serif", fontWeight: 700, textAlign: "right", color: "#2F3D30" },
  tableAttempts: { fontSize: 10.5, color: "#93A683", fontFamily: "Arial, sans-serif" },

  /* Home / landing page */
  homePage: {
    backgroundColor: "#F3FAF0", backgroundImage: "url(/hero-bg.png)", backgroundRepeat: "no-repeat",
    backgroundSize: "cover", backgroundPosition: "center top",
    width: "100%", boxSizing: "border-box", minHeight: "100vh", padding: "18px 28px 40px",
    display: "flex", flexDirection: "column", position: "relative", zIndex: 0,
  },
  // Medical-doodle side strips — only rendered when there's real empty
  // margin beside the centered content column (see doodleWidth in
  // HomePage), so on mobile (content fills the width) they simply don't
  // render rather than needing a separate mobile override. Negative
  // z-index + homePage's own zIndex:0 above keeps them behind every piece
  // of real content without an explicit z-index on each content element.
  doodleStrip: {
    position: "absolute", top: 0, bottom: 0, backgroundImage: "url(/medical-doodle.png)",
    backgroundRepeat: "repeat", backgroundPosition: "top left",
    pointerEvents: "none", zIndex: -1,
  },
  homeNav: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, minWidth: 0 },
  homeNavLinks: { display: "flex", alignItems: "center", gap: 22 },
  homeNavLink: {
    fontSize: 12.5, color: "#6B7A5D", fontFamily: "Arial, sans-serif", letterSpacing: 0.5,
    textTransform: "uppercase", cursor: "pointer",
  },
  homeNavCtaGroup: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  homeNavAboutBtn: {
    background: "transparent", color: "#1B3B2F", border: "1px solid #C9DDC3", borderRadius: 999,
    padding: "8px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Arial, sans-serif",
    whiteSpace: "nowrap",
  },
  homeNavCta: {
    background: "#B6CC8E", color: "#2F3D30", border: "none", borderRadius: 999,
    padding: "8px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Arial, sans-serif",
    whiteSpace: "nowrap",
  },
  featureRow: {
    display: "flex", flexWrap: "wrap", gap: 16, maxWidth: "clamp(560px, 76vw, 1200px)",
    margin: "8px auto 32px", minWidth: 0,
  },
  featureCard: {
    background: "#FBFDFA", border: "1px solid #C9DDC3", borderRadius: 18, padding: "18px 18px 20px",
    flex: "1 1 200px", minWidth: 0, boxSizing: "border-box",
  },
  featureIcon: {
    width: 34, height: 34, borderRadius: "50%", background: "#D9F0E4",
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  featureTitle: { fontSize: 14, fontWeight: 700, color: "#2F3D30", fontFamily: "Arial, sans-serif", marginBottom: 4 },
  featureBody: { fontSize: 12.5, color: "#7C8870", fontFamily: "Arial, sans-serif", lineHeight: 1.5 },

  aboutSection: { padding: "10px 0 36px" },
  aboutInner: {
    maxWidth: "clamp(560px, 76vw, 1200px)", margin: "0 auto", background: "#FBFDFA", border: "1px solid #C9DDC3",
    borderRadius: 22, padding: "30px 34px",
  },
  aboutEyebrow: {
    fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "#0F6B4F",
    fontFamily: "Arial, sans-serif", fontWeight: 700, marginBottom: 8,
  },
  aboutTitle: {
    fontSize: 22, fontWeight: 400, color: "#2F3D30", fontFamily: "'Georgia', serif",
    marginBottom: 12, lineHeight: 1.35,
  },
  aboutBody: {
    fontSize: 13, color: "#6B7A5D", fontFamily: "Arial, sans-serif", lineHeight: 1.7,
    marginBottom: 20,
  },
  aboutSubjectGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  aboutSubjectChip: {
    display: "flex", alignItems: "center", gap: 6, background: "#D9F0E4", color: "#2F3D30",
    borderRadius: 999, padding: "6px 12px", fontSize: 12, fontFamily: "Arial, sans-serif",
    border: "none", appearance: "none",
  },
  homeCard: {
    background: "#FBFDFA", border: "1px solid #C9DDC3", borderRadius: 22, padding: "28px 32px",
    maxWidth: 380, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, alignItems: "stretch",
  },
  homeCardTitle: { fontSize: 16, fontWeight: 400, color: "#1B3B2F", fontFamily: "'Georgia', serif", textAlign: "center" },
  homeInput: {
    width: "100%", padding: "12px 16px 12px 42px", borderRadius: 999, border: "1px solid #C9DDC3",
    fontSize: 13, fontFamily: "Arial, sans-serif", background: "#fff", textAlign: "left", boxSizing: "border-box",
  },
  homeInputWrapper: { position: "relative", display: "flex", alignItems: "center" },
  homeInputIcon: { position: "absolute", left: 16, color: "#93A683", pointerEvents: "none" },
  loginBtn: {
    background: "#0F6B4F", color: "#FBFDFA", border: "none", borderRadius: 999,
    padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Arial, sans-serif",
  },
  homeCardNote: { fontSize: 11, color: "#93A683", fontFamily: "Arial, sans-serif", textAlign: "center" },
  authError: { fontSize: 12, color: "#C1594A", fontFamily: "Arial, sans-serif", textAlign: "center" },
  authToggle: {
    background: "none", border: "none", color: "#6B7A3D", fontSize: 12,
    fontFamily: "Arial, sans-serif", cursor: "pointer", textDecoration: "underline",
  },
  importBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    background: "#D9F0E4", border: "1px solid #C9DDC3", borderRadius: 14,
    padding: "10px 18px", margin: "0 24px 14px", fontSize: 12.5,
    color: "#2F3D30", fontFamily: "Arial, sans-serif",
  },
  importBannerActions: { display: "flex", gap: 8, flexShrink: 0 },
};
