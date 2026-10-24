// app/api/health/route.ts
//
// Public liveness check, also used by the keep-alive ping so the Supabase
// project doesn't pause from inactivity. No auth and no user data.
import { NextResponse } from "next/server";
import { createAnonSupabase } from "@/lib/supabase-server";
import { checkDatabase } from "@/lib/healthCheck";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { ok } = await checkDatabase(createAnonSupabase());

    return NextResponse.json(
      { ok },
      { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
