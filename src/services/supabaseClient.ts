import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Clean and sanitize input from import.meta.env
const sanitizeUrl = (url?: string): string => {
  if (!url) return "";
  let clean = url.trim().replace(/['"]/g, "");
  // Remove trailing slashes and common appended path suffixes
  clean = clean.replace(/\/+$/, "");
  clean = clean.replace(/\/auth\/v1$/i, "");
  clean = clean.replace(/\/rest\/v1$/i, "");
  return clean;
};

const sanitizeKey = (key?: string): string => {
  if (!key) return "";
  return key.trim().replace(/['"]/g, "");
};

// Check for VITE_ prefixed or non-prefixed env vars
const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || "";
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || "";

const supabaseUrl = sanitizeUrl(rawUrl);
const supabaseAnonKey = sanitizeKey(rawKey);

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("your-project") &&
    !supabaseAnonKey.includes("your_supabase_anon_key") &&
    supabaseUrl.startsWith("http")
);

// Fallback dummy URL to prevent createClient runtime crash if keys not configured yet
const dummyUrl = "https://placeholder-project.supabase.co";
const dummyKey = "placeholder-key";

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? supabaseUrl : dummyUrl,
  isSupabaseConfigured ? supabaseAnonKey : dummyKey
);
