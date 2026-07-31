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
    if (!isSupabaseConfigured) {
      // Local fallback mode when Supabase credentials are not configured in .env.local
      const user: UserProfile = {
        id: "local-" + Date.now(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify(user));
      return { message: "Registered successfully (Local mode)", user };
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          name: name.trim(),
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Registration failed. Please try again.");
    }

    const user: UserProfile = {
      id: data.user.id,
      name: data.user.user_metadata?.name || name,
      email: data.user.email || email,
      created_at: data.user.created_at,
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
