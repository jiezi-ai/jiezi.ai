export interface ReviewResult {
  pass: boolean;
  github_id: string;
  school: string;
  major: string;
  grade: string;
  edu_email: string;
  motivation: string;
  reason: string;
}

const REVIEW_PROMPT = `你是解字计划的申请审核员。解字计划是一个大学生 AI 资助项目，为在校大学生提供免费的 AI Coding Plan。

请从以下申请信息中提取字段并做出审核判断。

## 提取字段
- github_id: GitHub 用户名
- school: 学校名称
- major: 专业
- grade: 年级
- edu_email: edu 邮箱（可能写成 "xxx at xxx.edu.cn" 的形式，请还原为正常邮箱格式）
- motivation: 想用 AI 做什么

## 审核标准
- pass: 信息基本完整（学校、edu 邮箱、动机都有填写）
- pass: 动机看起来是认真写的（哪怕只有一句话，但不是"不知道"、"随便"、乱码）
- pass: 学校名看起来是真实存在的学校
- reject: 信息严重缺失（没有学校或没有邮箱）
- reject: 明显是 bot 或垃圾内容
- reject: edu 邮箱格式明显不对（不是 .edu.cn 或其他教育机构域名）

## 注意
- 宽松审核，不要过度筛选。我们的目标是筛掉明显不认真的人，而不是筛掉零基础的人
- 非 CS 专业完全可以通过
- 动机不需要很宏大，"想试试用 AI 写论文"就足够了

请以 JSON 格式返回，不要有其他内容：
{
  "pass": true/false,
  "github_id": "提取的用户名",
  "school": "提取的学校",
  "major": "提取的专业",
  "grade": "提取的年级",
  "edu_email": "还原后的邮箱",
  "motivation": "提取的动机",
  "reason": "审核理由（一句话）"
}`;

export async function reviewApplication(
  apiKey: string,
  applicationInfo: string,
  githubUsername: string,
): Promise<ReviewResult> {
  const userMessage = `GitHub 用户: ${githubUsername}\n\n申请信息:\n${applicationInfo}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "system",
          content: REVIEW_PROMPT,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error: ${res.status} ${err}`);
  }

  const data: any = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM returned empty response");

  return JSON.parse(text) as ReviewResult;
}
