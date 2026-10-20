/**
 * Browser-only Supabase client used exclusively for Google sign-in.
 *
 * The app's real session stays the existing encrypted `cupai_session` /
 * `cupai_cs` cookie system; this client only performs the Google OAuth
 * handshake and hands the resulting access token to a server function.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export async function getBrowserSupabase(): Promise<SupabaseClient> {
  return supabase;
}

export type GoogleIntent = { kind: "merchant" };

const INTENT_KEY = "cupai-google-intent";

export function saveGoogleIntent(intent: GoogleIntent) {
  sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
}

export function readGoogleIntent(): GoogleIntent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleIntent;
  } catch {
    return null;
  }
}

export function clearGoogleIntent() {
  sessionStorage.removeItem(INTENT_KEY);
}

/** Start the Google OAuth redirect flow. */
export async function startGoogleSignIn(intent: GoogleIntent) {
  saveGoogleIntent(intent);
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: `${window.location.origin}/auth/callback`,
    extraParams: { prompt: "select_account" },
  });
  if (result.error) throw new Error(result.error.message);
  if (!result.redirected) window.location.assign("/auth/callback");
}
