import { useState } from "react";

const API_BASE =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jieziai.cn";

interface ApplicationData {
  apply_code: string;
  status: string;
  school: string;
  major: string;
  grade: string;
  motivation: string;
  github_id: string | null;
  created_at: string;
  resend_count?: number;
}

const STATUS_LABELS: Record<string, { label: string; desc: string }> = {
  draft: {
    label: "待提交 Issue",
    desc: "请在 GitHub 提交包含申请码的 Issue",
  },
  rejected: {
    label: "需修改",
    desc: "申请信息需要修改，请更新后重新提交 Issue",
  },
  approved: {
    label: "审核通过",
    desc: "PR 已通过审核",
  },
  merged: {
    label: "PR 已合并",
    desc: "验证邮件即将发送",
  },
  emailed: {
    label: "待验证邮箱",
    desc: "验证邮件已发送到你的 edu 邮箱，请查收",
  },
  verified: {
    label: "已验证",
    desc: "AI 资源已发放到你的邮箱",
  },
  fulfilled: {
    label: "资源已发放",
    desc: "配置信息已发送到你的邮箱，开始你的 AI 之旅吧",
  },
};

export default function ApplyStatus({ code }: { code: string }) {
  const [email, setEmail] = useState("");
  const [data, setData] = useState<ApplicationData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    school: "",
    major: "",
    grade: "",
    motivation: "",
  });
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/apply/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edu_email: email }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "查询失败");
        setData(null);
      } else {
        setData(result);
        setEditForm({
          school: result.school || "",
          major: result.major || "",
          grade: result.grade || "",
          motivation: result.motivation || "",
        });
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/apply/${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edu_email: email, ...editForm }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "修改失败");
      } else {
        setEditing(false);
        // 重新查询最新数据
        const queryRes = await fetch(`${API_BASE}/api/apply/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ edu_email: email }),
        });
        const queryData = await queryRes.json();
        if (queryRes.ok) setData(queryData);
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <div>
        <div className="border-2 border-ink p-6 mb-6 text-center">
          <p className="font-mono text-sm text-ink-muted mb-1">申请码</p>
          <p className="text-3xl font-mono font-bold tracking-widest">{code}</p>
        </div>

        <form onSubmit={handleQuery} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              请输入你的 edu 邮箱验证身份
            </label>
            <input
              type="email"
              placeholder="zhangsan@pku.edu.cn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={!email.trim() || loading}
            className="w-full bg-ink text-white font-medium text-sm py-3 hover:bg-ink/90 transition-colors disabled:opacity-40"
          >
            {loading ? "查询中..." : "查看进度"}
          </button>

          {error && (
            <p className="text-sm text-vermillion text-center">{error}</p>
          )}
        </form>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[data.status] || {
    label: data.status,
    desc: "",
  };
  const canEdit = data.status === "draft" || data.status === "rejected";

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="border-2 border-ink p-6 text-center">
        <p className="font-mono text-sm text-ink-muted mb-1">申请码</p>
        <p className="text-3xl font-mono font-bold tracking-widest mb-4">
          {code}
        </p>
        <p className="text-lg font-bold">{statusInfo.label}</p>
        <p className="text-sm text-ink-muted mt-1">{statusInfo.desc}</p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {["draft", "merged", "emailed", "verified", "fulfilled"].map(
          (s, i) => {
            const steps = [
              "draft",
              "merged",
              "emailed",
              "verified",
              "fulfilled",
            ];
            const currentIdx = steps.indexOf(
              data.status === "rejected"
                ? "draft"
                : data.status === "approved"
                  ? "merged"
                  : data.status,
            );
            const active = i <= currentIdx;
            return (
              <div
                key={s}
                className={`flex-1 h-1.5 ${active ? "bg-vermillion" : "bg-ink/[0.08]"}`}
              />
            );
          },
        )}
      </div>

      {/* Application info */}
      {!editing ? (
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-ink-muted">学校</span>
            <span className="font-medium">{data.school}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-ink-muted">专业</span>
            <span className="font-medium">{data.major || "—"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-ink-muted">年级</span>
            <span className="font-medium">{data.grade || "—"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-ink-muted">GitHub</span>
            <span className="font-mono font-medium">
              {data.github_id ? `@${data.github_id}` : "待提交 Issue"}
            </span>
          </div>
          {data.motivation && (
            <div className="py-2">
              <p className="text-ink-muted mb-1">想用 AI 做什么</p>
              <p>{data.motivation}</p>
            </div>
          )}

          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="w-full mt-4 border border-ink text-sm py-2.5 hover:bg-ink/[0.04] transition-colors"
            >
              修改信息
            </button>
          )}

          {data.status === "fulfilled" && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs text-ink-muted mb-3">
                找不到配置邮件或忘记密码？可以重新发送到你的 edu 邮箱（密码会被重置）。
              </p>
              <button
                onClick={async () => {
                  setResending(true);
                  setResendMsg(null);
                  try {
                    const res = await fetch(`${API_BASE}/api/resend`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ apply_code: code, edu_email: email }),
                    });
                    const result = await res.json();
                    if (res.ok) {
                      setResendMsg({ type: "ok", text: result.message || "已发送" });
                      setData({ ...data, resend_count: result.resend_count });
                    } else {
                      setResendMsg({ type: "err", text: result.error || "发送失败" });
                    }
                  } catch {
                    setResendMsg({ type: "err", text: "网络错误" });
                  } finally {
                    setResending(false);
                  }
                }}
                disabled={resending || (data.resend_count ?? 0) >= 3}
                className="w-full border border-vermillion text-vermillion text-sm py-2.5 hover:bg-vermillion/[0.04] transition-colors disabled:opacity-40"
              >
                {resending
                  ? "发送中..."
                  : (data.resend_count ?? 0) >= 3
                    ? "已达最大重发次数"
                    : "重新发送账号信息到邮箱"}
              </button>
              <p className="text-xs text-ink-muted text-center mt-2">
                每天最多 1 次，累计最多 3 次（已用 {data.resend_count ?? 0} 次）
              </p>
              {resendMsg && (
                <p className={`text-sm text-center mt-2 ${resendMsg.type === "ok" ? "text-green-600" : "text-vermillion"}`}>
                  {resendMsg.text}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">学校</label>
            <input
              type="text"
              value={editForm.school}
              onChange={(e) =>
                setEditForm({ ...editForm, school: e.target.value })
              }
              className="w-full border border-border px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">专业</label>
              <input
                type="text"
                value={editForm.major}
                onChange={(e) =>
                  setEditForm({ ...editForm, major: e.target.value })
                }
                className="w-full border border-border px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">年级</label>
              <input
                type="text"
                value={editForm.grade}
                onChange={(e) =>
                  setEditForm({ ...editForm, grade: e.target.value })
                }
                className="w-full border border-border px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              想用 AI 做什么
            </label>
            <textarea
              value={editForm.motivation}
              onChange={(e) =>
                setEditForm({ ...editForm, motivation: e.target.value })
              }
              rows={3}
              className="w-full border border-border px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-vermillion text-white text-sm py-2.5 hover:bg-vermillion-hover transition-colors disabled:opacity-40"
            >
              {loading ? "保存中..." : "保存修改"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 border border-border text-sm py-2.5 hover:bg-ink/[0.04] transition-colors"
            >
              取消
            </button>
          </div>
          {error && (
            <p className="text-sm text-vermillion text-center">{error}</p>
          )}
        </form>
      )}
    </div>
  );
}
