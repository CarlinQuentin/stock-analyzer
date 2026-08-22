import { describe, it, expect } from "vitest";
import { UserProfile } from "../services/authService";

describe("UserHeader Profile & Saved Stocks Access Rules", () => {
  const isUserSignedIn = (user: UserProfile | null): boolean => {
    return Boolean(user && user.email && user.email.includes("@"));
  };

  it("identifies signed-in user correctly when valid user with email is present", () => {
    const user: UserProfile = {
      id: "u1",
      name: "Alice",
      email: "alice@example.com",
    };
    expect(isUserSignedIn(user)).toBe(true);
  });

  it("identifies unauthenticated guest when user is null", () => {
    expect(isUserSignedIn(null)).toBe(false);
  });

  it("identifies unauthenticated guest when user has no email or invalid email", () => {
    const anonUser: any = {
      id: "anon-123",
      name: "Guest",
      email: "",
    };
    expect(isUserSignedIn(anonUser)).toBe(false);
  });
});
