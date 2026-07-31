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
      localStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify(user));
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
      // Convert/link anonymous user to permanent account, preserving user.id & user_analyses records
      const { data, error } = await supabase.auth.updateUser({
        email: cleanEmail,
        password,
        data: { name: cleanName },
      });

      if (error) {
        // Fallback to standard signup if link fails
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name: cleanName } },
        });
        if (signUpErr) throw new Error(signUpErr.message);
        resUser = signUpData.user;
      } else {
        resUser = data.user;
      }
    } else {
      // Standard sign up
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

    const user: UserProfile = {
      id: resUser.id,
      name: resUser.user_metadata?.name || cleanName,
      email: resUser.email || cleanEmail,
      created_at: resUser.created_at,
    };

    return { message: "Registered successfully", user };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    if (!isSupabaseConfigured) {
      // Local fallback mode
      const stored = localStorage.getItem(LOCAL_DEMO_KEY);
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
      localStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify(user));
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

    const user: UserProfile = {
      id: data.user.id,
      name: data.user.user_metadata?.name || data.user.email?.split("@")[0] || "Investor",
      email: data.user.email || email,
      created_at: data.user.created_at,
    };

    return { message: "Logged in successfully", user };
  }

  async getMe(): Promise<UserProfile | null> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(LOCAL_DEMO_KEY);
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

      return {
        id: data.user.id,
        name: data.user.user_metadata?.name || data.user.email?.split("@")[0] || "Investor",
        email: data.user.email || "",
        created_at: data.user.created_at,
      };
    } catch (err) {
      return null;
    }
  }

  async logout(): Promise<void> {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(LOCAL_DEMO_KEY);
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
