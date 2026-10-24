// lib/supabase-server.ts
//
// Server-only Supabase clients. Import from route handlers (app/api/**) only.
//
// These use the public ANON key, never the service role key, so Postgres
// Row Level Security is always in force:
//
//  - createServerSupabase() sends the signed-in user's Clerk session token
//    with every request. Supabase verifies it (Clerk is registered as a
//    third-party auth provider) and exposes its claims to policies through
//    auth.jwt(). Policies compare auth.jwt() ->> 'sub' with user_id.
//  - createAnonSupabase() sends no user token; it can only do what the
//    `anon` role is allowed to (see supabase/migrations).
//
// Create a client per request. It is cheap, and the token getter reads the
// current request's Clerk session, so a client must not be shared between
// requests or users.
import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return { url, anonKey };
}

/** Supabase client that acts as the signed-in Clerk user. */
export function createServerSupabase(): SupabaseClient {
  const { url, anonKey } = readConfig();

  return createClient(url, anonKey, {
    // Called by supabase-js for each request. Returns the Clerk session JWT,
    // or null when nobody is signed in (supabase-js then falls back to the
    // anon key, so the request runs as `anon` and RLS returns nothing).
    accessToken: async () => (await auth()).getToken(),
  });
}

/** Supabase client with no user identity (the `anon` role). */
export function createAnonSupabase(): SupabaseClient {
  const { url, anonKey } = readConfig();

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
