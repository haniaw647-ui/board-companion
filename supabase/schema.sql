-- Board Companion — Supabase schema
-- Paste this whole file into Supabase (your project) -> SQL Editor -> New query -> Run.
-- Safe to run once on a fresh project. Re-running will error on "already exists" —
-- that's fine, it means it's already set up.

-- ========== profiles ==========
-- One row per account, created automatically on signup (see trigger below).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  role text not null default 'student' check (role in ('student', 'teacher')),
  class_id uuid,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- every user can read their own profile
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- every user can update their own name/class, but the with-check clause blocks
-- them from ever setting their own role to 'teacher' via a client-side update()
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );

-- the signup trigger inserts as the postgres role (security definer), so this
-- policy only matters if something ever tries a direct client-side insert —
-- keep it locked to role='student' as defense in depth
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id and role = 'student');

-- "am I a teacher" check, used below by the classes insert policy. This MUST
-- be a security definer function, not an inline subquery on public.profiles
-- inside a policy that is itself ON public.profiles — an inline subquery
-- there causes Postgres to re-evaluate the same policy while evaluating
-- itself ("infinite recursion detected in policy for relation 'profiles'",
-- error 42P17). Wrapping it in a security definer function owned by the
-- table owner makes the internal lookup bypass RLS instead of recursing.
create function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

revoke execute on function public.is_teacher() from anon, authenticated;

-- auto-create a profile row whenever someone signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), 'student');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- this function should only ever run via the trigger above, never as a
-- public RPC call (PostgREST auto-exposes every function in `public` by
-- default) — revoking EXECUTE closes that off without affecting the trigger
revoke execute on function public.handle_new_user() from anon, authenticated;

-- ========== classes ==========
-- One row per teacher's class. A student links themselves to a teacher by
-- entering that teacher's join_code during signup (see profiles.class_id
-- below) — there's no other way to link a student to a teacher, keeping
-- this opt-in and student-initiated rather than something a teacher can do
-- to a student without their knowledge.
-- teacher_id is unique because each teacher has exactly one class for now —
-- this also makes getOrCreateClassForTeacher() in db.js race-safe: it
-- inserts first and treats a teacher_id conflict as "someone else already
-- created it," rather than doing a racy select-then-insert.
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null default 'My Class',
  join_code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;

-- any signed-in user can look up a class by its join_code (needed so a
-- brand-new student can resolve the code they were given into a class_id);
-- join_code is meant to be shared, so this isn't a privacy leak
create policy "classes_select_authenticated" on public.classes
  for select using (auth.role() = 'authenticated');

-- only an account that's already a teacher can create a class, and only as themselves
create policy "classes_insert_own_if_teacher" on public.classes
  for insert with check (teacher_id = auth.uid() and public.is_teacher());

create policy "classes_update_own" on public.classes
  for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

alter table public.profiles
  add constraint profiles_class_id_fkey foreign key (class_id) references public.classes(id) on delete set null;

-- "is the caller a teacher whose class contains this specific student" —
-- replaces a blanket is_teacher() check so a teacher only ever sees their
-- own class's students, not every student in the whole app
create function public.is_teacher_of(target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles target
    join public.classes c on c.id = target.class_id
    where target.id = target_id and c.teacher_id = auth.uid()
  );
$$;

revoke execute on function public.is_teacher_of(uuid) from anon, authenticated;

-- teachers can read only their own class's students' profiles (roster)
create policy "profiles_select_all_for_teachers" on public.profiles
  for select using (public.is_teacher_of(id));

-- ========== attempts ==========
-- One row per quiz attempt (normalized, not a JSON blob — needed so a
-- teacher's dashboard can aggregate across every student with plain SQL).
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  grade smallint not null check (grade in (11, 12)),
  subject_id text not null,
  score int not null,
  total int not null,
  topic text,
  taken_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index attempts_user_grade_subject_idx on public.attempts (user_id, grade, subject_id);

alter table public.attempts enable row level security;

-- students: full CRUD on their own attempts only
create policy "attempts_all_own" on public.attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- teachers: read-only across their own class's students' attempts (roster aggregation)
create policy "attempts_select_all_for_teachers" on public.attempts
  for select using (public.is_teacher_of(user_id));

-- ========== class leaderboard (classmate read access) ==========
-- "is the caller a student who shares a class with this target student" —
-- same security-definer pattern as is_teacher_of() above, and for the same
-- reason: an inline subquery on public.profiles inside a policy defined ON
-- public.profiles would recurse. Only exposes profiles/attempts (the same
-- "progress data" category the teacher dashboard already reads), never
-- chat_history — that table still has no policy but the owning student's,
-- see below.
create function public.is_classmate_of(target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles them on them.class_id = me.class_id
    where me.id = auth.uid() and them.id = target_id and me.class_id is not null
  );
$$;

revoke execute on function public.is_classmate_of(uuid) from anon, authenticated;

-- students can read the name (only) of classmates, to render a leaderboard
create policy "profiles_select_classmates" on public.profiles
  for select using (public.is_classmate_of(id));

-- students can read classmates' attempts (same data a teacher already sees)
-- so streak/quiz-count can be computed client-side with the existing
-- progress.js helpers, instead of duplicating that math in SQL
create policy "attempts_select_classmates" on public.attempts
  for select using (public.is_classmate_of(user_id));

-- ========== chat_history ==========
-- One row per (student, grade, subject). Deliberately has NO teacher-read
-- policy anywhere — chat stays private to the student, full stop. This is
-- the hard privacy boundary, enforced at the database layer so it can't be
-- bypassed by a UI bug.
create table public.chat_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  grade smallint not null check (grade in (11, 12)),
  subject_id text not null,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, grade, subject_id)
);

alter table public.chat_history enable row level security;

-- only the owning student, ever — do not add a teacher policy here
create policy "chat_history_all_own" on public.chat_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
