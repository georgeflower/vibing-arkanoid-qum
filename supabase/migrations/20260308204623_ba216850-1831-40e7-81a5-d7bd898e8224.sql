
-- Add new columns to player_profiles
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS initials text DEFAULT 'AAA',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bio text;

-- Add unique constraint on username
CREATE UNIQUE INDEX IF NOT EXISTS player_profiles_username_unique ON public.player_profiles (username) WHERE username IS NOT NULL;

-- Add user_id to high_scores for profile linking
ALTER TABLE public.high_scores
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- RLS: Allow anyone to view public profiles
CREATE POLICY "Anyone can view public profiles"
  ON public.player_profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Update handle_new_user to set username and initials from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.player_profiles (user_id, display_name, username, initials)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Player'),
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'initials', 'AAA')
  );
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
