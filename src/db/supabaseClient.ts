import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

let client: SupabaseClient | null = null;

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Put it in .env.local`);
  }
  return value;
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  client = createClient(supabaseUrl, serviceRoleKey);
  return client;
}
