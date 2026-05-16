// Content moderation — blocks offensive language at every input point with zero exceptions
// Pattern-based approach normalizing common leet-speak substitutions

const BANNED_PATTERNS = [
  /f+u+c+k+/i,
  /s+h+i+t+/i,
  /c+u+n+t+/i,
  /a+s+s+h+o+l+e+/i,
  /b+i+t+c+h+/i,
  /\bc+o+c+k+/i,
  /\bd+i+c+k+/i,
  /p+u+s+s+y+/i,
  /n+i+g+g+e+r+/i,
  /n+i+g+g+a+/i,
  /f+a+g+g+o+t+/i,
  /\bf+a+g+\b/i,
  /r+e+t+a+r+d+/i,
  /\bc+h+i+n+k+\b/i,
  /\bs+p+i+c+\b/i,
  /w+h+o+r+e+/i,
  /\bs+l+u+t+\b/i,
  /\bk+i+k+e+\b/i,
  /t+w+a+t+/i,
  /\bd+y+k+e+\b/i,
  /t+r+a+n+n+y+/i,
  /j+i+g+a+b+o+o+/i,
  /w+e+t+b+a+c+k+/i,
  /s+a+n+d+n+i+g+g+e+r+/i,
  /b+e+a+n+e+r+/i,
  /h+a+i+l+\s*h+i+t+l+e+r+/i,
  /\bn+a+z+i+\b/i,
  /\bk+k+k+\b/i,
  /\bp+e+d+o+/i,
  /p+e+d+o+p+h+i+l+e+/i,
  /\br+a+p+e+\b/i,
  /k[i!1][l|][l|]/i,
  /k[i!1]ll yourself/i,
  /\bkys\b/i,
  /\bgook\b/i,
  /\bwhite.?power\b/i,
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[$5]/g, 's')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[7]/g, 't')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsOffensiveContent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const norm = normalize(text);
  return BANNED_PATTERNS.some(p => p.test(norm) || p.test(text));
}

export const MODERATION_ERROR = 'This content violates Qued community guidelines and cannot be posted.';
export const SUSPENSION_ERROR = 'Your account has been suspended for repeated violations of community guidelines.';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

// Record a strike for repeat offenders — returns { suspended, strikes }
export async function recordOffensiveStrike(
  userId: string,
  supabase: SupabaseLike
): Promise<{ suspended: boolean; strikes: number }> {
  const { data: existing } = await supabase
    .from('offensive_strikes')
    .select('strike_count, suspended')
    .eq('user_id', userId)
    .maybeSingle();

  const currentStrikes = existing?.strike_count ?? 0;
  const newStrikes = currentStrikes + 1;
  const suspended = newStrikes >= 5;

  await supabase.from('offensive_strikes').upsert(
    { user_id: userId, strike_count: newStrikes, suspended, last_strike_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

  return { suspended, strikes: newStrikes };
}

export async function isUserSuspended(
  userId: string,
  supabase: SupabaseLike
): Promise<boolean> {
  const { data } = await supabase
    .from('offensive_strikes')
    .select('suspended')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.suspended ?? false;
}

// Spoiler keyword detection
const SPOILER_PATTERNS = [
  /\b(dies?|dead|killed?|murder(ed)?|death)\b/i,
  /\b(twist|reveal|ending|finale|final\s+scene)\b/i,
  /\b(turns\s+out|it\s+was|he\s+was|she\s+was|they\s+were)\b/i,
  /\b(secret(ly)?|secretly|actually|surprise)\b/i,
  /\b(villain|hero|traitor|betrays?)\b/i,
  /\b(pregnant|affair|cheating|divorce)\b/i,
  /\b(survives?|doesn'?t\s+survive|makes?\s+it)\b/i,
];

export function likelyContainsSpoilers(text: string): boolean {
  if (!text || text.length < 20) return false;
  const matchCount = SPOILER_PATTERNS.filter(p => p.test(text)).length;
  return matchCount >= 2;
}
