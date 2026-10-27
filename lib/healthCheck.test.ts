import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkDatabase } from "./healthCheck";

function clientReturning(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("checkDatabase", () => {
  it("is ok when health_check() returns true", async () => {
    const { client, rpc } = clientReturning({ data: true, error: null });
    await expect(checkDatabase(client)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("health_check");
  });

  it("is not ok on a database error, without leaking its message", async () => {
    const { client } = clientReturning({
      data: null,
      error: { message: "secret detail" },
    });
    const result = await checkDatabase(client);
    expect(result).toEqual({ ok: false });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("is not ok when the function returns something unexpected", async () => {
    const { client } = clientReturning({ data: null, error: null });
    await expect(checkDatabase(client)).resolves.toEqual({ ok: false });
  });
});
