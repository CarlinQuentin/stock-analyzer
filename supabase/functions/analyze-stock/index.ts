import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
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

    // Execute atomic Postgres RPC for quota enforcement
    const { data: quotaResult, error: rpcError } = await supabase.rpc(
      "check_and_increment_analysis_limit",
      { p_ticker: cleanTicker, p_max_anonymous_limit: 2 }
    );

    if (rpcError) {
      console.error("Supabase RPC Error:", rpcError);
      return new Response(
        JSON.stringify({ error: "RPC_ERROR", message: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce 2-analysis limit for anonymous users
    if (quotaResult?.status === "LIMIT_EXCEEDED" || quotaResult?.code === "LOGIN_REQUIRED") {
      return new Response(
        JSON.stringify({
          error: "LOGIN_REQUIRED",
          code: "LIMIT_EXCEEDED",
          message: quotaResult.message || "You have reached your limit of 2 free anonymous stock analyses. Please sign up or log in to continue.",
          count: quotaResult.count,
          limit: quotaResult.limit,
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
