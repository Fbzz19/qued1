import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';

export interface PendingVerification {
  userId: string;
  email: string;
  password: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  pendingVerification: PendingVerification | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  verifyCode: (code: string) => Promise<{ error: Error | null }>;
  resendCode: () => Promise<{ error: Error | null }>;
  cancelVerification: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,                setUser]                = useState<User | null>(null);
  const [session,             setSession]             = useState<Session | null>(null);
  const [profile,             setProfile]             = useState<Profile | null>(null);
  const [loading,             setLoading]             = useState(true);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) setProfile(data as Profile);
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => { await fetchProfile(session.user.id); })();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(email: string, password: string, username: string) {
    const res = await fetch(`${FUNCTIONS_URL}/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });
    const data = await res.json();
    if (!res.ok) return { error: new Error(data.error ?? 'Sign up failed') };

    setPendingVerification({ userId: data.userId, email, password, username });
    return { error: null };
  }

  async function verifyCode(code: string) {
    if (!pendingVerification) return { error: new Error('No pending verification') };
    const { userId, email, password, username } = pendingVerification;

    const res = await fetch(`${FUNCTIONS_URL}/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code, username }),
    });
    const data = await res.json();
    if (!res.ok) return { error: new Error(data.error ?? 'Verification failed') };

    setPendingVerification(null);
    // Sign in to establish a session now that the profile exists
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    return { error: signInErr };
  }

  async function resendCode() {
    if (!pendingVerification) return { error: new Error('No pending verification') };
    const { email, password, username } = pendingVerification;

    const res = await fetch(`${FUNCTIONS_URL}/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });
    const data = await res.json();
    if (!res.ok) return { error: new Error(data.error ?? 'Resend failed') };

    setPendingVerification(prev => prev ? { ...prev, userId: data.userId } : prev);
    return { error: null };
  }

  function cancelVerification() {
    setPendingVerification(null);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      pendingVerification,
      signIn, signUp, verifyCode, resendCode, cancelVerification, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
