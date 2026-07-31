import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Securely hash client IP address with server-side secret using SHA-256.
 * Raw IP addresses are NEVER stored or passed to Postgres.
 */
async function hashIpAddress(ip: string, secret: string): Promise<string> {
  const textEncoder = new TextEncoder();
  const data = textEncoder.encode(`${ip}:${secret}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const ipSaltSecret = Deno.env.get("IP_SALT_SECRET") ?? "stock-analyzer-ip-salt-secret-2026";
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "LOGIN_REQUIRED",
          code: "UNAUTHORIZED",
          message: "Authentication required. Anonymous session must be initialized.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Securely extract client IP address
    const rawIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    // Hash client IP with server-side secret
    const ipHash = await hashIpAddress(rawIp, ipSaltSecret);

    // Initialize Supabase Client with caller's JWT context
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { ticker } = await req.json();

    if (!ticker || typeof ticker !== "string") {
      return new Response(
        JSON.stringify({ error: "BAD_REQUEST", message: "Stock ticker is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanTicker = ticker.trim().toUpperCase();

    // Execute atomic Postgres RPC for dual quota (max 2 per user) & IP abuse protection (max 10 per IP / 24h)
    const { data: quotaResult, error: rpcError } = await supabase.rpc(
      "check_and_increment_analysis_limit",
      {
        p_ticker: cleanTicker,
        p_ip_hash: ipHash,
        p_max_anonymous_limit: 2,
        p_max_ip_limit: 10,
        p_ip_window_hours: 24,
      }
    );

    if (rpcError) {
      console.error("Supabase RPC Error:", rpcError);
      return new Response(
        JSON.stringify({ error: "RPC_ERROR", message: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce quota or IP limit exceeded
    if (quotaResult?.status === "LIMIT_EXCEEDED" || quotaResult?.code === "LOGIN_REQUIRED") {
      return new Response(
        JSON.stringify({
          error: "LOGIN_REQUIRED",
          code: quotaResult.reason || "LIMIT_EXCEEDED",
          message: quotaResult.message || "You have reached your limit of free stock analyses. Please sign up or log in to continue.",
          count: quotaResult.count,
          limit: quotaResult.limit,
          ip_count: quotaResult.ip_count,
          ip_limit: quotaResult.ip_limit,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "SUCCESS",
        ticker: cleanTicker,
        quota: quotaResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "SERVER_ERROR", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
