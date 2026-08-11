# Board Companion — Project Context for Claude Code

This file is read automatically by Claude Code. It exists so you don't have
to re-explain the project history in every session.

## What this is

A study companion web app for **Punjab Board Intermediate students (Grade
11 & 12)**, built for a specific student to eventually let classmates use
too. Subjects: Physics, Chemistry, Biology, Computer Science, Mathematics,
English, Urdu, Islamic Studies, Pakistan Studies, Tarjumah-tul-Quran.
Pakistan Studies is Grade-12-only — Punjab's Grade 11 curriculum doesn't
have it, so `SYLLABUS_11` has no `pakstudy` entry (Grade 11 students just
never see chapter data for it, same as any subject/grade with nothing
confirmed yet).

Features already built:
- Home/landing page (see Design section for current palette)
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
- **Focus Areas**: on the Progress Report, the student's weakest quiz
  topics (rolled up across all attempts, not just per-subject averages)
  with a one-click "Practice this" that jumps straight into that topic's
  quiz — see `weakTopics()` in `src/lib/progress.js`
- **Daily streak**: a flame chip in the header showing consecutive days
  with at least one quiz attempt, spanning both grades. Purely derived
  client-side from `attempts[*][*][].date` (no new table/schema) — see
  `computeStreak()` in `src/lib/progress.js`. A day counts if *any*
  subject/grade has a quiz attempt that day; there's no separate
  "activity log," so chatting/notes/flashcards without ever quizzing
  doesn't build a streak — that's a deliberate scope limit to avoid a
  schema change, not an oversight, but worth knowing if it's ever
  extended to count broader activity.
- **Achievements**: a badge strip on the Progress Report (7 milestones —
  first quiz, 3/7-day streaks, mastering 1 or 3 subjects, a perfect quiz
  score, 10 quizzes total). Also purely derived, no persisted "earned"
  state — see `computeAchievements()` in `src/lib/progress.js`. Shown in
  both the student's own Progress Report and the teacher's per-student
  view (read-only, no privacy concern — same mastery data already there).
- **Focus timer**: a Pomodoro-style widget (Focus 25m / Short break 5m /
  Long break 15m, start/pause/reset) toggled from a chip in the study
  tab's quick-actions row. Purely client-side UI state (`StudyTimer` in
  `src/App.jsx`) — resets on page reload, nothing persisted.
- **Configurable quiz length**: a 5/10/15/20-question dropdown next to the
  topic input when generating a quiz (`quizLength` state in `src/App.jsx`,
  threaded through `quizSystemPrompt()`), instead of the old hardcoded 5.
- **Printable Progress Report**: a "Print / Save PDF" button on the
  Progress Report calls `window.print()`; a global `@media print` rule
  (in the `<style>` block in `src/App.jsx`) hides everything with a
  `no-print` class (header, sidebar, the button itself, and — in the
  teacher dashboard — the roster picker row) so only the report card
  prints. No PDF library involved, just the browser's own print-to-PDF.
- Delete menu with granular options (chat / current activity / progress
  history), not a single blanket "clear everything"
- **Real accounts** via Supabase Auth (email/password) + Postgres, replacing
  the old localStorage-only setup — see "Backend: Supabase" below
- **Teacher dashboard**: accounts promoted to `role='teacher'` see a roster
  of students with progress/mastery only, never chat — see "Backend:
  Supabase" below for the privacy design
- **Class leaderboard**: on the student's own Progress Report (not shown in
  the teacher dashboard), classmates ranked by current study streak, quiz
  count as tiebreaker — `rankClassmates()` in `src/lib/progress.js`, reusing
  `computeStreak()` rather than duplicating that math. Only renders once a
  student has joined a class (`profile.class_id` set) and there's at least
  one classmate; excluded from the printable report (`no-print`). Needs a
  new RLS grant — see "Backend: Supabase" below.

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
- **Classmate scoping (leaderboard)**: same shape as teacher scoping above —
  `public.is_classmate_of(target_id)` (also `security definer`, to avoid the
  same profiles-querying-profiles recursion `is_teacher_of` avoids) backs
  `profiles_select_classmates` / `attempts_select_classmates`, letting a
  student read *only* the name + attempts of classmates sharing their
  `class_id` — the same "progress data" category the teacher already reads,
  never `chat_history` (that table still grants nothing beyond the owning
  student). `getStudentRoster`/`getAllAttemptsForRoster` in `db.js` are
  reused as-is for this — same queries, the RLS policy is what changes
  which caller can see which rows.
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
all 9 subjects. Every one of them carries this notice:

> "No part of this textbook can be copied, translated, reproduced or used
> for preparation of test papers, guidebooks, keynotes and helping books."

**Source PDFs live in `Downloads\<Subject>\`** (e.g. `Downloads\Physics\`,
`Downloads\Urdu\`), one folder per subject, each holding both the Grade 11
and Grade 12 PECTAA PDF (plus a duplicate "- Copy" file from the original
download, harmless, not cleaned up). `Downloads\Math\` and
`Downloads\Computer Science\` were created first (Grade 11 phase); the
rest were organized later once Grade 12 PDFs arrived. If a new subject's
PDF gets uploaded, put it in Downloads root and it can be filed into a
matching folder when work on it starts — no need to reorganize proactively.

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
- Grade 12 content must follow the same rule: chapter-title lists only,
  never full text. See `SYLLABUS_12` in `src/App.jsx` — Physics, Chemistry,
  Biology, Math, English, Computer Science, and the new Pakistan Studies
  subject are done this way; Urdu is intentionally partial (see below);
  Islamiat and Tarjumah-tul-Quran have no Grade 12 source PDF yet.
- If a future feature would need the actual textbook prose (e.g. "quote
  the exact definition from the book"), don't build it — that's exactly
  what the notice prohibits.

**Extracting a TOC from a scanned (image-only) PDF:** the Computer Science
and Mathematics PECTAA PDFs have no text layer (`pypdf`/the `Read` tool's
default text extraction returns nothing or just a watermark) — they're
scanned page images. Confirm this first (`Read` with `pages:` on a text
page; if it's blank/watermark-only on a page that clearly has visible text,
it's scanned). This machine didn't have `poppler-utils` (needed by the
`Read` tool to rasterize PDF pages) or an OCR engine installed; both were
added via `winget install oschwartz10612.Poppler` and
`winget install tesseract-ocr.tesseract`. Because winget updates the
system PATH but the already-running host process doesn't pick that up
until it restarts, call the installed binaries by their full path instead
of waiting for a restart (found via `find` under
`AppData/Local/Microsoft/WinGet/Packages` and `Program Files/Tesseract-OCR`).
Render pages to PNG with `pdftoppm -png`, then either read a real
table-of-contents page directly with the `Read` tool (Math had one — by
far the fastest path when it exists) or, if the book jumps straight from
front matter into chapter 1 (Computer Science had no TOC page), OCR the
first few lines of every rendered page with `tesseract --psm 6` and grep
the combined output for "UNIT"/"Unit" to find each chapter-banner page,
then visually confirm each exact title with `Read` on that page's PNG
before trusting the OCR text (OCR garbles some titles).

**Grade 12 PECTAA PDFs are encrypted** (owner-password, AES-256 — set by
the publisher to block editing/printing, not to block reading). `pypdf`
needs the `cryptography` package to open them at all (`python -m pip
install cryptography`); Poppler's CLI tools (`pdftotext`, `pdftoppm`,
`pdfinfo`) handle the encryption natively with no extra setup, so prefer
those. Most Grade 12 books had a real text layer and either a clean
`pdftotext`-readable table of contents (Math, Pakistan Studies) or one
whose columns come out interleaved and need visual confirmation via a
rendered PNG (Physics, Chemistry) — multi-column TOC layouts reliably
confuse `pdftotext`'s reading order even when the text itself is fine.
Biology's Grade 12 PDF has no TOC at all (it's chapters 13+ only, no
front matter — Grade 11 already covers 1-12, and the PECTAA books number
chapters continuously across both years); its chapter list came from a
"chapter-wise weightage" table in the pairing-scheme/model-paper section
instead, which is worth checking in any book that lacks a normal TOC.
Computer Science Grade 12 was scanned (CamScanner watermark, no text
layer) same as Grade 11 CS, and needed the same OCR-for-banner-pages
approach — but this one did have a clean TOC page once rendered, so check
for that visually before falling back to OCR-scanning every page.

**Urdu Grade 12 is now complete**, but getting there took a different
method than every other subject. Its OCR came out badly garbled
(decorative/stylized script) even after installing the Urdu language pack
(`urd.traineddata` from `github.com/tesseract-ocr/tessdata`, since
Tesseract's English-only install has no Urdu support at all), and the book
has no front-matter table of contents. The fix: every lesson banner is
individually numbered ("سبق N") on its opening page, **and** the book's
own glossary appendix ("فرہنگ") at the back repeats every lesson number +
exact title as section headers — that second list is complete and
authoritative, and is what the final `SYLLABUS_12.urdu` entry is built
from. Method: render all pages to PNG with `pdftoppm`, tile them into
labeled contact sheets with Pillow (a small script, `tile.py`, 12
pages/sheet) so many pages can be visually scanned per `Read` call instead
of one at a time, spot each lesson-title page and bio page from the tiles,
then re-`Read` the individual full-res PNG for any title too small to
read on the tile and cross-check every title against the glossary index.
Like Grade 11's Urdu, the book is organized by literary genre — but note
it's four sections (Hamd-o-Naat / Nasr / Nazm / Ghazal, 2+10+5+5 = 22
lessons total), not three like Grade 11's Hamd-o-Naat/Nasr/Nazm-o-Ghazal —
don't assume the two years share a section structure.

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

1. **Grade 12 syllabus is fully wired up for 8 of the 10 subjects.**
   Physics, Chemistry, Biology, Math, English, Computer Science, Urdu, and
   Pakistan Studies (see `SYLLABUS_12` in `src/App.jsx`) are all done.
   Islamiat and Tarjumah-tul-Quran have no Grade 12 source PDF uploaded
   yet; if they get uploaded, repeat the same TOC-extraction approach (see
   the copyright section above for the per-subject techniques, including
   Urdu's glossary-index method).
2. Grade 11 English's syllabus is a rough 3-strand summary
   (Vocabulary/Grammar, Oral Communication, Writing Skills across 14
   units) rather than named chapters, since that textbook's table of
   contents is a skills matrix, not chapter titles — this is correct, not
   a bug. Grade 12 English is different and DOES have 13 named literature
   units (short stories, poems, a novel) alongside a similar skills
   matrix — `SYLLABUS_12.english` lists the named units since they're more
   useful for chapter resolution than a skills summary would be.
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
