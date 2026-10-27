// app/api/garden/[id]/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireUser } from "@/lib/api-auth";

export async function DELETE(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { userId, error: authError } = await requireUser();
  if (authError) return authError;

  // Acts as this user: RLS applies on top of the user_id filters below.
  const supabase = createServerSupabase();

  const { id } = await context.params;

  const { error } = await supabase
    .from("garden_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
