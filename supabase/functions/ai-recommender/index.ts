import Anthropic from 'npm:@anthropic-ai/sdk@0.27.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DAILY_LIMIT = 3;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify the user JWT
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Use service role for DB writes (bypasses RLS for usage tracking)
    const db = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];

    // GET — return current daily usage
    if (req.method === 'GET') {
      const { data } = await db.from('ai_recommendation_usage').select('count').eq('user_id', user.id).eq('usage_date', today).maybeSingle();
      const count = data?.count ?? 0;
      return new Response(
        JSON.stringify({ used: count, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - count) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST — generate recommendations
    const body = await req.json();
    const prompt = (body?.prompt ?? '').toString().trim();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check daily limit
    const { data: usageRow } = await db.from('ai_recommendation_usage').select('id,count').eq('user_id', user.id).eq('usage_date', today).maybeSingle();
    const currentCount = usageRow?.count ?? 0;

    if (currentCount >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'daily_limit_reached', used: currentCount, limit: DAILY_LIMIT, remaining: 0 }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Claude
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a film and TV expert recommender for an app called Qued. The user is asking for watch recommendations.

User request: "${prompt}"

Reply with ONLY a valid JSON array of exactly 3 objects. Each object must have:
- "title": string — the exact title as it appears on IMDB/TMDB
- "year": string — 4-digit release year
- "type": "movie" or "tv"
- "description": string — 1-2 sentences on why it matches the request

No markdown, no explanation, no other text — just the raw JSON array starting with [ and ending with ].`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    let recommendations: unknown[] = [];
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) recommendations = JSON.parse(match[0]);
    } catch { /* leave empty */ }

    // Increment usage count
    if (usageRow) {
      await db.from('ai_recommendation_usage').update({ count: currentCount + 1, updated_at: new Date().toISOString() }).eq('id', usageRow.id);
    } else {
      await db.from('ai_recommendation_usage').insert({ user_id: user.id, usage_date: today, count: 1 });
    }

    return new Response(
      JSON.stringify({ recommendations, used: currentCount + 1, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - currentCount - 1) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
