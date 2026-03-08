
-- Create player_profiles table
CREATE TABLE public.player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text NOT NULL,
  total_bricks_destroyed bigint NOT NULL DEFAULT 0,
  total_enemies_killed bigint NOT NULL DEFAULT 0,
  total_bosses_killed bigint NOT NULL DEFAULT 0,
  total_power_ups_collected bigint NOT NULL DEFAULT 0,
  total_games_played integer NOT NULL DEFAULT 0,
  total_time_played_seconds bigint NOT NULL DEFAULT 0,
  best_score integer NOT NULL DEFAULT 0,
  best_level integer NOT NULL DEFAULT 0,
  best_combo_streak integer NOT NULL DEFAULT 0,
  favorite_power_up text,
  power_up_usage jsonb NOT NULL DEFAULT '{}',
  achievements jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.player_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own profile (display_name only from client)
CREATE POLICY "Users can update own profile"
  ON public.player_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert (via trigger and edge function)
CREATE POLICY "Service role can insert profiles"
  ON public.player_profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update profiles (edge function)
CREATE POLICY "Service role can update profiles"
  ON public.player_profiles
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.player_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Player'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
