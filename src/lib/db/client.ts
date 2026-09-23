import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/db/raw-client";

let client: SupabaseClient | null = null;

/** The app's Supabase client (secret key, server-side only), created once per process. */
export function db(): SupabaseClient {
  client ??= createServiceClient();
  return client;
}
