import { supabase, isSupabaseConfigured } from "./supabaseClient";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  created_at?: string;
}

export interface AuthResponse {
  message: string;
  user: UserProfile;
}

const LOCAL_DEMO_KEY = "stock_analyzer_demo_user";

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch {}
  },
};

export function extractUserProfile(authUser: any): UserProfile | null {
  if (!authUser || authUser.is_anonymous || !authUser.email) {
    return null;
  }

  const metadata = authUser.user_metadata || {};
  const name =
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    authUser.email.split("@")[0] ||
    "Investor";

  return {
    id: authUser.id,
    name: name.trim(),
    email: authUser.email.trim().toLowerCase(),
    created_at: authUser.created_at,
  };
}

class AuthService {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!isSupabaseConfigured) {
      // Local fallback mode when Supabase credentials are not configured in .env.local
      const user: UserProfile = {
        id: "local-" + Date.now(),
        name: cleanName,
        email: cleanEmail,
        created_at: new Date().toISOString(),
      };
      safeStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify(user));
      return { message: "Registered successfully (Local mode)", user };
    }

    // Check if there is an active anonymous session to convert/link
    const { data: sessionData } = await supabase.auth.getSession();
    const currentSession = sessionData?.session;
    const isAnonymousUser = Boolean(
      currentSession?.user &&
        (currentSession.user.is_anonymous || !currentSession.user.email)
    );

    let resUser: any = null;

    if (isAnonymousUser) {
      try {
        const { data, error } = await supabase.auth.updateUser({
          email: cleanEmail,
          password,
          data: { name: cleanName },
        });

        if (!error && data?.user) {
          resUser = data.user;
        }
      } catch {
        // Fall through to clean standard sign up
      }
    }

    if (!resUser) {
      // Clear any anonymous or stale session locally so Supabase Auth does not reject signup with 422
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Ignore signOut error
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { name: cleanName } },
      });

      if (error) throw new Error(error.message);
      resUser = data.user;
    }

    if (!resUser) {
      throw new Error("Registration failed. Please try again.");
    }

    const user = extractUserProfile(resUser) || {
      id: resUser.id,
      name: cleanName,
      email: cleanEmail,
      created_at: resUser.created_at,
    };

    return { message: "Registered successfully", user };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    if (!isSupabaseConfigured) {
      // Local fallback mode
      const stored = safeStorage.getItem(LOCAL_DEMO_KEY);
      let user: UserProfile;
      if (stored) {
        user = JSON.parse(stored);
        user.email = email.trim().toLowerCase();
      } else {
        user = {
          id: "demo-user-123",
          name: email.split("@")[0] || "Demo Investor",
          email: email.trim().toLowerCase(),
          created_at: new Date().toISOString(),
        };
      }
      safeStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify(user));
      return { message: "Logged in successfully (Local mode)", user };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Login failed. Invalid credentials.");
    }

    const user = extractUserProfile(data.user) || {
      id: data.user.id,
      name: data.user.email?.split("@")[0] || "Investor",
      email: data.user.email || email,
      created_at: data.user.created_at,
    };

    return { message: "Logged in successfully", user };
  }

  /**
   * Initiates Supabase Google OAuth ("Continue with Google") flow
   */
  async loginWithGoogle(redirectTo?: string): Promise<{ data: any; error: any }> {
    if (!isSupabaseConfigured) {
      // Local fallback mode when Supabase is not configured
      const user: UserProfile = {
        id: "local-google-" + Date.now(),
        name: "Google Demo User",
        email: "google.user@example.com",
        created_at: new Date().toISOString(),
      };
      safeStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify(user));
      return { data: { user, session: null }, error: null };
    }

    const targetRedirect =
      redirectTo ||
      (typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : undefined);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: targetRedirect,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    return { data, error };
  }

  /**
   * Subscribes to Supabase Auth state changes (OAuth redirects, token refreshes, sign in/out)
   */
  onAuthStateChange(callback: (event: string, session: any, user: UserProfile | null) => void) {
    if (!isSupabaseConfigured) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }

    return supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ? extractUserProfile(session.user) : null;
      callback(event, session, user);
    });
  }

  async getMe(): Promise<UserProfile | null> {
    if (!isSupabaseConfigured) {
      const stored = safeStorage.getItem(LOCAL_DEMO_KEY);
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch (err) {
        return null;
      }
    }

    try {
      const { data } = await supabase.auth.getUser();
      if (!data || !data.user) return null;
      return extractUserProfile(data.user);
    } catch (err) {
      return null;
    }
  }

  async logout(): Promise<void> {
    if (!isSupabaseConfigured) {
      safeStorage.removeItem(LOCAL_DEMO_KEY);
      return;
    }

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase sign out warning:", err);
    }
  }
}

export const authService = new AuthService();
