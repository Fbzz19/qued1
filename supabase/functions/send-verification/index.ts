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
    const { email, password, username } = await req.json();
    if (!email || !password || !username) return json({ error: "Missing required fields" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey   = Deno.env.get("RESEND_API_KEY");

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Check username availability ──────────────────────────────────────
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (existingProfile) return json({ error: "Username already taken" }, 409);

    // ── 2. Find or create the auth user ─────────────────────────────────────
    let userId: string;

    // Look for an existing unconfirmed user with this email
    const { data: listData } = await admin.auth.admin.listUsers();
    const existingUser = listData?.users?.find(
      u => u.email === email && !u.email_confirmed_at
    );

    if (existingUser) {
      // Reuse the existing unconfirmed user; update their password in case it changed
      await admin.auth.admin.updateUserById(existingUser.id, { password });
      userId = existingUser.id;
    } else {
      // Check if email belongs to a confirmed account
      const confirmedUser = listData?.users?.find(
        u => u.email === email && u.email_confirmed_at
      );
      if (confirmedUser) {
        return json({ error: "An account with this email already exists" }, 409);
      }

      // Create a new unconfirmed auth user
      const { data: userData, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { username },
      });

      if (createErr) {
        return json({ error: createErr.message }, 400);
      }
      userId = userData.user.id;
    }

    // ── 3. Check resend rate limit (max 3 per 10 min window) ─────────────────
    const { data: existing } = await admin
      .from("email_verification_codes")
      .select("resend_count, last_resent_at, created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const windowStart = new Date(Date.now() - 10 * 60 * 1000);
      const lastResent  = existing.last_resent_at ? new Date(existing.last_resent_at) : new Date(existing.created_at);
      if (existing.resend_count >= 3 && lastResent > windowStart) {
        return json({ error: "Too many resend attempts. Please wait before trying again." }, 429);
      }
    }

    // ── 4. Generate and store hashed 6-digit code ────────────────────────────
    const code     = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256hex(code);

    await admin.from("email_verification_codes").upsert({
      user_id:        userId,
      email,
      code_hash:      codeHash,
      expires_at:     new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      resend_count:   (existing?.resend_count ?? 0) + (existing ? 1 : 0),
      last_resent_at: existing ? new Date().toISOString() : null,
    }, { onConflict: "user_id" });

    // ── 5. Send email via Resend ─────────────────────────────────────────────
    if (resendKey) {
      const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#0b0b0b;border:1px solid #1f1f1f;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:36px 40px 10px;">
              <h1 style="margin:0;font-size:30px;font-weight:700;color:#f5a400;letter-spacing:-1px;">Qued</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 40px;">
              <h2 style="margin:0 0 16px;font-size:30px;line-height:1.2;color:#ffffff;">Confirm your email</h2>
              <p style="font-size:16px;line-height:1.7;color:#cfcfcf;margin:0 0 18px;">Welcome to Qued. Enter the 6-digit code below to confirm your email and finish creating your account.</p>
              <div style="background:#111111;border:1px solid #2a2a2a;border-radius:16px;padding:24px;margin:30px 0;text-align:center;">
                <p style="margin:0 0 10px;color:#8a8a8a;font-size:13px;text-transform:uppercase;letter-spacing:2px;">Your verification code</p>
                <p style="margin:0;color:#f5a400;font-size:42px;font-weight:800;letter-spacing:10px;">${code}</p>
              </div>
              <div style="background:#111111;border:1px solid #2a2a2a;border-left:4px solid #f5a400;border-radius:14px;padding:18px;margin:26px 0;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#ffffff;">This code expires in 10 minutes. If you did not create a Qued account, you can safely ignore this email.</p>
              </div>
              <p style="font-size:14px;line-height:1.6;color:#8a8a8a;margin:0;">For security, never share this code with anyone.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 40px;border-top:1px solid #1f1f1f;color:#777777;font-size:13px;">© 2026 Qued. All rights reserved.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Qued <hello@myqued.com>",
          to: [email],
          subject: "Your Qued verification code",
          html,
        }),
      });

      if (!emailRes.ok) {
        console.error("Resend error:", emailRes.status, await emailRes.text());
      }
    } else {
      console.warn("RESEND_API_KEY not set — verification code:", code);
    }

    return json({ success: true, userId });
  } catch (err) {
    console.error("send-verification error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
