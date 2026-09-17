import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const add = internalMutation({
  args: { text: v.string(), source: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("questions", { text: args.text, source: args.source });
    const all = await ctx.db.query("questions").collect();
    return { status: "asked", count: all.length };
  },
});

// Wipe all questions + summaries (e.g. clear test data before going on stage):
// npx convex run questions:clear --prod
export const clear = internalMutation({
  args: {},
  handler: async (ctx) => {
    const qs = await ctx.db.query("questions").collect();
    const ss = await ctx.db.query("summaries").collect();
    for (const q of qs) await ctx.db.delete(q._id);
    for (const s of ss) await ctx.db.delete(s._id);
    return { deleted: qs.length + ss.length };
  },
});

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("questions").order("asc").collect();
  },
});

export const latestSummary = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("summaries").order("desc").first();
  },
});

export const saveSummary = internalMutation({
  args: { text: v.string(), questionCount: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.insert("summaries", {
      text: args.text,
      questionCount: args.questionCount,
      generatedAt: Date.now(),
    });
  },
});

// Regenerates the audience-question summary with Claude. Rate-limited by the
// caller in http.ts (only runs when the question count changed and the last
// summary is >15s old) so an open endpoint can't burn API credits.
export const summarize = internalAction({
  args: {},
  handler: async (ctx): Promise<{ text: string; questionCount: number }> => {
    const questions = await ctx.runQuery(internal.questions.listAll, {});
    if (questions.length === 0) {
      return { text: "", questionCount: 0 };
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set on this deployment");
    }
    const list = questions.map((q) => `- ${q.text}`).join("\n");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        system:
          "You summarize live audience questions for a presenter on stage at a Recharge x Shopify event about agentic coding workflows. Group similar questions into themes. Return 3-6 themes max, each on its own line formatted exactly as: THEME TITLE (n asked) :: one clear question the presenter can read aloud that covers the group. Order by how many questions each theme covers, most first. No intro, no outro, no markdown. If a question is spam or gibberish, ignore it. If there are only 1 or 2 real questions, output each as its own theme line in that same exact format instead of grouping. Always respond with theme lines only. Never comment on how many questions there are, never ask for more questions, never explain yourself.",
        messages: [
          {
            role: "user",
            content: `Audience questions so far:\n${list}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Claude API error ${response.status}: ${detail}`);
    }
    const data = await response.json();
    // pick the text block explicitly; content[0] isn't guaranteed to be text
    const textBlock = data.content?.find(
      (b: { type: string }) => b.type === "text",
    );
    const text: string = textBlock?.text ?? "";
    await ctx.runMutation(internal.questions.saveSummary, {
      text,
      questionCount: questions.length,
    });
    return { text, questionCount: questions.length };
  },
});
