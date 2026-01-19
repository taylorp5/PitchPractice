-- Backfill missing user_profiles rows from auth.users
-- Idempotent: only inserts when user_profiles.user_id is missing

insert into public.user_profiles (user_id, email, created_at, updated_at)
select u.id, u.email, now(), now()
from auth.users u
left join public.user_profiles p on p.user_id = u.id
where p.user_id is null;
