// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useGuestMode, useIsGuestMode } from "./useGuestMode";
import { enableGuestMode, exitGuestMode } from "@/lib/guestStorage";

beforeEach(() => {
  window.localStorage.clear();
});

describe("useGuestMode", () => {
  it("is checked after hydration and not a guest by default", () => {
    const { result } = renderHook(() => useGuestMode());

    expect(result.current.guestChecked).toBe(true);
    expect(result.current.guest).toBe(false);
  });

  it("reads an existing guest flag", () => {
    enableGuestMode();
    const { result } = renderHook(() => useGuestMode());

    expect(result.current.guest).toBe(true);
  });

  it("continueAsGuest turns guest mode on", () => {
    const { result } = renderHook(() => useGuestMode());

    act(() => result.current.continueAsGuest());

    expect(result.current.guest).toBe(true);
    expect(window.localStorage.getItem("plantify_guest_mode")).toBe("true");
  });

  it("follows the flag when it is cleared elsewhere (e.g. after migration)", () => {
    enableGuestMode();
    const { result } = renderHook(() => useGuestMode());

    act(() => exitGuestMode());

    expect(result.current.guest).toBe(false);
  });

  it("stops treating the session as a guest once migration was handled, even if the flag is kept", () => {
    enableGuestMode();
    const { result } = renderHook(() => useGuestMode());

    act(() => result.current.markMigrationHandled());

    expect(result.current.guest).toBe(false);
    // A failed migration keeps the flag so a refresh can retry.
    expect(window.localStorage.getItem("plantify_guest_mode")).toBe("true");

    act(() => result.current.continueAsGuest());
    expect(result.current.guest).toBe(true);
  });
});

describe("useIsGuestMode", () => {
  it("updates when the flag changes in the same tab", () => {
    const { result } = renderHook(() => useIsGuestMode());
    expect(result.current).toBe(false);

    act(() => enableGuestMode());
    expect(result.current).toBe(true);

    act(() => exitGuestMode());
    expect(result.current).toBe(false);
  });
});
