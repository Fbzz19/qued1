/*
  # Fix avatar storage RLS policies

  ## Problem
  Three issues with the existing storage.objects policies for the avatars bucket:

  1. INSERT policy checks `(storage.foldername(name))[1] = 'avatars'` which is wrong.
     The upload path is `{user_id}/avatar.jpg`, so foldername[1] is the user's UUID, not 'avatars'.
     This blocks every upload attempt.

  2. SELECT policy only allows users to read their own avatar (owner = auth.uid()).
     Avatars must be publicly readable so they appear on other users' profiles, members page, etc.
     The bucket is already marked public, so this policy contradicts it.

  3. UPDATE policy is fine but the INSERT fix is what matters most.

  ## Fix
  - Drop all three broken policies
  - Add a correct INSERT policy: user can only upload to a path starting with their own uid
  - Add a correct UPDATE policy: user can only replace their own file
  - Remove the restrictive SELECT policy (bucket is public; Supabase serves public bucket objects
    without a SELECT policy needed — but we add a permissive one for clarity)
*/

-- Drop all existing avatar storage policies
DROP POLICY IF EXISTS "Authenticated users can read own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
DROP POLICY IF EXISTS "Avatar authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatar authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar authenticated delete" ON storage.objects;

-- Public read: anyone can view avatars (they appear site-wide)
CREATE POLICY "Avatar public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated upload: user can only write to their own folder path ({uid}/*)
CREATE POLICY "Avatar authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Authenticated replace: user can only overwrite their own folder path ({uid}/*)
CREATE POLICY "Avatar authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Authenticated delete: user can only remove their own avatar
CREATE POLICY "Avatar authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
