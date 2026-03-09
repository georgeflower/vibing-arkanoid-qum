
CREATE POLICY "Only backend can delete daily challenge scores"
  ON public.daily_challenge_scores FOR DELETE
  USING (true);
