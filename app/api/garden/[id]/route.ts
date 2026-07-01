// app/api/garden/[id]/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUser } from "@/lib/api-auth";

export async function DELETE(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { userId, error: authError } = await requireUser();
  if (authError) return authError;

  const { id } = await context.params;

  const { error } = await supabase
    .from("garden_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}