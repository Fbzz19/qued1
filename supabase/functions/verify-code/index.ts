import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { userId, code, username } = await req.json();
    if (!userId || !code || !username) return json({ error: "Missing required fields" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Look up the verification record ──────────────────────────────────
    const { data: record } = await admin
      .from("email_verification_codes")
      .select("code_hash, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!record) return json({ error: "No verification code found. Please sign up again." }, 404);

    // ── 2. Check expiry ──────────────────────────────────────────────────────
    if (new Date(record.expires_at) < new Date()) {
      await admin.from("email_verification_codes").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: "Code expired. Please sign up again." }, 410);
    }

    // ── 3. Verify hash ───────────────────────────────────────────────────────
    const inputHash = await sha256hex(String(code).trim());
    if (inputHash !== record.code_hash) {
      return json({ error: "Invalid code. Please try again." }, 400);
    }

    // ── 4. Confirm the email in Supabase Auth ────────────────────────────────
    const { error: confirmErr } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (confirmErr) {
      console.error("Auth confirm error:", confirmErr);
      return json({ error: "Failed to confirm email. Please try again." }, 500);
    }

    // ── 5. Create profile (activates account) ───────────────────────────────
    const { error: profileErr } = await admin.from("profiles").upsert({
      id:              userId,
      username:        username.toLowerCase(),
      bio:             "",
      avatar_url:      "",
      favourite_films: [],
    }, { onConflict: "id" });

    if (profileErr) {
      console.error("Profile creation error:", profileErr);
      return json({ error: "Failed to create profile. Please try again." }, 500);
    }

    // ── 6. Delete the used code ──────────────────────────────────────────────
    await admin.from("email_verification_codes").delete().eq("user_id", userId);

    return json({ success: true });
  } catch (err) {
    console.error("verify-code error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
