-- Drop the broken policy
DROP POLICY IF EXISTS "Participants can view joined sessions" ON public.sessions;

-- Recreate with correct reference
CREATE POLICY "Participants can view joined sessions" 
ON public.sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM session_participants
    WHERE session_participants.session_id = sessions.id 
      AND session_participants.user_id = auth.uid()
  )
);