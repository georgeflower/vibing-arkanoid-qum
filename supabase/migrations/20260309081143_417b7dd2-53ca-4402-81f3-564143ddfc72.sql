
CREATE TABLE public.daily_challenge_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date date NOT NULL,
  player_name text NOT NULL,
  user_id uuid,
  score integer NOT NULL,
  time_seconds integer NOT NULL,
  objectives_met jsonb NOT NULL DEFAULT '[]'::jsonb,
  all_objectives_met boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_challenge_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily challenge scores"
  ON public.daily_challenge_scores FOR SELECT
  USING (true);

CREATE POLICY "Only backend can insert daily challenge scores"
  ON public.daily_challenge_scores FOR INSERT
  WITH CHECK (true);
