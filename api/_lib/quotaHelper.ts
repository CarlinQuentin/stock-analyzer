import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AnalysisQuotaResult {
  allowed: boolean;
  statusCode?: number;
  code?: string;
  reason?: string;
  message?: string;
  count?: number;
  limit?: number | null;
  ipCount?: number;
  ipLimit?: number;
  isAnonymous?: boolean;
  alreadyAnalyzed?: boolean;
  error?: string;
  isMock?: boolean;
}

/**
 * Extract client public IP address from trusted server/proxy headers
 */
export function extractClientIp(req: any): string {
  if (!req || !req.headers) return "127.0.0.1";

  // 1. Standard Vercel / reverse proxy header (comma-separated list, first IP is client)
  const forwardedFor =
    req.headers["x-forwarded-for"] ||
    (typeof req.getHeader === "function" ? req.getHeader("x-forwarded-for") : undefined);

  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) {
      return sanitizeIp(firstIp);
    }
  }

  // 2. Direct real IP header
  const realIp =
    req.headers["x-real-ip"] ||
    (typeof req.getHeader === "function" ? req.getHeader("x-real-ip") : undefined);
  if (typeof realIp === "string" && realIp.trim().length > 0) {
    return sanitizeIp(realIp.trim());
  }

  // 3. Cloudflare connecting IP header
  const cfIp =
    req.headers["cf-connecting-ip"] ||
    (typeof req.getHeader === "function" ? req.getHeader("cf-connecting-ip") : undefined);
  if (typeof cfIp === "string" && cfIp.trim().length > 0) {
    return sanitizeIp(cfIp.trim());
  }

  // 4. Socket remote address
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (typeof socketIp === "string" && socketIp.trim().length > 0) {
    return sanitizeIp(socketIp.trim());
  }

  return "127.0.0.1";
}

function sanitizeIp(ip: string): string {
  // Strip IPv6-mapped IPv4 prefix (e.g. ::ffff:192.0.2.1)
  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }
  return ip;
}

/**
 * Standard pure JS SHA-256 implementation with zero external dependencies
 */
function sha256Hex(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = "";

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += "\x80";
  while ((ascii.length % 64) - 56) ascii += "\x00";
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return "";
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];

      const s0 =
        rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 =
        rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const s1h =
        rightRotate(hash[4], 6) ^
        rightRotate(hash[4], 11) ^
        rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = hash[7] + s1h + ch + k[i] + w[i];
      const s0h =
        rightRotate(hash[0], 2) ^
        rightRotate(hash[0], 13) ^
        rightRotate(hash[0], 22);
      const maj =
        (hash[0] & hash[1]) ^
        (hash[0] & hash[2]) ^
        (hash[1] & hash[2]);
      const temp2 = s0h + maj;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

/**
 * Deterministically hash client IP address using SHA-256 with a server-only salt.
 * Raw IP addresses are NEVER logged or stored in the database.
 */
export function hashClientIp(ip: string, saltOverride?: string): string {
  const salt =
    saltOverride ||
    process.env.IP_HASH_SALT ||
    process.env.IP_SALT_SECRET ||
    "stock-analyzer-quota-salt-2026";

  const cleanIp = (ip || "127.0.0.1").trim();
  return sha256Hex(`${cleanIp}:${salt}`);
}

let testClientOverride: SupabaseClient | null = null;

export function setTestSupabaseClient(client: SupabaseClient | null) {
  testClientOverride = client;
}

/**
 * Creates a scoped Supabase client with the caller's JWT token
 */
export function createScopedSupabaseClient(token?: string): SupabaseClient | null {
  if (testClientOverride) {
    return testClientOverride;
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (url && key && url.startsWith("http") && !url.includes("placeholder")) {
    return createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: token
        ? {
            headers: {
              Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
            },
          }
        : undefined,
    });
  }
  return null;
}

/**
 * Server-side quota helper: enforces anonymous quota (max 2) & IP abuse protection (max 10 / 24h)
 * Executes PostgreSQL RPC check_and_increment_analysis_limit passing p_ip_hash.
 */
export async function checkAnalysisQuota(
  req: any,
  ticker: string,
  options: {
    maxAnonymousLimit?: number;
    maxIpLimit?: number;
    ipWindowHours?: number;
  } = {}
): Promise<AnalysisQuotaResult> {
  const cleanTicker = (ticker || "").trim().toUpperCase();
  if (!cleanTicker) {
    return {
      allowed: false,
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Stock ticker is required for quota tracking.",
    };
  }

  const rawIp = extractClientIp(req);
  const ipHash = hashClientIp(rawIp);

  const authHeader =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    (typeof req.getHeader === "function" ? req.getHeader("authorization") : undefined);

  const token = typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "").trim() : undefined;

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  const isSupabaseConfigured = Boolean(
    url && key && url.startsWith("http") && !url.includes("placeholder")
  );

  // If Supabase is not configured (offline / demo / test environment), allow request
  if (!isSupabaseConfigured) {
    return { allowed: true, isMock: true };
  }

  // If no auth token provided at all when Supabase is configured
  if (!token) {
    return {
      allowed: false,
      statusCode: 401,
      code: "LOGIN_REQUIRED",
      reason: "UNAUTHORIZED",
      message: "Authentication required. Anonymous session must be initialized.",
    };
  }

  const supabase = createScopedSupabaseClient(token);
  if (!supabase) {
    return { allowed: true, isMock: true };
  }

  try {
    const { data: quotaData, error: rpcError } = await supabase.rpc(
      "check_and_increment_analysis_limit",
      {
        p_ticker: cleanTicker,
        p_ip_hash: ipHash,
        p_max_anonymous_limit: options.maxAnonymousLimit ?? 2,
        p_max_ip_limit: options.maxIpLimit ?? 10,
        p_ip_window_hours: options.ipWindowHours ?? 24,
      }
    );

    if (rpcError) {
      console.error("[Server Quota RPC Error]:", rpcError.message);
      // Security Requirement: Fail safely - never treat an RPC/database error as "quota allowed"
      return {
        allowed: false,
        statusCode: 500,
        error: "DATABASE_ERROR",
        code: "DATABASE_ERROR",
        message: "Failed to verify analysis quota. Please try again.",
      };
    }

    if (!quotaData) {
      return {
        allowed: false,
        statusCode: 500,
        error: "DATABASE_ERROR",
        code: "DATABASE_ERROR",
        message: "Invalid response from quota service.",
      };
    }

    // Quota or IP Limit Exceeded
    if (quotaData.status === "LIMIT_EXCEEDED" || quotaData.code === "LOGIN_REQUIRED") {
      return {
        allowed: false,
        statusCode: 429,
        code: quotaData.code || "LOGIN_REQUIRED",
        reason: quotaData.reason || "LIMIT_EXCEEDED",
        message:
          quotaData.message ||
          "You have reached your limit of free stock analyses. Please sign up or log in to continue.",
        count: quotaData.count,
        limit: quotaData.limit,
        ipCount: quotaData.ip_count,
        ipLimit: quotaData.ip_limit,
      };
    }

    // Quota Allowed
    return {
      allowed: true,
      isAnonymous: quotaData.is_anonymous,
      alreadyAnalyzed: quotaData.already_analyzed,
      count: quotaData.count,
      limit: quotaData.limit,
    };
  } catch (err: any) {
    console.error("[Server Quota Exception]:", err?.message || err);
    // Security Requirement: Fail safely on unexpected exception
    return {
      allowed: false,
      statusCode: 500,
      error: "SERVER_ERROR",
      code: "SERVER_ERROR",
      message: "An unexpected error occurred while verifying analysis quota.",
    };
  }
}
