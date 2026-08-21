import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractClientIp,
  hashClientIp,
  checkAnalysisQuota,
  setTestSupabaseClient,
} from "./quotaHelper";
import { stockAnalysisService } from "../../services/stockAnalysisService";

describe("Server-Side Analysis Quota Helper (quotaHelper.ts)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    setTestSupabaseClient(null);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    setTestSupabaseClient(null);
    process.env = { ...originalEnv };
  });

  describe("1. IP Extraction (extractClientIp)", () => {
    it("1.1 Extracts client IP from x-forwarded-for when multiple comma-separated IPs exist", () => {
      const req = {
        headers: {
          "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
        },
      };
      const ip = extractClientIp(req);
      expect(ip).toBe("203.0.113.195");
    });

    it("1.2 Extracts client IP from x-real-ip if x-forwarded-for is missing", () => {
      const req = {
        headers: {
          "x-real-ip": "198.51.100.42",
        },
      };
      const ip = extractClientIp(req);
      expect(ip).toBe("198.51.100.42");
    });

    it("1.3 Extracts client IP from cf-connecting-ip if others are missing", () => {
      const req = {
        headers: {
          "cf-connecting-ip": "198.51.100.88",
        },
      };
      const ip = extractClientIp(req);
      expect(ip).toBe("198.51.100.88");
    });

    it("1.4 Strips IPv6-mapped IPv4 prefix (::ffff:)", () => {
      const req = {
        headers: {
          "x-forwarded-for": "::ffff:192.0.2.1",
        },
      };
      const ip = extractClientIp(req);
      expect(ip).toBe("192.0.2.1");
    });

    it("1.5 Falls back safely to 127.0.0.1 when no IP headers are present", () => {
      const req = { headers: {} };
      const ip = extractClientIp(req);
      expect(ip).toBe("127.0.0.1");
    });
  });

  describe("2. IP Hashing (hashClientIp)", () => {
    it("2.1 Produces a valid 64-character SHA-256 hex string", () => {
      const hash = hashClientIp("203.0.113.195", "test-salt");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("2.2 Produces identical hash for the same IP and same salt", () => {
      const hash1 = hashClientIp("198.51.100.1", "my-secret-salt");
      const hash2 = hashClientIp("198.51.100.1", "my-secret-salt");
      expect(hash1).toBe(hash2);
    });

    it("2.3 Produces different hashes for different IPs with same salt", () => {
      const hashA = hashClientIp("198.51.100.1", "my-secret-salt");
      const hashB = hashClientIp("198.51.100.2", "my-secret-salt");
      expect(hashA).not.toBe(hashB);
    });

    it("2.4 Uses IP_HASH_SALT environment variable when provided", () => {
      process.env.IP_HASH_SALT = "custom-prod-salt-123";
      const hash1 = hashClientIp("198.51.100.1");
      delete process.env.IP_HASH_SALT;
      process.env.IP_HASH_SALT = "different-salt-456";
      const hash2 = hashClientIp("198.51.100.1");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("3. Quota Enforcement via checkAnalysisQuota", () => {
    it("3.1 Returns mock allowed when Supabase is not configured (offline / local dev mode)", async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.VITE_SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.VITE_SUPABASE_ANON_KEY;

      const req = { headers: {} };
      const result = await checkAnalysisQuota(req, "NVDA");

      expect(result.allowed).toBe(true);
      expect(result.isMock).toBe(true);
    });

    it("3.2 Rejects with 401 UNAUTHORIZED if Supabase is configured but no Authorization header exists", async () => {
      process.env.SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_ANON_KEY = "anon-key-123";

      const req = { headers: {} };
      const result = await checkAnalysisQuota(req, "AAPL");

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.code).toBe("LOGIN_REQUIRED");
      expect(result.reason).toBe("UNAUTHORIZED");
    });

    it("3.3 Calls check_and_increment_analysis_limit with non-null p_ip_hash and allows authenticated user", async () => {
      process.env.SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_ANON_KEY = "anon-key-123";

      let capturedRpcParams: any = null;
      const mockRpc = vi.fn().mockImplementation((_name: string, params: any) => {
        capturedRpcParams = params;
        return Promise.resolve({
          data: {
            status: "ALLOWED",
            is_anonymous: false,
            already_analyzed: false,
            count: 5,
            limit: null,
          },
          error: null,
        });
      });

      setTestSupabaseClient({
        rpc: mockRpc,
      } as any);

      const req = {
        headers: {
          authorization: "Bearer registered-user-jwt",
          "x-forwarded-for": "198.51.100.77",
        },
      };

      const result = await checkAnalysisQuota(req, "MSFT");

      expect(result.allowed).toBe(true);
      expect(result.isAnonymous).toBe(false);
      expect(mockRpc).toHaveBeenCalledWith(
        "check_and_increment_analysis_limit",
        expect.objectContaining({
          p_ticker: "MSFT",
          p_max_anonymous_limit: 2,
          p_max_ip_limit: 10,
          p_ip_window_hours: 24,
        })
      );
      expect(capturedRpcParams.p_ip_hash).toBeDefined();
      expect(capturedRpcParams.p_ip_hash).toHaveLength(64);
      expect(capturedRpcParams.p_ip_hash).not.toBeNull();
    });

    it("3.4 Allows anonymous user within quota and passes p_ip_hash", async () => {
      process.env.SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_ANON_KEY = "anon-key-123";

      let capturedParams: any = null;
      const mockRpc = vi.fn().mockImplementation((_name: string, params: any) => {
        capturedParams = params;
        return Promise.resolve({
          data: {
            status: "ALLOWED",
            is_anonymous: true,
            already_analyzed: false,
            count: 1,
            limit: 2,
          },
          error: null,
        });
      });

      setTestSupabaseClient({
        rpc: mockRpc,
      } as any);

      const req = {
        headers: {
          authorization: "Bearer anonymous-user-jwt",
          "x-real-ip": "203.0.113.50",
        },
      };

      const result = await checkAnalysisQuota(req, "GOOGL");

      expect(result.allowed).toBe(true);
      expect(result.isAnonymous).toBe(true);
      expect(result.count).toBe(1);
      expect(capturedParams.p_ip_hash).toBeDefined();
      expect(capturedParams.p_ip_hash).not.toBeNull();
    });

    it("3.5 Denies request with HTTP 429 when anonymous user limit is exceeded", async () => {
      process.env.SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_ANON_KEY = "anon-key-123";

      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          status: "LIMIT_EXCEEDED",
          code: "LOGIN_REQUIRED",
          reason: "USER_LIMIT_EXCEEDED",
          is_anonymous: true,
          count: 2,
          limit: 2,
          message: "You have reached your limit of 2 free anonymous stock analyses. Please sign up or log in to continue.",
        },
        error: null,
      });

      setTestSupabaseClient({
        rpc: mockRpc,
      } as any);

      const req = {
        headers: {
          authorization: "Bearer anonymous-user-jwt",
          "x-forwarded-for": "203.0.113.50",
        },
      };

      const result = await checkAnalysisQuota(req, "TSLA");

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(429);
      expect(result.code).toBe("LOGIN_REQUIRED");
      expect(result.reason).toBe("USER_LIMIT_EXCEEDED");
      expect(result.count).toBe(2);
      expect(result.limit).toBe(2);
    });

    it("3.6 Denies request with HTTP 429 when IP limit is exceeded (IP abuse protection)", async () => {
      process.env.SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_ANON_KEY = "anon-key-123";

      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          status: "LIMIT_EXCEEDED",
          code: "LOGIN_REQUIRED",
          reason: "IP_LIMIT_EXCEEDED",
          is_anonymous: true,
          count: 1,
          limit: 2,
          ip_count: 10,
          ip_limit: 10,
          message: "Analysis limit exceeded for your IP network in the last 24 hours. Please sign up or log in to continue.",
        },
        error: null,
      });

      setTestSupabaseClient({
        rpc: mockRpc,
      } as any);

      const req = {
        headers: {
          authorization: "Bearer anonymous-user-jwt",
          "x-forwarded-for": "203.0.113.50",
        },
      };

      const result = await checkAnalysisQuota(req, "AMZN");

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(429);
      expect(result.code).toBe("LOGIN_REQUIRED");
      expect(result.reason).toBe("IP_LIMIT_EXCEEDED");
      expect(result.ipCount).toBe(10);
      expect(result.ipLimit).toBe(10);
    });

    it("3.7 Fails safely on RPC database error (does NOT treat RPC errors as allowed)", async () => {
      process.env.SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_ANON_KEY = "anon-key-123";

      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "connection timeout" },
      });

      setTestSupabaseClient({
        rpc: mockRpc,
      } as any);

      const req = {
        headers: {
          authorization: "Bearer some-token",
          "x-forwarded-for": "203.0.113.50",
        },
      };

      const result = await checkAnalysisQuota(req, "NVDA");

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toBe("DATABASE_ERROR");
    });
  });

  describe("4. Verification of Client Isolation", () => {
    it("4.1 stockAnalysisService has no direct checkQuotaAndTrack client-side RPC calls", () => {
      expect((stockAnalysisService as any).checkQuotaAndTrack).toBeUndefined();
      expect(typeof stockAnalysisService.getStockAnalysisData).toBe("function");
    });
  });
});
