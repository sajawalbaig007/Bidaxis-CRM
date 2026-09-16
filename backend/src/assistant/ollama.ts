const OLLAMA_BASE = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = (process.env.OLLAMA_MODEL ?? "qwen2.5").trim() || "qwen2.5";
const OLLAMA_TIMEOUT_MS = Math.min(
  20_000,
  Math.max(4_000, Number(process.env.OLLAMA_TIMEOUT_MS) || 12_000),
);

export async function ollamaSummarize(opts: {
  userMessage: string;
  toolResults: unknown;
}): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature: 0.1, num_predict: 280 },
        messages: [
          {
            role: "system",
            content:
              "You are Nexa, the CEO’s CRM AI. Answer ONLY the question that was asked. Do not greet. Do not add extra clients, extra stats, or extra advice. If they asked one number, reply with that number and stop. If they asked contact info, give email/phone only. Never invent numbers. Never merge different people. English, short lines. If tools found nothing, say so and stop. Use the CRM data JSON as the only source of truth.",
          },
          {
            role: "user",
            content: `Question:\n${opts.userMessage}\n\nCRM data:\n${JSON.stringify(opts.toolResults).slice(0, 12_000)}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    const text = String(data.message?.content ?? "").trim();
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
