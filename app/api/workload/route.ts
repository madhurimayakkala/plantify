// app/api/workload/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUser } from "@/lib/api-auth";
import { parseAndValidate, workloadPutSchema } from "@/lib/validation";

export async function GET() {
  const { userId, error: authError } = await requireUser();
  if (authError) return authError;

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

  const { data: body, error: validationError } = await parseAndValidate(
    req,
    workloadPutSchema
  );
  if (validationError) return validationError;

  const { data, error } = await supabase
    .from("active_workloads")
    .upsert({
      user_id: userId,
      name: body.name,
      tasks: body.tasks,
      started_at: body.started_at,
      cumulative_water: body.cumulative_water,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE() {
  const { userId, error: authError } = await requireUser();
  if (authError) return authError;

  const { error } = await supabase
    .from("active_workloads")
    .delete()
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
