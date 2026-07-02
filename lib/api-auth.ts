import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

type RequireUserResult =
  { userId: string; error: null } | { userId: null; error: NextResponse };

/**
 * Centralizes the "is anyone signed in?" check that was previously
 * copy-pasted at the top of every route handler. Returns either the
 * authenticated userId, or a ready-to-return 401 NextResponse.
 *
 * Usage:
 *   const { userId, error } = await requireUser();
 *   if (error) return error;
 */
export async function requireUser(): Promise<RequireUserResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { userId, error: null };
}
