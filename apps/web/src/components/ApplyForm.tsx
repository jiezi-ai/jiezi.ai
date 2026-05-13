import { useState } from "react";

const API_BASE =
  (import.meta as any).env?.PUBLIC_API_URL || "https://api.jiezi.ai";

type Step = "form" | "submitting" | "success" | "error" | "duplicate";

export default function ApplyForm() {
  const [step, setStep] = useState<Step>("form");
  const [applyCode, setApplyCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    school: "",
    major: "",
    grade: "",
    edu_email: "",
    motivation: "",
  });

  const canSubmit = form.school.trim() && form.edu_email.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStep("submitting");

    try {
      const res = await fetch(`${API_BASE}/api/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.status === 409) {
        setApplyCode(data.apply_code);
        setStep("duplicate");
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error || "提交失败");
        setStep("error");
        return;
      }

      setApplyCode(data.apply_code);
      setStep("success");
    } catch {
      setErrorMsg("网络错误，请稍后再试");
      setStep("error");
    }
  }

  if (step === "success") {
    return (
      <div className="border-2 border-ink p-8 text-center">
        <p className="font-mono text-sm text-ink-muted mb-2">你的申请码</p>
        <p className="text-4xl font-mono font-bold tracking-widest mb-6">
          {applyCode}
        </p>
        <div className="text-left text-sm space-y-4 max-w-md mx-auto">
          <p>
            <span className="font-mono text-vermillion font-bold">下一步</span>
            ：在 GitHub 提交 PR 完成申请。
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-ink-muted">
            <li>
              Fork{" "}
              <a
                href="https://github.com/jiezi-ai/grant"
                target="_blank"
                className="text-vermillion hover:text-vermillion-hover"
              >
                jiezi-ai/grant
              </a>
            </li>
            <li>
              在 <code className="text-xs bg-ink/[0.05] px-1">students/batch-1/</code>{" "}
              下创建 <code className="text-xs bg-ink/[0.05] px-1">你的用户名.md</code>
            </li>
            <li>
              文件内容只写一行：
              <code className="block mt-1 text-lg font-bold bg-ink/[0.05] px-3 py-2 text-center">
                {applyCode}
              </code>
            </li>
            <li>提交 PR</li>
          </ol>
          <p className="text-ink-muted">
            或者，直接告诉你的 code agent：
          </p>
          <code className="block bg-ink/[0.05] px-3 py-2 text-sm">
            我要申请 jiezi-ai/grant，我的申请码是 {applyCode}
          </code>
        </div>
        <div className="mt-8 pt-6 border-t border-border text-sm">
          <a
            href={`/apply/${applyCode}`}
            className="text-vermillion hover:text-vermillion-hover font-mono"
          >
            查看申请进度 →
          </a>
        </div>
      </div>
    );
  }

  if (step === "duplicate") {
    return (
      <div className="border-2 border-ink p-8 text-center">
        <p className="text-lg font-bold mb-2">该邮箱已有申请记录</p>
        <p className="text-sm text-ink-muted mb-4">
          你的申请码是{" "}
          <span className="font-mono font-bold">{applyCode}</span>
        </p>
        <a
          href={`/apply/${applyCode}`}
          className="inline-block bg-vermillion text-white font-medium text-sm px-6 py-3 hover:bg-vermillion-hover transition-colors"
        >
          查看申请进度
        </a>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="border-2 border-vermillion/30 p-8 text-center">
        <p className="text-lg font-bold mb-2">{errorMsg}</p>
        <button
          onClick={() => setStep("form")}
          className="mt-4 text-sm text-vermillion hover:text-vermillion-hover font-mono"
        >
          ← 返回修改
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">
          学校 <span className="text-vermillion">*</span>
        </label>
        <input
          type="text"
          placeholder="如：北京大学"
          value={form.school}
          onChange={(e) => setForm({ ...form, school: e.target.value })}
          className="w-full border border-border px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">专业</label>
          <input
            type="text"
            placeholder="如：计算机科学"
            value={form.major}
            onChange={(e) => setForm({ ...form, major: e.target.value })}
            className="w-full border border-border px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">年级</label>
          <input
            type="text"
            placeholder="如：大三"
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
            className="w-full border border-border px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          edu 邮箱 <span className="text-vermillion">*</span>
        </label>
        <input
          type="email"
          placeholder="如：zhangsan@pku.edu.cn"
          value={form.edu_email}
          onChange={(e) => setForm({ ...form, edu_email: e.target.value })}
          className="w-full border border-border px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink transition-colors"
        />
        <p className="text-xs text-ink-muted mt-1">
          用于验证学生身份和接收通知，不会公开显示
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          你想用 AI 做什么？
        </label>
        <textarea
          placeholder="一两句话就好。比如：我想用 AI 帮我自动化数据分析流程"
          value={form.motivation}
          onChange={(e) => setForm({ ...form, motivation: e.target.value })}
          rows={3}
          className="w-full border border-border px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:border-ink transition-colors resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit || step === "submitting"}
        className="w-full bg-vermillion text-white font-medium text-sm py-3 hover:bg-vermillion-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {step === "submitting" ? "提交中..." : "获取申请码"}
      </button>

      <p className="text-xs text-ink-muted text-center">
        提交后你将获得一个申请码，然后到 GitHub 提交 PR 完成申请。
        <br />
        个人信息只存储在我们的数据库中，不会出现在公开的 PR 里。
      </p>
    </form>
  );
}
