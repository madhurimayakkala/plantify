// app/api/garden/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireUser } from "@/lib/api-auth";
import { parseAndValidate, gardenPostSchema } from "@/lib/validation";

export async function GET() {
  const { userId, error: authError } = await requireUser();
  if (authError) return authError;

  // Acts as this user: RLS applies on top of the user_id filters below.
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("garden_entries")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mapped = data.map((entry) => ({
    id: entry.id,
    workloadName: entry.workload_name,
    savedAt: entry.saved_at,
    waterPercent: entry.water_percent,
    stage: entry.stage,
    stageEmoji: entry.stage_emoji,
    tasksCompleted: entry.tasks_completed,
    tasksTotal: entry.tasks_total,
  }));

  return NextResponse.json(mapped);
}

export async function POST(req: Request) {
  const { userId, error: authError } = await requireUser();
  if (authError) return authError;

  // Acts as this user: RLS applies on top of the user_id filters below.
  const supabase = createServerSupabase();

  const { data: body, error: validationError } = await parseAndValidate(
    req,
    gardenPostSchema
  );
  if (validationError) return validationError;

  // Idempotent save: the client generates the id, so re-sending the same
  // entry (e.g. retrying a partly failed guest migration) must not create a
  // duplicate. ignoreDuplicates makes this ON CONFLICT (id) DO NOTHING, so an
  // existing row is never modified, even if its id belongs to another user.
  const { error } = await supabase.from("garden_entries").upsert(
    {
      id: body.id,
      user_id: userId,
      workload_name: body.workloadName,
      stage: body.stage,
      stage_emoji: body.stageEmoji,
      water_percent: body.waterPercent,
      tasks_completed: body.tasksCompleted,
      tasks_total: body.tasksTotal,
      saved_at: body.savedAt,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Read back scoped by user_id. If the id already exists but belongs to a
  // different user, this finds nothing and we refuse instead of leaking or
  // overwriting that row.
  const { data, error: readError } = await supabase
    .from("garden_entries")
    .select("*")
    .eq("id", body.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Garden entry id is already in use" },
      { status: 409 }
    );
  }

  return NextResponse.json(data);
}

export async function DELETE() {
  const { userId, error: authError } = await requireUser();
  if (authError) return authError;

  // Acts as this user: RLS applies on top of the user_id filters below.
  const supabase = createServerSupabase();

  const { error } = await supabase
    .from("garden_entries")
    .delete()
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
