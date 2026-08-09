-- Promote an existing account to a teacher.
-- Run this by hand in Supabase -> SQL Editor whenever you want to give
-- someone teacher access. There is no self-serve way to become a teacher
-- from inside the app — this is intentional (avoids a privilege-escalation
-- vector where a student could just flip their own role).
--
-- The person must have already signed up in the app once (so a row exists
-- in auth.users) before you run this.

update public.profiles
set role = 'teacher'
where id = (select id from auth.users where email = 'teacher@example.com');
-- ^ replace the email above with the real teacher's email, then run.

-- To check who currently has teacher access:
-- select p.id, p.name, u.email, p.role
-- from public.profiles p join auth.users u on u.id = p.id
-- where p.role = 'teacher';

-- To demote someone back to a student:
-- update public.profiles set role = 'student' where id =
--   (select id from auth.users where email = 'teacher@example.com');
