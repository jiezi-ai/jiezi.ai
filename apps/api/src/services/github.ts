const BASE = "https://api.github.com";

export class GitHubClient {
  constructor(
    private owner: string,
    private repo: string,
    private token?: string,
  ) {}

  private headers(): HeadersInit {
    const h: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "jiezi-api",
    };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  async getFile(path: string): Promise<string | null> {
    const res = await fetch(
      `${BASE}/repos/${this.owner}/${this.repo}/contents/${path}`,
      {
        headers: {
          ...this.headers(),
          Accept: "application/vnd.github.v3.raw",
        },
      },
    );
    if (!res.ok) return null;
    return res.text();
  }

  async listDir(path: string): Promise<string[]> {
    const res = await fetch(
      `${BASE}/repos/${this.owner}/${this.repo}/contents/${path}`,
      { headers: this.headers() },
    );
    if (!res.ok) return [];
    const items: Array<{ name: string; type: string }> = await res.json();
    return items.filter((i) => i.type === "file").map((i) => i.name);
  }

  async countFilesInDir(path: string): Promise<number> {
    const files = await this.listDir(path);
    return files.length;
  }

  async listOrgRepos(): Promise<
    Array<{
      name: string;
      description: string | null;
      html_url: string;
      stargazers_count: number;
      owner: { login: string };
      language: string | null;
    }>
  > {
    const res = await fetch(`${BASE}/orgs/${this.owner}/repos?per_page=100`, {
      headers: this.headers(),
    });
    if (!res.ok) return [];
    return res.json();
  }
}
