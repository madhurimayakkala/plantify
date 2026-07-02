import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * This client uses the SERVICE ROLE key, not the public anon key.
 *
 * The service role key bypasses Row Level Security (RLS) entirely, so it
 * must never be exposed to the browser. That's why it's read from
 * SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix) rather than
 * NEXT_PUBLIC_SUPABASE_ANON_KEY.
 *
 * This file is only ever imported from API route files (app/api/**),
 * which run exclusively on the server — this value is never sent to
 * the client bundle.
 *
 * Authorization is enforced by requireUser() (lib/api-auth.ts) in every
 * route handler, which checks the Clerk session before any Supabase call
 * is made using this client.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
