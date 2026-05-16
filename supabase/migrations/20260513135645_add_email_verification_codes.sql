/*
  # Add email verification codes table

  ## Purpose
  Supports a 6-digit email verification flow during signup. Users must verify
  their email before their account becomes active.

  ## New Tables
  - `email_verification_codes`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references auth.users — the newly created but unverified user)
    - `email` (text — the address the code was sent to)
    - `code_hash` (text — SHA-256 hex of the 6-digit code; never stored plain)
    - `expires_at` (timestamptz — 10 minutes from creation)
    - `resend_count` (int — tracks how many times code was resent, for rate limiting)
    - `last_resent_at` (timestamptz — timestamp of last resend)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled; only the service role (edge functions) can write/read rows.
  - No authenticated-user policies — all access is via service role in edge functions.

  ## Notes
  - Codes older than 10 minutes are considered expired; the edge function checks expires_at.
  - After successful verification the row is deleted.
  - A unique constraint on user_id ensures one pending code per user at a time.
*/

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email          text NOT NULL,
  code_hash      text NOT NULL,
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  resend_count   int NOT NULL DEFAULT 0,
  last_resent_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_verification_codes_user_id_key UNIQUE (user_id)
);

ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (no authenticated-user policies).
-- Edge functions use the service role key and bypass RLS.
