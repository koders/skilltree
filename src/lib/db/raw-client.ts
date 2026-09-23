// Supabase client factory without the "server-only" guard, so tsx scripts can
// use it. App code goes through `db()` in ./client.ts instead.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseEnv {
  url: string;
  secretKey: string;
}

export function readSupabaseEnv(env: Record<string, string | undefined> = process.env): SupabaseEnv {
  const url = env.SUPABASE_PROJECT_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  const missing = [!url && "SUPABASE_PROJECT_URL", !secretKey && "SUPABASE_SECRET_KEY"].filter(Boolean);
  if (!url || !secretKey) {
    throw new Error(
      `Missing ${missing.join(" and ")}. Set them in .env.local (Supabase → Project Settings → API keys; use the sb_secret_… key).`,
    );
  }
  return { url, secretKey };
}

const CLOCK_SKEW_RETRY_MS = 1000;

/**
 * The gateway mints a short-lived JWT from the sb_secret_ key; on a cold start
 * PostgREST occasionally rejects it with 401 "JWT issued at future" (clock
 * skew between the two). The request never ran, so one delayed retry is safe
 * even for writes.
 */
export const fetchWithClockSkewRetry: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;
  const body = await res.clone().text();
  if (!/issued at future/i.test(body)) return res;
  await new Promise((resolve) => setTimeout(resolve, CLOCK_SKEW_RETRY_MS));
  return fetch(input, init);
};

/** A service client using the secret key: bypasses RLS, never ship it to the browser. */
export function createServiceClient(env: Record<string, string | undefined> = process.env): SupabaseClient {
  const { url, secretKey } = readSupabaseEnv(env);
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchWithClockSkewRetry },
  });
}
