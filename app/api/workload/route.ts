// app/api/workload/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireUser } from "@/lib/api-auth";
import { parseAndValidate, workloadSaveSchema } from "@/lib/validation";
import { saveWorkload } from "@/lib/workloadSave";

export async function GET() {
  const { userId, error: authError } = await requireUser();
  if (authError) return authError;

  // Acts as this user: RLS applies on top of the user_id filters below.
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("active_workloads")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? null);
}

export async function PUT(req: Request) {
  const { userId, error: authError } = await requireUser();
  if (authError) return authError;

  // Acts as this user: RLS applies on top of the user_id filters below.
  const supabase = createServerSupabase();

  const { data: body, error: validationError } = await parseAndValidate(
    req,
    workloadSaveSchema
  );
  if (validationError) return validationError;

  const result = await saveWorkload(supabase, userId, body);

  if (result.status === "conflict") {
    // The client's copy is stale (or the row was created/deleted elsewhere).
    // Send the current row so it can refresh without another round trip.
    return NextResponse.json(
      {
        error: "Workload was changed elsewhere",
        current: result.current,
      },
      { status: 409 }
    );
  }

  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json(result.workload);
}

export async function DELETE() {
  const { userId, error: authError } = await requireUser();
  if (authError) return authError;

  // Acts as this user: RLS applies on top of the user_id filters below.
  const supabase = createServerSupabase();

  const { error } = await supabase
    .from("active_workloads")
    .delete()
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
