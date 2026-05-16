import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User client to verify JWT and get user id
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const userEmail = user.email ?? "";

    // Service role client for destructive operations
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── 1. Delete all user data in dependency order ──────────────────────────

    // Comments / replies on activity feed
    await admin.from("activity_feed_comments").delete().eq("user_id", userId);

    // Activity likes given by this user
    await admin.from("activity_likes").delete().eq("user_id", userId);

    // Likes received on this user's activity
    const { data: myActivity } = await admin
      .from("activity_feed")
      .select("id")
      .eq("user_id", userId);
    if (myActivity && myActivity.length > 0) {
      const ids = myActivity.map((a: { id: string }) => a.id);
      await admin.from("activity_likes").delete().in("activity_id", ids);
      await admin.from("activity_feed_comments").delete().in("activity_id", ids);
    }

    // Activity feed posts
    await admin.from("activity_feed").delete().eq("user_id", userId);

    // Review comments on this user's reviews and by this user
    await admin.from("review_comments").delete().eq("user_id", userId);

    // Likes on reviews
    await admin.from("likes").delete().eq("user_id", userId);

    // Reviews
    await admin.from("reviews").delete().eq("user_id", userId);

    // Ratings
    await admin.from("ratings").delete().eq("user_id", userId);

    // Watched entries
    await admin.from("watched").delete().eq("user_id", userId);

    // Watchlist
    await admin.from("watchlist").delete().eq("user_id", userId);

    // Episode ratings
    await admin.from("episode_ratings").delete().eq("user_id", userId);

    // Lists and list items
    const { data: userLists } = await admin.from("lists").select("id").eq("user_id", userId);
    if (userLists && userLists.length > 0) {
      const listIds = userLists.map((l: { id: string }) => l.id);
      await admin.from("list_items").delete().in("list_id", listIds);
    }
    await admin.from("lists").delete().eq("user_id", userId);

    // Follows (both directions)
    await admin.from("follows").delete().eq("follower_id", userId);
    await admin.from("follows").delete().eq("following_id", userId);

    // Notifications
    await admin.from("notifications").delete().eq("user_id", userId);
    await admin.from("notifications").delete().eq("actor_id", userId);

    // Direct messages
    await admin.from("direct_messages").delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);

    // Reports by this user
    await admin.from("reports").delete().eq("reporter_id", userId);

    // Block relationships
    await admin.from("blocked_users").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    // User achievements
    await admin.from("user_achievements").delete().eq("user_id", userId);

    // AI usage
    await admin.from("ai_recommendation_usage").delete().eq("user_id", userId);

    // User settings
    await admin.from("user_settings").delete().eq("user_id", userId);

    // Notification emails (if stored)
    await admin.from("notification_emails").delete().eq("email", userEmail);

    // ─── 2. Anonymise / delete profile ────────────────────────────────────────
    // Soft-anonymise first so FK constraints don't cascade unexpectedly,
    // then hard-delete. We overwrite PII fields before deletion.
    await admin.from("profiles").update({
      username: `deleted_${userId.slice(0, 8)}`,
      bio: null,
      avatar_url: null,
      banner_url: null,
      twitter: null,
      instagram: null,
      letterboxd: null,
      favourite_films: [],
      is_public: false,
    }).eq("id", userId);

    await admin.from("profiles").delete().eq("id", userId);

    // ─── 3. Delete from Supabase Auth ─────────────────────────────────────────
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("Auth delete error:", deleteAuthError.message);
      // Non-fatal — data is already wiped
    }

    // ─── 4. Confirmation email via Resend ────────────────────────────────────
    if (userEmail) {
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) throw new Error("RESEND_API_KEY not configured");

        const emailHtml = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#0b0b0b;border:1px solid #1f1f1f;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:36px 40px 10px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:34px;height:34px;border:2px solid #f5a400;border-radius:8px;position:relative;box-sizing:border-box;">
                  <div style="position:absolute;top:4px;left:4px;width:6px;height:6px;background:#f5a400;border-radius:2px;box-shadow:0 10px #f5a400,0 20px #f5a400,18px 0 #f5a400,18px 10px #f5a400,18px 20px #f5a400;"></div>
                </div>
                <h1 style="margin:0;font-size:30px;font-weight:700;color:#f5a400;letter-spacing:-1px;">Qued</h1>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 40px;">
              <h2 style="margin:0 0 16px;font-size:30px;line-height:1.2;color:#ffffff;">Your account has been deleted</h2>
              <p style="font-size:16px;line-height:1.7;color:#cfcfcf;margin:0 0 18px;">This email confirms that your Qued account has been permanently deleted from our platform.</p>
              <p style="font-size:16px;line-height:1.7;color:#cfcfcf;margin:0 0 24px;">Your profile, watchlists, ratings, reviews, favourites, activity, and account details have been removed.</p>
              <div style="background:#111111;border:1px solid #2a2a2a;border-left:4px solid #f5a400;border-radius:14px;padding:18px;margin:26px 0;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#ffffff;">Your email address and username are now free to use again if you decide to return to Qued in the future.</p>
              </div>
              <p style="font-size:14px;line-height:1.6;color:#8a8a8a;margin:0;">If you did not request this deletion, please contact Qued support immediately.</p>
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
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Qued <hello@myqued.com>",
            to: [userEmail],
            subject: "Your Qued account has been deleted",
            html: emailHtml,
          }),
        });

        if (!emailRes.ok) {
          const errBody = await emailRes.text();
          console.error("Resend email error:", emailRes.status, errBody);
        }
      } catch (emailErr) {
        // Email failure must never block a successful deletion
        console.error("Failed to send deletion confirmation email:", emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-account error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
