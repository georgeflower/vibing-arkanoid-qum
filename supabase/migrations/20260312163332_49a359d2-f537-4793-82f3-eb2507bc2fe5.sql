DROP POLICY "Service role can update high scores" ON public.high_scores;

CREATE POLICY "Service role can update high scores"
ON public.high_scores FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);