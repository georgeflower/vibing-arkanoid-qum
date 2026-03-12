DROP POLICY "Service role can delete profiles" ON public.player_profiles;

CREATE POLICY "Service role can delete profiles"
ON public.player_profiles FOR DELETE
TO service_role
USING (true);