-- Drop problematic policies and function
DROP POLICY IF EXISTS "Participants can view joined sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can view participants of joined sessions" ON public.session_participants;
DROP FUNCTION IF EXISTS public.can_view_session;

-- SESSIONS: Simple non-recursive policies
-- 1. Owner can see own sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
CREATE POLICY "Users can view own sessions"
ON public.sessions
FOR SELECT TO authenticated
USING (examiner_id = auth.uid());

-- 2. Public/pending/active sessions can be viewed for joining
DROP POLICY IF EXISTS "Public can view session by code for joining" ON public.sessions;
CREATE POLICY "Public can view session by code for joining"
ON public.sessions
FOR SELECT TO authenticated
USING (status IN ('pending', 'active'));

-- SESSION_PARTICIPANTS: Simple non-recursive policies
-- Users can view their own participation records
CREATE POLICY "Users can view own participation"
ON public.session_participants
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Examiners can view participants of their sessions using security definer function
CREATE OR REPLACE FUNCTION public.is_session_examiner(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = _session_id AND examiner_id = _user_id
  );
$$;

CREATE POLICY "Examiners can view session participants"
ON public.session_participants
FOR SELECT TO authenticated
USING (public.is_session_examiner(session_id, auth.uid()));