# Board Companion — Project Context for Claude Code

This file is read automatically by Claude Code. It exists so you don't have
to re-explain the project history in every session.

## What this is

A study companion web app for **Punjab Board Intermediate students (Grade
11 & 12)**, built for a specific student to eventually let classmates use
too. Subjects: Physics, Chemistry, Biology, English, Urdu, Islamic Studies,
Tarjumah-tul-Quran.

Features already built:
- Home/landing page (boho aesthetic — see Design section)
- Per-subject AI tutor chat (Claude API via `/api/claude`)
- Auto-generated quizzes, flashcards, revision notes, mind maps — all
  **topic-locked**: the student must type an exact topic/chapter (e.g. "1st
  topic", "Chemical Bonding") and the generation must stay strictly on that
  topic, resolving chapter numbers against the real syllabus list, not
  guessing
- Visual flashcard deck (dark reveal-card style, tap to flip, prev/next)
- Visual mind map (dark horizontal collapsible tree, zoom controls, SVG)
- Progress report tab: per-subject mastery pie chart + marksheet-style
  summary, computed from quiz attempt history
- Delete menu with granular options (chat / current activity / progress
  history), not a single blanket "clear everything"
- **Real accounts** via Supabase Auth (email/password) + Postgres, replacing
  the old localStorage-only setup — see "Backend: Supabase" below
- **Teacher dashboard**: accounts promoted to `role='teacher'` see a roster
  of students with progress/mastery only, never chat — see "Backend:
  Supabase" below for the privacy design

## Origin: converted from a Claude.ai artifact

This started as a single-file React artifact inside Claude.ai (which
provides a free Claude API connection + per-user cloud storage
automatically). It's now a standalone Vite project, which required two
swaps — **keep these in mind if anything AI/storage-related looks broken**:

1. `window.storage` (Claude.ai-only) → originally a `localStorage` shim
   (`src/storage.js`), later replaced entirely by Supabase (Postgres + Auth)
   once real cross-device accounts were needed — see "Backend: Supabase".
   `src/storage.js` no longer exists; don't recreate it.
2. Direct `fetch("https://api.anthropic.com/...")` → `fetch("/api/claude")`,
   a serverless function (`api/claude.js`) that holds the real
   `ANTHROPIC_API_KEY` server-side and proxies the request. Never call the
   Anthropic API directly from `src/App.jsx` — that would expose the key.
   (This one is untouched by the Supabase migration — Supabase's anon key
   is safe client-side by design, RLS enforces access, unlike the
   Anthropic key.)

## Backend: Supabase

Real accounts + persistence live in Supabase (Postgres + Auth), not
localStorage. Key files:
- `supabase/schema.sql` — full schema (`profiles`, `attempts`, `chat_history`,
  `classes`) + Row Level Security policies. Paste-and-run in the Supabase
  SQL editor; not applied automatically.
- `supabase/promote_teacher.sql` — the *only* way to make an account a
  teacher (manual, run by the project owner). There is deliberately no
  self-serve "become a teacher" path in the app — that would be a
  privilege-escalation hole.
- **Class scoping**: a teacher only sees students who joined *their* class,
  not every student in the app. Each teacher gets exactly one `classes` row
  (auto-created on first Teacher Dashboard load via
  `getOrCreateClassForTeacher` in `db.js`) with a random `join_code`, shown
  on the dashboard. A student links themselves to that class by entering
  the code in the optional "Class code" field on signup (`AuthScreen.jsx` →
  `joinClassByCode`) — student-initiated, opt-in, no way for a teacher to
  add students without their knowledge. `profiles.class_id` is the link;
  `public.is_teacher_of(target_id)` (a `security definer` function) checks
  "is the caller a teacher whose class contains this student" and backs the
  `profiles_select_all_for_teachers` / `attempts_select_all_for_teachers`
  policies — a blanket `is_teacher()` check would leak every student to
  every teacher, which is exactly what this replaced.
- `src/lib/supabaseClient.js`, `src/lib/db.js` (every query), `src/lib/progress.js`
  (pure mastery/pie-chart math shared by the student's own progress tab and
  the teacher dashboard).
- `src/components/AuthScreen.jsx`, `src/components/TeacherDashboard.jsx`,
  `src/components/ProgressReport.jsx`.

**Privacy boundary — do not weaken this:** the teacher dashboard shows
progress/mastery only, never chat content. This is enforced in two places
and both must stay in sync: `TeacherDashboard.jsx` never imports/calls any
chat function, and `chat_history`'s RLS policy in `schema.sql` grants no
read access to teachers at all (only `attempts`/`profiles` have a
teacher-read policy). If a future feature wants a teacher to see chat, that
needs an explicit new RLS policy and is a deliberate scope change to raise
first, not something to add quietly.

**Verified end-to-end** (signup, login, session persistence, quiz-attempt →
Progress Report data flow, teacher promotion, teacher dashboard, and the
RLS privacy boundary — confirmed live via direct REST calls with real
session tokens, not just through the UI) against the project's actual
Supabase project ("Quantum Project"). One bug was found and fixed during
this pass: the original `profiles_select_all_for_teachers` /
`attempts_select_all_for_teachers` policies queried `public.profiles`
inline from within a policy defined *on* `public.profiles`, which Postgres
flags as infinite recursion (error 42P17). Fixed by moving the "is this
user a teacher" check into a `security definer` function
(`public.is_teacher()`) that bypasses RLS internally — see `schema.sql`.
If you ever add another cross-student policy, route it through
`is_teacher()` rather than writing a fresh inline subquery.

A second real bug was found and fixed while building the class-scoping
feature above: `getOrCreateClassForTeacher` originally did a "select, then
insert if missing" check — React 18 StrictMode (which double-invokes
effects in dev on purpose, to surface exactly this kind of bug) ran it
twice concurrently, both calls saw "no class yet," and both inserted one,
leaving a teacher with two classes and a join code that changed on every
reload. Fixed by adding a `unique` constraint on `classes.teacher_id` and
switching to insert-first: the database now decides who wins, and the
loser just fetches the winner's row instead of racing it. If you add any
other "create if missing" logic against Supabase, use this same
insert-first-then-recover-on-conflict pattern, not select-then-insert.

Chat/quiz *generation* (the actual Claude API calls) remains untested,
since that needs a real `ANTHROPIC_API_KEY` which wasn't available during
this verification pass.

## CRITICAL constraint: copyright on the textbooks

The student uploaded the official PECTAA (Punjab) Grade 11 textbooks for
all 7 subjects. Every one of them carries this notice:

> "No part of this textbook can be copied, translated, reproduced or used
> for preparation of test papers, guidebooks, keynotes and helping books."

**What was extracted and IS safe to use:** only the table-of-contents /
chapter title lists (factual structure, not the book's prose) — see
`SYLLABUS_11` in `src/App.jsx`. This lets the tutor correctly map "chapter
1" etc. to the real chapter without guessing.

**What must NOT happen, ever, in this codebase:**
- No textbook paragraph, sentence, or closely-paraphrased passage stored or
  output anywhere in the app.
- Every AI system prompt that teaches content (tutor chat, notes,
  flashcards, mind maps, quizzes) must keep the existing instruction to
  explain "in your own words" / not quote or paraphrase textbook prose.
- If asked to add Grade 12 content, extract chapter-title lists only (same
  method as Grade 11 — see git history / prior session), never full text.
- If a future feature would need the actual textbook prose (e.g. "quote
  the exact definition from the book"), don't build it — that's exactly
  what the notice prohibits.

## Design theme

**All-green palette** (current, matched to a "10 Shades of Green" reference
image the student provided — Forest/Emerald/Olive/Sage/Mint/Seafoam/
Pistachio/Lime/Celadon/Pastel green swatches, "bold, beautiful, timeless").
Backgrounds are pale green tints, not cream (#EAF3E7 page / #F3FAF0 header
/ #FBFDFA cards / #F5FAF3 chat-adjacent panels). Text/headings use Forest
Green (#1B3B2F) and a dark green-charcoal body tone (#2F3D30). Primary
buttons/links are Emerald Green (#0F6B4F). Olive (#6B7A3D, #4A5A2E) and
Sage (#93A683) fill in secondary accents and muted text. Light chip/pill
backgrounds and hover/focus outlines use Mint/Pistachio tones (#D9F0E4,
#DCEED7, #B6CC8E). Borders are a pale sage-green (#C9DDC3). The mastery
pie chart (`PIE_COLORS` in `src/lib/progress.js`) uses the same ramp:
Emerald=mastered, Lime=needs work, pale Celadon-ish=not started. Serif
display headings ("Welcome."), pill-shaped everything (buttons, inputs,
nav, chat bubbles). Flashcards and mind map are intentionally a **dark**
contrasting panel (#2E3340 / #22242F) — a deliberate style choice, not an
inconsistency to "fix."

**Kept deliberately non-green**: the danger/error family (#C1594A wrong
answers, delete-button red) — these are functional (right/wrong,
delete-warning), not brand color, and making them green would remove a
signal the UI needs. If a future request says "make everything green," ask
before touching these rather than silently converting them.

**History**: this app has gone through four palettes — boho terracotta
(original) → briefly green, explicitly reverted → sage-green/gold matching
a "Maria Luné" portfolio reference → the current all-green ramp above,
matching a swatch-card reference image. Given that history, if asked to
change the palette again, don't assume any prior direction ("back to
terracotta," "no green," "match the last green") — just ask what's wanted.

## Known gaps / natural next steps

1. **Grade 12 syllabus not wired up.** Only Grade 11 chapter lists exist
   (from the uploaded textbooks' tables of contents). Grade 12 falls back
   to general knowledge and a "confirm the chapter name" prompt. If Grade
   12 PDFs get uploaded, repeat the TOC-extraction approach — table of
   contents pages only, never full chapters.
2. English subject syllabus is a rough 3-strand summary (Vocabulary/Grammar,
   Oral Communication, Writing Skills across 14 units) rather than named
   chapters, since the textbook's table of contents is a skills matrix, not
   chapter titles — this is correct, not a bug.
3. **Chat/quiz generation via the real Claude API is untested** (needs a
   real `ANTHROPIC_API_KEY` in `.env`) — see "Backend: Supabase" above
   before trusting it in production.

## Stack

Vite + React 18, `recharts` (pie chart), `lucide-react` (icons),
`@supabase/supabase-js` (accounts + persistence). No router, no CSS
framework — all styling is inline `style={}` objects in a `styles` const at
the bottom of `App.jsx` (kept this way intentionally so far; feel free to
extract to CSS modules if the file gets unwieldy, but ask before
introducing a UI library — the current look is custom-built to match a
specific reference image).

## gstack

Use the `/browse` skill from gstack for all web browsing — never use the
`mcp__claude-in-chrome__*` tools.

Available gstack skills: `/office-hours`, `/plan-ceo-review`,
`/plan-eng-review`, `/plan-design-review`, `/design-consultation`,
`/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`,
`/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`,
`/design-review`, `/setup-browser-cookies`, `/setup-deploy`,
`/setup-gbrain`, `/retro`, `/investigate`, `/document-release`,
`/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`,
`/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`,
`/gstack-upgrade`, `/learn`.
