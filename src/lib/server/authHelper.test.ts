import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyServerAuth } from "./authHelper";

describe("authHelper Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Missing Authorization header returns authenticated: false with error", async () => {
    const req = { headers: {} };
    const res = await verifyServerAuth(req);
    expect(res.authenticated).toBe(false);
    expect(res.error).toBe("Missing authorization header");
  });

  it("2. Invalid Authorization format returns authenticated: false", async () => {
    const req = { headers: { authorization: "Basic 12345" } };
    const res = await verifyServerAuth(req);
    expect(res.authenticated).toBe(false);
  });

  it("3. Empty Bearer token returns authenticated: false", async () => {
    const req = { headers: { authorization: "Bearer " } };
    const res = await verifyServerAuth(req);
    expect(res.authenticated).toBe(false);
    expect(res.error).toBe("Missing bearer token");
  });
});
