import { createClient, SupabaseClient } from "@supabase/supabase-js";

if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as any).WebSocket = class DummyWebSocket {
    addEventListener() {}
    removeEventListener() {}
    close() {}
    send() {}
  };
}

let serverSupabase: SupabaseClient | null = null;

function getServerSupabase(): SupabaseClient | null {
  if (serverSupabase) return serverSupabase;

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (url && key && url.startsWith("http") && !url.includes("placeholder")) {
    serverSupabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return serverSupabase;
  }

  return null;
}

export interface ServerAuthResult {
  authenticated: boolean;
  isAnonymous?: boolean;
  user?: any;
  error?: string;
}

/**
 * Validates Supabase session token from the Authorization header
 */
export async function verifyServerAuth(req: any): Promise<ServerAuthResult> {
  const supabase = getServerSupabase();

  // If Supabase is not configured on the server, allow local dev / demo mode
  if (!supabase) {
    return { authenticated: true, isAnonymous: true };
  }

  const authHeader =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    (typeof req.getHeader === "function" ? req.getHeader("authorization") : undefined);

  if (!authHeader || typeof authHeader !== "string") {
    return { authenticated: false, isAnonymous: true, error: "Missing authorization header" };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { authenticated: false, isAnonymous: true, error: "Missing bearer token" };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return { authenticated: false, error: error?.message || "Invalid or expired session" };
    }

    const isAnonymous = Boolean(data.user.is_anonymous);
    return {
      authenticated: true,
      isAnonymous,
      user: data.user,
    };
  } catch (err: any) {
    return { authenticated: false, error: err?.message || "Authentication verification failed" };
  }
}
