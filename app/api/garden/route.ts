import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("garden_entries")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
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
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();

  const { data, error } = await supabase
    .from("garden_entries")
    .insert({
      user_id: userId,
      workload_name: body.workloadName,
      stage: body.stage,
      stage_emoji: body.stageEmoji,
      water_percent: body.waterPercent,
      tasks_completed: body.tasksCompleted,
      tasks_total: body.tasksTotal,
      saved_at: body.savedAt,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
export async function DELETE() {
const { userId } = await auth();

if (!userId) {
return NextResponse.json(
{ error: "Unauthorized" },
{ status: 401 }
);
}

const { error } = await supabase
.from("garden_entries")
.delete()
.eq("user_id", userId);

if (error) {
return NextResponse.json(
{ error: error.message },
{ status: 500 }
);
}

return NextResponse.json({
success: true,
});
}
