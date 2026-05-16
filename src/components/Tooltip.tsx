import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type TooltipKey = 'quick_add' | 'feed' | 'watchorder' | 'ai_recommender' | 'search';

interface TooltipProps {
  tooltipKey: TooltipKey;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
}

// Shared hook to manage seen tooltips
let cachedSeen: Set<string> | null = null;
let cacheUserId: string | null = null;

export function useTooltips() {
  const { user } = useAuth();
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setSeen(new Set()); setLoaded(true); return; }
    if (cachedSeen && cacheUserId === user.id) { setSeen(cachedSeen); setLoaded(true); return; }

    const { data } = await supabase.from('tooltip_seen').select('tooltips').eq('user_id', user.id).maybeSingle();
    const s = new Set<string>(data?.tooltips ?? []);
    cachedSeen = s;
    cacheUserId = user.id;
    setSeen(s);
    setLoaded(true);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const dismiss = useCallback(async (key: string) => {
    if (!user) return;
    const next = new Set(seen);
    next.add(key);
    setSeen(next);
    cachedSeen = next;

    const arr = [...next];
    await supabase.from('tooltip_seen').upsert(
      { user_id: user.id, tooltips: arr, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  }, [user, seen]);

  return { seen, dismiss, loaded };
}

export default function Tooltip({ tooltipKey, content, position = 'bottom', children }: TooltipProps) {
  const { user } = useAuth();
  const { seen, dismiss, loaded } = useTooltips();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loaded && user && !seen.has(tooltipKey)) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [loaded, user, seen, tooltipKey]);

  if (!visible) return <>{children}</>;

  const posStyles: Record<string, React.CSSProperties> = {
    top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 },
    left:   { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 },
    right:  { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 },
  };

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setVisible(false);
    dismiss(tooltipKey);
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {children}
      <div
        className="animate-slide-down"
        style={{
          position: 'absolute', zIndex: 400,
          background: '#1a1a1a', border: '1px solid #2e2e2e',
          borderRadius: 10, padding: '10px 12px 10px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 8,
          maxWidth: 220, whiteSpace: 'normal',
          boxShadow: '0 8px 30px rgba(0,0,0,.6)',
          ...posStyles[position],
        }}
      >
        <span style={{ color: '#ccc', fontSize: 12, lineHeight: 1.5, flex: 1 }}>{content}</span>
        <button
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 2, flexShrink: 0, marginTop: 1 }}
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}
