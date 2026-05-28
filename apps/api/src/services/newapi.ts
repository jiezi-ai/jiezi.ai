/**
 * New API client for leaderboard data.
 * Logs into New API admin, caches session and data.
 */

interface NewApiUser {
  id: number;
  username: string;
  email: string;
  display_name: string;
  quota: number;
  used_quota: number;
  request_count: number;
  status: number; // 1 = active, 2 = disabled
  role: number; // 100 = admin
}

interface RankingModel {
  rank: number;
  previous_rank: number;
  model_name: string;
  vendor: string;
  total_tokens: number;
  share: number;
  growth_pct: number;
}

interface RankingVendor {
  rank: number;
  vendor: string;
  total_tokens: number;
  share: number;
  growth_pct: number;
  models_count: number;
  top_model: string;
}

interface RankingsResponse {
  models: RankingModel[];
  vendors: RankingVendor[];
}

interface QuotaDataPoint {
  user_id: number;
  username: string;
  model_name: string;
  created_at: number; // unix timestamp
  token_used: number;
  count: number;
  quota: number;
}

export class NewApiClient {
  private baseUrl: string;
  private adminUser: string;
  private adminPass: string;
  private sessionCookie: string | null = null;
  private sessionExpiry = 0;

  constructor(baseUrl: string, adminUser: string, adminPass: string) {
    this.baseUrl = baseUrl;
    this.adminUser = adminUser;
    this.adminPass = adminPass;
  }

  private async login(): Promise<string> {
    // Reuse session if still valid (30 min TTL)
    if (this.sessionCookie && Date.now() < this.sessionExpiry) {
      return this.sessionCookie;
    }

    const res = await fetch(`${this.baseUrl}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.adminUser,
        password: this.adminPass,
      }),
    });

    const data = (await res.json()) as any;
    if (!data.success) throw new Error(`New API login failed: ${data.message}`);

    const cookie = res.headers.get("set-cookie")?.split(";")[0] || "";
    this.sessionCookie = cookie;
    this.sessionExpiry = Date.now() + 30 * 60 * 1000;
    return cookie;
  }

  private async request(path: string): Promise<any> {
    const cookie = await this.login();
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Cookie: cookie,
        "New-Api-User": "1",
        "Content-Type": "application/json",
      },
    });
    return res.json();
  }

  /**
   * Get all non-admin users with quota info.
   */
  async getUsers(): Promise<NewApiUser[]> {
    const data = await this.request("/api/user/?p=0&size=500");
    return ((data.data?.items as NewApiUser[]) || []).filter(
      (u) => u.role !== 100,
    );
  }

  /**
   * Get model/vendor rankings from New API built-in rankings endpoint.
   * period: today | week | month | year | all
   */
  async getRankings(
    period: string = "week",
  ): Promise<RankingsResponse | null> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/rankings?period=${period}`,
      );
      const data = (await res.json()) as any;
      if (!data.success) return null;
      return data.data as RankingsResponse;
    } catch {
      return null;
    }
  }

  /**
   * Get usage data grouped by user+time (hourly buckets).
   * Requires DataExportEnabled=true in New API config.
   */
  async getUserData(
    startTimestamp?: number,
    endTimestamp?: number,
  ): Promise<QuotaDataPoint[]> {
    try {
      let path = "/api/data/users?";
      if (startTimestamp) path += `start_timestamp=${startTimestamp}&`;
      if (endTimestamp) path += `end_timestamp=${endTimestamp}&`;
      const data = await this.request(path);
      if (!data.success) return [];
      return (data.data || []) as QuotaDataPoint[];
    } catch {
      return [];
    }
  }
}
