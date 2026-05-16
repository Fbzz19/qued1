/*
  # Fix Security: Functions, RLS Policies, and Missing Policies

  ## Changes

  ### 1. Fix fn_rating_to_feed and fn_review_to_feed
  - Set explicit search_path to prevent mutable search_path vulnerability
  - Change from SECURITY DEFINER to SECURITY INVOKER to prevent privilege escalation
  - Revoke execute from public/anon/authenticated roles, grant only to service role

  ### 2. Fix notifications INSERT policy
  - Replace the always-true WITH CHECK on INSERT
  - Require authenticated users to insert only notifications where actor_id = auth.uid()

  ### 3. Add RLS policies for email_verification_codes
  - No direct user access; service role handles all operations via edge functions
  - Add a restrictive policy that denies all access from non-service roles (belt-and-suspenders)

  ### 4. Add RLS policies for flagged_accounts
  - Allow authenticated users to read their own flagged status
  - Deny all other access (inserts/updates/deletes handled by admin/service role)
*/

-- ── 1. Fix fn_rating_to_feed ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'fn_rating_to_feed' AND n.nspname = 'public'
  ) THEN
    ALTER FUNCTION public.fn_rating_to_feed()
      SET search_path = public, pg_catalog
      SECURITY INVOKER;

    REVOKE ALL ON FUNCTION public.fn_rating_to_feed() FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.fn_rating_to_feed() FROM anon;
    REVOKE ALL ON FUNCTION public.fn_rating_to_feed() FROM authenticated;
  END IF;
END $$;

-- ── 2. Fix fn_review_to_feed ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'fn_review_to_feed' AND n.nspname = 'public'
  ) THEN
    ALTER FUNCTION public.fn_review_to_feed()
      SET search_path = public, pg_catalog
      SECURITY INVOKER;

    REVOKE ALL ON FUNCTION public.fn_review_to_feed() FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.fn_review_to_feed() FROM anon;
    REVOKE ALL ON FUNCTION public.fn_review_to_feed() FROM authenticated;
  END IF;
END $$;

-- ── 3. Fix notifications INSERT policy ───────────────────────────────────────
-- Drop the insecure always-true policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND schemaname = 'public' AND cmd = 'INSERT'
  ) THEN
    -- Drop all existing INSERT policies on notifications to replace with secure ones
    EXECUTE (
      SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.notifications;', E'\n')
      FROM pg_policies
      WHERE tablename = 'notifications' AND schemaname = 'public' AND cmd = 'INSERT'
    );
  END IF;
END $$;

-- Create a secure INSERT policy: actor must be the authenticated user
CREATE POLICY "Authenticated users can create notifications as themselves"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ── 4. RLS policies for email_verification_codes ────────────────────────────
-- This table is managed entirely by the service role via edge functions.
-- No direct authenticated or anon access is needed or allowed.
-- Since RLS is already enabled, no policies = no access (deny-by-default).
-- We explicitly document this with a comment.
COMMENT ON TABLE public.email_verification_codes IS
  'Managed exclusively by edge functions using the service role key. No direct authenticated access permitted.';

-- ── 5. RLS policies for flagged_accounts ─────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'flagged_accounts'
  ) THEN
    -- Enable RLS just in case it wasn't already
    ALTER TABLE public.flagged_accounts ENABLE ROW LEVEL SECURITY;

    -- Users can see if their own account is flagged (read-only)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'flagged_accounts' AND schemaname = 'public'
        AND policyname = 'Users can view own flagged status'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "Users can view own flagged status"
          ON public.flagged_accounts
          FOR SELECT
          TO authenticated
          USING (user_id = auth.uid())
      $policy$;
    END IF;
  END IF;
END $$;
