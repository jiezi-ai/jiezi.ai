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

  async getPRFiles(prNumber: number): Promise<Array<{ filename: string; patch?: string; raw_url: string }>> {
    const res = await fetch(
      `${BASE}/repos/${this.owner}/${this.repo}/pulls/${prNumber}/files`,
      { headers: this.headers() },
    );
    if (!res.ok) return [];
    return res.json();
  }

  async getPRFileContent(rawUrl: string): Promise<string | null> {
    const res = await fetch(rawUrl, { headers: this.headers() });
    if (!res.ok) return null;
    return res.text();
  }

  async mergePR(prNumber: number, commitMessage: string): Promise<boolean> {
    const res = await fetch(
      `${BASE}/repos/${this.owner}/${this.repo}/pulls/${prNumber}/merge`,
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({
          commit_title: commitMessage,
          merge_method: "squash",
        }),
      },
    );
    return res.ok;
  }

  async commentPR(prNumber: number, body: string): Promise<boolean> {
    const res = await fetch(
      `${BASE}/repos/${this.owner}/${this.repo}/issues/${prNumber}/comments`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ body }),
      },
    );
    return res.ok;
  }

  async commentIssue(issueNumber: number, body: string): Promise<boolean> {
    const res = await fetch(
      `${BASE}/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ body }),
      },
    );
    return res.ok;
  }

  async addLabels(issueNumber: number, labels: string[]): Promise<boolean> {
    const res = await fetch(
      `${BASE}/repos/${this.owner}/${this.repo}/issues/${issueNumber}/labels`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ labels }),
      },
    );
    return res.ok;
  }

  async removeLabel(issueNumber: number, label: string): Promise<boolean> {
    const res = await fetch(
      `${BASE}/repos/${this.owner}/${this.repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`,
      {
        method: "DELETE",
        headers: this.headers(),
      },
    );
    return res.ok;
  }

  async closeIssue(issueNumber: number): Promise<boolean> {
    const res = await fetch(
      `${BASE}/repos/${this.owner}/${this.repo}/issues/${issueNumber}`,
      {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ state: "closed" }),
      },
    );
    return res.ok;
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
