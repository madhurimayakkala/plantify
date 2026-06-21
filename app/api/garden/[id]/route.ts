import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(
req: Request,
context: {
params: Promise<{ id: string }>;
}
) {
const { userId } = await auth();

if (!userId) {
return NextResponse.json(
{ error: "Unauthorized" },
{ status: 401 }
);
}

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

return NextResponse.json({
success: true,
});
}
