import { useState, useEffect } from "react";
import ApplyForm from "./ApplyForm";
import ApplyStatus from "./ApplyStatus";

export default function ApplyPage() {
  const [code, setCode] = useState<string | null>(null);
  const [lookupInput, setLookupInput] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code");
    if (c) setCode(c.toUpperCase());
  }, []);

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const c = lookupInput.trim().toUpperCase();
    if (c) {
      setCode(c);
      window.history.pushState({}, "", `/apply?code=${c}`);
    }
  }

  if (code) {
    return (
      <div>
        <button
          onClick={() => {
            setCode(null);
            window.history.pushState({}, "", "/apply");
          }}
          className="text-sm text-ink-muted hover:text-ink font-mono mb-8"
        >
          ← 新申请
        </button>
        <ApplyStatus code={code} />
      </div>
    );
  }

  return (
    <div>
      <section className="mb-8">
        <h1 className="text-3xl font-black tracking-tight mb-2">申请资助</h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          填写信息获取申请码，然后到 GitHub 提交 PR 完成申请。
          <br />
          你的个人信息不会出现在公开的 PR 中。
        </p>
      </section>

      <ApplyForm />

      <div className="mt-12 pt-8 border-t border-border">
        <p className="text-sm text-ink-muted mb-2">已有申请码？</p>
        <form onSubmit={handleLookup} className="flex gap-2">
          <input
            type="text"
            placeholder="JZ-XXXX"
            value={lookupInput}
            onChange={(e) => setLookupInput(e.target.value)}
            className="flex-1 border border-border px-3 py-2 text-sm font-mono uppercase bg-transparent focus:outline-none focus:border-ink"
          />
          <button
            type="submit"
            className="border border-ink px-4 py-2 text-sm hover:bg-ink/[0.04] transition-colors"
          >
            查看进度
          </button>
        </form>
      </div>
    </div>
  );
}
