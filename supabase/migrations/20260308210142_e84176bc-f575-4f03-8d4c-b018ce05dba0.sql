
-- Add avatar_url column to player_profiles
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create avatars storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('avatars', 'avatars', true, 262144)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for avatars bucket
-- Anyone can read avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own profile (for account deletion)
CREATE POLICY "Users can delete own profile"
ON public.player_profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow service role to delete profiles
CREATE POLICY "Service role can delete profiles"
ON public.player_profiles FOR DELETE
USING (true);

-- Allow service role to update high_scores (to null out user_id on account deletion)
CREATE POLICY "Service role can update high scores"
ON public.high_scores FOR UPDATE
USING (true)
WITH CHECK (true);

-- Update handle_new_user to set display_name = username
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
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player'),
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'initials', 'AAA')
  );
  RETURN NEW;
END;
$function$;
