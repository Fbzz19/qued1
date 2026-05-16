/*
  # Fix notification_emails RLS Security Vulnerability

  ## Problem
  The existing INSERT policy used `WITH CHECK (true)` which allows anyone to insert any data.

  ## Fix
  - Drop the insecure policy
  - Add a new policy that validates email format using regex
  - The policy prevents duplicate emails via a NOT EXISTS check
  - Preserves the same public-insert functionality but with proper validation

  ## Security Changes
  - Email must match standard email regex pattern
  - Duplicate emails are rejected at the policy level
*/

-- Drop the insecure policy if it exists
DROP POLICY IF EXISTS "Anyone can join waitlist" ON notification_emails;
DROP POLICY IF EXISTS "Public insert for waitlist" ON notification_emails;
DROP POLICY IF EXISTS "Allow public insert" ON notification_emails;

-- Recreate with secure validation
CREATE POLICY "Valid email waitlist insert"
  ON notification_emails
  FOR INSERT
  WITH CHECK (
    email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
    AND NOT EXISTS (
      SELECT 1 FROM notification_emails ne2 WHERE ne2.email = email
    )
  );
