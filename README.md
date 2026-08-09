# Board Companion — Punjab Board Grade 11 & 12

A study companion for Punjab Board Intermediate students: subject tutor chat,
auto-generated quizzes, flashcards, mind maps, revision notes, and a
per-student progress report.

This was originally built as a Claude.ai artifact, which gets a Claude API
connection and per-user storage for free. This project converts it into a
standalone app so it can be built on outside Claude.ai:

1. **Supabase** (Postgres + Auth) handles real accounts and persistence —
   every student signs up with email/password, and their chats, quizzes,
   and progress sync across devices. See `src/lib/db.js` for every query
   and `supabase/schema.sql` for the schema + Row Level Security policies.
2. **`api/claude.js`** is a small serverless function that proxies chat
   requests to the real Anthropic API. The frontend never touches your API
   key directly (that would expose it to anyone using the site).

There's also a **teacher dashboard**: any account promoted to `role='teacher'`
(see "Promoting a teacher" below) gets a class with a join code, and sees a
roster of only the students who joined that class — never every student in
the app, and never their chat history, which stays private to each student
both in the UI and at the database level (no RLS policy grants teachers
read access to `chat_history`, by design).

## Setup

```bash
npm install
cp .env.example .env
# edit .env and add your ANTHROPIC_API_KEY (from console.anthropic.com)
```

### Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In your project, go to the SQL Editor and paste in the full contents of
   `supabase/schema.sql`, then run it. This creates the `profiles`,
   `attempts`, `chat_history`, and `classes` tables with Row Level Security
   enabled.
3. Go to Project Settings -> API and copy the **Project URL** and **anon
   public key** into your `.env` as `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
4. (Recommended for this app) Go to Authentication -> Providers -> Email and
   turn **off** "Confirm email". This isn't a public cold-signup app — it's
   known students migrating off a no-auth localStorage version — so email
   confirmation just adds friction with no real security benefit here. You
   can turn it back on later if this ever opens up to strangers.

### Promoting a teacher

There's no self-serve way to become a teacher in the app (that would be a
privilege-escalation hole). Instead, once someone has signed up normally,
run `supabase/promote_teacher.sql` in the Supabase SQL editor with their
email filled in. See that file for the exact statement, plus how to check
who currently has teacher access or demote someone back to a student.

Once promoted, that account's Teacher Dashboard shows a **class code** the
first time it loads (auto-generated, one per teacher). Share that code with
your students — they enter it in the optional "Class code" field when they
sign up, which is what puts them in your roster. Students who don't enter
a code (or enter someone else's) just won't show up for you; there's no way
for a teacher to add a student without the student typing the code in
themselves.

## Run locally

The AI features need the `/api/claude` serverless function running
alongside the frontend. The easiest way:

```bash
npm install -g vercel   # one-time
vercel dev
```

This serves the app **and** the API function together, same as it'll behave
once deployed. (Running `npm run dev` alone starts only the Vite frontend —
the UI will load, but chat/quiz/notes/flashcards/mind maps will fail since
there's no server for `/api/claude` to hit.)

## Deploy

Push this folder to GitHub and import it into Vercel, or run:

```bash
vercel
```

Then add `ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`
under Project Settings → Environment Variables in the Vercel dashboard (same
values as your `.env`), and redeploy.

## Project structure

```
├── api/
│   └── claude.js              # serverless proxy to the Anthropic API
├── supabase/
│   ├── schema.sql              # tables + Row Level Security policies (paste into Supabase SQL editor)
│   └── promote_teacher.sql     # manual "make this account a teacher" snippet
├── src/
│   ├── App.jsx                 # the whole student app shell (tutor, quizzes, flashcards, mind maps)
│   ├── main.jsx                 # React entry point
│   ├── lib/
│   │   ├── supabaseClient.js     # the supabase-js client
│   │   ├── db.js                  # every Supabase query (profiles, attempts, chat_history, roster)
│   │   └── progress.js            # pure mastery/pie-chart math, shared by student + teacher views
│   └── components/
│       ├── AuthScreen.jsx         # sign up / sign in
│       ├── ProgressReport.jsx     # progress tab (also reused per-student in the teacher dashboard)
│       └── TeacherDashboard.jsx   # roster + per-student progress, no chat access
├── index.html
├── package.json
└── vite.config.js
```

## Known gaps / things to build next

- **Grade 12 syllabus**: only Grade 11 chapter lists (from the uploaded
  PECTAA textbooks' tables of contents) are wired into the tutor's system
  prompts. Grade 12 falls back to general knowledge until those books are
  processed the same way (extract chapter titles only, same method as
  Grade 11 — never full text, see the copyright note below).
- **Copyright**: the tutor is intentionally instructed to explain concepts
  in its own words rather than quote textbook prose — the source PECTAA
  textbooks explicitly restrict use for "test papers, guidebooks, keynotes
  and helping books." Keep that constraint if you extend the prompts.
