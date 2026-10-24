import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn<(...args: unknown[]) => unknown>(() => ({
  fake: "client",
}));
const authMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

import { createAnonSupabase, createServerSupabase } from "./supabase-server";

beforeEach(() => {
  createClientMock.mockClear();
  authMock.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
});

describe("createServerSupabase", () => {
  it("uses the anon key, never the service role key", () => {
    createServerSupabase();

    const [url, key] = createClientMock.mock.calls[0] as unknown as [
      string,
      string,
    ];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("anon-key");
    expect(key).not.toBe("service-role-key");
  });

  it("passes the current Clerk session token to Supabase", async () => {
    authMock.mockResolvedValue({ getToken: async () => "clerk-jwt" });
    createServerSupabase();

    const options = createClientMock.mock.calls[0][2] as unknown as {
      accessToken: () => Promise<string | null>;
    };
    await expect(options.accessToken()).resolves.toBe("clerk-jwt");
  });

  it("reads the token per request, not once at creation", async () => {
    authMock
      .mockResolvedValueOnce({ getToken: async () => "token-1" })
      .mockResolvedValueOnce({ getToken: async () => "token-2" });
    createServerSupabase();

    const options = createClientMock.mock.calls[0][2] as unknown as {
      accessToken: () => Promise<string | null>;
    };
    expect(await options.accessToken()).toBe("token-1");
    expect(await options.accessToken()).toBe("token-2");
  });

  it("returns null when nobody is signed in", async () => {
    authMock.mockResolvedValue({ getToken: async () => null });
    createServerSupabase();

    const options = createClientMock.mock.calls[0][2] as unknown as {
      accessToken: () => Promise<string | null>;
    };
    await expect(options.accessToken()).resolves.toBeNull();
  });

  it("throws a clear error when env vars are missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => createServerSupabase()).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/
    );
  });
});

describe("createAnonSupabase", () => {
  it("uses the anon key with no token getter and no stored session", () => {
    createAnonSupabase();

    const [, key, options] = createClientMock.mock.calls[0] as unknown as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(key).toBe("anon-key");
    expect(options.accessToken).toBeUndefined();
    expect(options.auth).toMatchObject({ persistSession: false });
  });
});
