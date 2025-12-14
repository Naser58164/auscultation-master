-- Break recursive RLS between sessions and session_participants

-- 1) Helper function to determine if current user can access a given session
create or replace function public.can_view_session(_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.sessions s
      where s.id = _session_id
        and s.examiner_id = auth.uid()
    )
    or exists (
      select 1
      from public.session_participants sp
      where sp.session_id = _session_id
        and sp.user_id = auth.uid()
    );
$$;

-- 2) Replace recursive policies with ones using the helper function

-- On sessions table
drop policy if exists "Participants can view joined sessions" on public.sessions;

create policy "Participants can view joined sessions"
on public.sessions
for select
to authenticated
using (public.can_view_session(id));

-- On session_participants table
drop policy if exists "Users can view participants of joined sessions" on public.session_participants;

create policy "Users can view participants of joined sessions"
on public.session_participants
for select
to authenticated
using (public.can_view_session(session_id));