
-- Daily challenge completions table
CREATE TABLE public.daily_challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenge_date date NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  score integer NOT NULL,
  time_seconds integer NOT NULL,
  objectives_met jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (user_id, challenge_date)
);

ALTER TABLE public.daily_challenge_completions ENABLE ROW LEVEL SECURITY;

-- Users can view their own completions
CREATE POLICY "Users can view own completions"
ON public.daily_challenge_completions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role can insert completions
CREATE POLICY "Service role can insert completions"
ON public.daily_challenge_completions
FOR INSERT
WITH CHECK (true);

-- Add daily challenge columns to player_profiles
ALTER TABLE public.player_profiles
  ADD COLUMN daily_challenge_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN best_daily_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN total_daily_challenges_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN last_daily_challenge_date date;
