import { useState, useEffect, useCallback, Fragment } from "react";

const API = import.meta.env.PUBLIC_API_URL || "https://api.jiezi.ai";

interface Application {
  id: number;
  apply_code: string;
  name: string;
  school: string;
  major: string;
  grade: string;
  edu_email: string;
  motivation: string;
  github_id: string | null;
  batch: number;
  status: string;
  verify_token: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  status: string;
  count: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "待提交",
  approved: "已通过",
  rejected: "已驳回",
  emailed: "已发邮件",
  verified: "已验证",
  fulfilled: "已发放",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-ink-muted/10 text-ink-muted",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  emailed: "bg-amber-100 text-amber-700",
  verified: "bg-emerald-100 text-emerald-700",
  fulfilled: "bg-emerald-200 text-emerald-800",
};

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem("admin_token") || "");
  const [authed, setAuthed] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Stats[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchData = useCallback(async (t: string, statusFilter?: string) => {
    setLoading(true);
    setError("");
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`${API}/api/admin/applications${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        setAuthed(false);
        setError("密码错误");
        localStorage.removeItem("admin_token");
        return;
      }
      const data = await res.json();
      setApplications(data.applications);
      setStats(data.stats);
      setAuthed(true);
      localStorage.setItem("admin_token", t);
    } catch {
      setError("请求失败，请检查网络");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchData(token);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(token);
  };

  const handleFilter = (status: string) => {
    setFilter(status);
    fetchData(token, status || undefined);
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-24">
        <h1 className="font-serif text-2xl font-bold mb-6">管理后台</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="管理密码"
            className="w-full px-4 py-3 border border-border rounded bg-white font-mono text-sm focus:outline-none focus:border-vermillion"
            autoFocus
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-ink text-paper font-medium rounded hover:opacity-90 transition-opacity"
          >
            登录
          </button>
        </form>
      </div>
    );
  }

  const total = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold">申请管理</h1>
        <button
          onClick={() => fetchData(token, filter || undefined)}
          className="text-sm text-ink-muted hover:text-ink font-mono"
        >
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => handleFilter("")}
          className={`px-3 py-1.5 rounded text-sm font-mono transition-colors ${
            filter === "" ? "bg-ink text-paper" : "bg-ink/5 text-ink-muted hover:bg-ink/10"
          }`}
        >
          全部 {total}
        </button>
        {stats.map((s) => (
          <button
            key={s.status}
            onClick={() => handleFilter(s.status)}
            className={`px-3 py-1.5 rounded text-sm font-mono transition-colors ${
              filter === s.status ? "bg-ink text-paper" : "bg-ink/5 text-ink-muted hover:bg-ink/10"
            }`}
          >
            {STATUS_LABELS[s.status] || s.status} {s.count}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-ink/[0.02]">
              <th className="text-left px-4 py-3 font-medium text-ink-muted">申请码</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">姓名</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">学校</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">专业</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">邮箱</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">GitHub</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">状态</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">时间</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <Fragment key={app.id}>
                <tr
                  className="border-b border-border last:border-0 hover:bg-ink/[0.02] cursor-pointer"
                  onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                >
                  <td className="px-4 py-3 font-mono text-vermillion">{app.apply_code}</td>
                  <td className="px-4 py-3">{app.name}</td>
                  <td className="px-4 py-3">{app.school}</td>
                  <td className="px-4 py-3 text-ink-muted">{app.major}</td>
                  <td className="px-4 py-3 font-mono text-xs">{app.edu_email}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {app.github_id ? (
                      <a
                        href={`https://github.com/${app.github_id}`}
                        target="_blank"
                        rel="noopener"
                        className="text-vermillion hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {app.github_id}
                      </a>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[app.status] || "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[app.status] || app.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted text-xs whitespace-nowrap">
                    {new Date(app.created_at + "Z").toLocaleDateString("zh-CN")}
                  </td>
                </tr>
                {expandedId === app.id && (
                  <tr className="bg-ink/[0.02]">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-ink-muted">年级：</span>
                          <span>{app.grade || "—"}</span>
                        </div>
                        <div>
                          <span className="text-ink-muted">想用 AI 做什么：</span>
                          <span>{app.motivation || "—"}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-ink-muted">
                  {loading ? "加载中..." : "暂无申请记录"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail on click - expand row with motivation */}
      {applications.length > 0 && (
        <p className="text-xs text-ink-muted mt-4 font-mono">
          共 {applications.length} 条记录
        </p>
      )}
    </div>
  );
}
