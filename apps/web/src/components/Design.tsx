import { useState, useEffect } from "react";

const API = import.meta.env.PUBLIC_API_URL || "https://api.jiezi.ai";

export default function Design() {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/design`)
      .then((r) => r.json())
      .then((data) => setContent(data.content || null))
      .catch(() => {});
  }, []);

  if (!content) return null;

  const blocks = parseContent(content);

  return (
    <section className="mb-24">
      <div className="mb-8">
        <h2 className="text-xl font-bold font-serif">为什么这样设计</h2>
      </div>

      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <h3 key={i} className="text-base font-bold mt-8 mb-3 first:mt-0">
              {block.text}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="space-y-2 mb-4">
              {block.items!.map((item, j) => (
                <li key={j} className="flex gap-2 text-sm text-ink-muted">
                  <span className="text-vermillion flex-shrink-0">·</span>
                  <span dangerouslySetInnerHTML={{ __html: linkify(item) }} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={i}
            className="text-sm text-ink leading-relaxed mb-4"
            dangerouslySetInnerHTML={{ __html: linkify(block.text!) }}
          />
        );
      })}
    </section>
  );
}

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function parseContent(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: [...listItems] });
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      flushList();
      blocks.push({ type: "heading", text: trimmed.replace(/\*\*/g, "") });
    } else if (trimmed.startsWith("- **")) {
      listItems.push(trimmed.slice(2));
    } else if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
    } else {
      flushList();
      blocks.push({ type: "paragraph", text: trimmed });
    }
  }

  flushList();
  return blocks;
}

function linkify(text: string): string {
  return text
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener" class="text-vermillion hover:underline">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
