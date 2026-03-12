DROP POLICY "Service role can insert completions" ON public.daily_challenge_completions;

CREATE POLICY "Service role can insert completions"
ON public.daily_challenge_completions FOR INSERT
TO service_role
WITH CHECK (true);