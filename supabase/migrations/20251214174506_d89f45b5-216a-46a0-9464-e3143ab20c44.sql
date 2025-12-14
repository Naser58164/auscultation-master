-- Simplify sessions policies to avoid role-function recursion
DROP POLICY IF EXISTS "Examiners can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Examiners can view own sessions" ON public.sessions;

-- Any authenticated user can create sessions where they are the examiner
CREATE POLICY "Users can create sessions" 
ON public.sessions
FOR INSERT TO authenticated
WITH CHECK (examiner_id = auth.uid());

-- Any authenticated user can view sessions where they are the examiner
CREATE POLICY "Users can view own sessions" 
ON public.sessions
FOR SELECT TO authenticated
USING (examiner_id = auth.uid());