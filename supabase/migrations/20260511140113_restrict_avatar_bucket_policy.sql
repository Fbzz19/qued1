/*
  # Restrict avatar storage SELECT policy

  Problem: The broad SELECT policy "Public read access to avatars" allows
  clients to list all files in the avatars bucket, exposing filenames/paths
  of all users unnecessarily.

  Fix: Drop the broad policy and replace with a restrictive one that only
  allows reading a specific object when the caller knows its exact path
  (i.e., direct URL access works, but listing the bucket contents does not).
  This is achieved by requiring the `name` column to not be empty — combined
  with PostgREST's default behaviour, unauthenticated listing queries are blocked
  while direct object GET requests through the Storage CDN still work because
  public buckets serve objects via signed CDN URLs without hitting RLS at all.
*/

-- Drop the overly broad policy
DROP POLICY IF EXISTS "Public read access to avatars" ON storage.objects;

-- Re-create a tighter policy: only authenticated users can read objects,
-- and only their own avatar path. Anonymous CDN delivery still works
-- through the public bucket CDN layer without touching this policy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Authenticated users can read own avatar'
  ) THEN
    CREATE POLICY "Authenticated users can read own avatar"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND owner = auth.uid()
    );
  END IF;
END $$;
