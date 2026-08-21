import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { authService, extractUserProfile } from "./authService";
import { supabase } from "./supabaseClient";

describe("authService (Supabase Authentication & Google OAuth)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractUserProfile", () => {
    it("should return null for null/undefined user", () => {
      expect(extractUserProfile(null)).toBeNull();
      expect(extractUserProfile(undefined)).toBeNull();
    });

    it("should return null for anonymous user", () => {
      expect(
        extractUserProfile({
          id: "anon-123",
          is_anonymous: true,
          email: "",
        })
      ).toBeNull();
    });

    it("should return null for user with no email", () => {
      expect(
        extractUserProfile({
          id: "anon-456",
          is_anonymous: false,
          email: "",
        })
      ).toBeNull();
    });

    it("should extract full_name from Google OAuth user metadata", () => {
      const authUser = {
        id: "google-uid-123",
        email: "investor@gmail.com",
        created_at: "2026-08-20T12:00:00Z",
        user_metadata: {
          full_name: "Warren Buffett",
          avatar_url: "https://lh3.googleusercontent.com/a/abc",
        },
      };
      const profile = extractUserProfile(authUser);
      expect(profile).toEqual({
        id: "google-uid-123",
        name: "Warren Buffett",
        email: "investor@gmail.com",
        created_at: "2026-08-20T12:00:00Z",
      });
    });

    it("should fallback to metadata.name or email prefix if full_name is missing", () => {
      const authUserWithName = {
        id: "user-456",
        email: "charlie@berkshire.com",
        user_metadata: { name: "Charlie Munger" },
      };
      expect(extractUserProfile(authUserWithName)?.name).toBe("Charlie Munger");

      const authUserWithOnlyEmail = {
        id: "user-789",
        email: "benjamin.graham@value.com",
        user_metadata: {},
      };
      expect(extractUserProfile(authUserWithOnlyEmail)?.name).toBe("benjamin.graham");
    });
  });

  describe("loginWithGoogle", () => {
    it("should call supabase.auth.signInWithOAuth with google provider and default redirect", async () => {
      const signInSpy = vi.spyOn(supabase.auth, "signInWithOAuth").mockResolvedValue({
        data: { provider: "google", url: "https://accounts.google.com/o/oauth2/v2/auth..." },
        error: null,
      } as any);

      (globalThis as any).window = {
        location: {
          origin: "https://stock-analyzer-five-rouge.vercel.app",
          pathname: "/",
        },
      };

      try {
        const res = await authService.loginWithGoogle();

        expect(signInSpy).toHaveBeenCalledTimes(1);
        const callArg = signInSpy.mock.calls[0][0];
        expect(callArg.provider).toBe("google");
        expect(callArg.options?.redirectTo).toBe("https://stock-analyzer-five-rouge.vercel.app/");
        expect(callArg.options?.queryParams).toEqual({
          access_type: "offline",
          prompt: "consent",
        });
        expect(res.error).toBeNull();
        expect(res.data?.url).toBeDefined();
      } finally {
        delete (globalThis as any).window;
      }
    });

    it("should accept a custom redirect URL", async () => {
      const signInSpy = vi.spyOn(supabase.auth, "signInWithOAuth").mockResolvedValue({
        data: { provider: "google", url: "https://accounts.google.com" },
        error: null,
      } as any);

      await authService.loginWithGoogle("https://custom.app/callback");

      expect(signInSpy).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "https://custom.app/callback",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
    });

    it("should handle OAuth sign-in errors gracefully", async () => {
      vi.spyOn(supabase.auth, "signInWithOAuth").mockResolvedValue({
        data: { provider: "google", url: null },
        error: { message: "OAuth provider error", name: "AuthApiError", status: 400 } as any,
      });

      const res = await authService.loginWithGoogle();
      expect(res.error).toBeDefined();
      expect(res.error.message).toBe("OAuth provider error");
    });
  });

  describe("onAuthStateChange", () => {
    it("should subscribe to Supabase auth events and pass formatted UserProfile to callback", () => {
      let registeredCallback: any = null;
      vi.spyOn(supabase.auth, "onAuthStateChange").mockImplementation((cb: any) => {
        registeredCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } } as any;
      });

      const listener = vi.fn();
      authService.onAuthStateChange(listener);

      expect(registeredCallback).toBeDefined();

      // Simulate SIGNED_IN event with Google OAuth user
      const mockSession = {
        user: {
          id: "google-uid-888",
          email: "google.user@gmail.com",
          user_metadata: { full_name: "Google Investor" },
          created_at: "2026-08-20T10:00:00Z",
        },
      };

      registeredCallback("SIGNED_IN", mockSession);

      expect(listener).toHaveBeenCalledWith("SIGNED_IN", mockSession, {
        id: "google-uid-888",
        name: "Google Investor",
        email: "google.user@gmail.com",
        created_at: "2026-08-20T10:00:00Z",
      });
    });
  });

  describe("getMe", () => {
    it("should return null if supabase returns no active user", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      const me = await authService.getMe();
      expect(me).toBeNull();
    });

    it("should return UserProfile if user is authenticated", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
            user_metadata: { full_name: "Test User" },
            created_at: "2026-08-01T00:00:00Z",
          },
        },
        error: null,
      } as any);

      const me = await authService.getMe();
      expect(me).toEqual({
        id: "user-123",
        name: "Test User",
        email: "test@example.com",
        created_at: "2026-08-01T00:00:00Z",
      });
    });
  });

  describe("register", () => {
    it("should perform clean sign up when no session exists", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: { session: null },
        error: null,
      } as any);

      const signUpSpy = vi.spyOn(supabase.auth, "signUp").mockResolvedValue({
        data: {
          user: {
            id: "new-user-1",
            email: "newinvestor@example.com",
            created_at: "2026-08-21T12:00:00Z",
            user_metadata: { name: "New Investor" },
          },
          session: {} as any,
        },
        error: null,
      } as any);

      const res = await authService.register("New Investor", "newinvestor@example.com", "SecurePass123!");

      expect(signUpSpy).toHaveBeenCalledWith({
        email: "newinvestor@example.com",
        password: "SecurePass123!",
        options: { data: { name: "New Investor" } },
      });
      expect(res.user.email).toBe("newinvestor@example.com");
      expect(res.user.name).toBe("New Investor");
    });

    it("should clear local session and fallback to clean sign up if anonymous update fails", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: {
          session: {
            user: { id: "anon-old", is_anonymous: true, email: "" },
          } as any,
        },
        error: null,
      });

      vi.spyOn(supabase.auth, "updateUser").mockResolvedValue({
        data: { user: null },
        error: { message: "Anonymous provider not enabled", status: 422 } as any,
      });

      const signOutSpy = vi.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null } as any);
      const signUpSpy = vi.spyOn(supabase.auth, "signUp").mockResolvedValue({
        data: {
          user: {
            id: "registered-user-99",
            email: "fallback@example.com",
            created_at: "2026-08-21T12:00:00Z",
            user_metadata: { name: "Fallback User" },
          },
          session: {} as any,
        },
        error: null,
      } as any);

      const res = await authService.register("Fallback User", "fallback@example.com", "Pass123!");

      expect(signOutSpy).toHaveBeenCalled();
      expect(signUpSpy).toHaveBeenCalled();
      expect(res.user.id).toBe("registered-user-99");
    });
  });

  describe("logout", () => {
    it("should call supabase.auth.signOut", async () => {
      const signOutSpy = vi.spyOn(supabase.auth, "signOut").mockResolvedValue({
        error: null,
      } as any);

      await authService.logout();
      expect(signOutSpy).toHaveBeenCalledTimes(1);
    });
  });
});
