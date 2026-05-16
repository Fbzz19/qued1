/*
  # Add profile visibility setting

  Allows users to set their profile to public (visible in Members directory).
  Default is public. Also allows unauthenticated browsing of public profiles.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_public boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Authenticated users can see all profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);

-- Anon users can only see public profiles (for members browsing without login)
DROP POLICY IF EXISTS "profiles_select_anon" ON profiles;
CREATE POLICY "profiles_select_anon" ON profiles FOR SELECT TO anon USING (is_public = true);
