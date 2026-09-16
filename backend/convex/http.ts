import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const ALLOWED_ORIGINS = [
  "https://domvibes.ai",
  "https://www.domvibes.ai",
  "https://domvibes.vercel.app",
  "http://localhost:8000",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

const preflight = httpAction(async (_ctx, req) => {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const http = httpRouter();

http.route({ path: "/subscribe", method: "OPTIONS", handler: preflight });

http.route({
  path: "/subscribe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let email = "";
    let source = "domvibes.vercel.app";
    try {
      const body = await req.json();
      email = typeof body.email === "string" ? body.email.trim() : "";
      if (typeof body.source === "string" && body.source.length < 200) {
        source = body.source;
      }
    } catch {
      return json(req, { error: "invalid JSON" }, 400);
    }
    if (!EMAIL_RE.test(email) || email.length > 320) {
      return json(req, { error: "invalid email" }, 400);
    }
    const result = await ctx.runMutation(internal.subscribers.add, {
      email,
      source,
    });
    return json(req, result);
  }),
});

http.route({ path: "/question", method: "OPTIONS", handler: preflight });

http.route({
  path: "/question",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let text = "";
    let source = "recharge";
    try {
      const body = await req.json();
      text = typeof body.text === "string" ? body.text.trim() : "";
      if (typeof body.source === "string" && body.source.length < 200) {
        source = body.source;
      }
    } catch {
      return json(req, { error: "invalid JSON" }, 400);
    }
    if (text.length < 3 || text.length > 500) {
      return json(req, { error: "question must be 3-500 characters" }, 400);
    }
    const result = await ctx.runMutation(internal.questions.add, {
      text,
      source,
    });
    return json(req, result);
  }),
});

http.route({ path: "/summary", method: "OPTIONS", handler: preflight });

// GET /summary returns the cached summary + live question count.
// GET /summary?refresh=1 regenerates via Claude, but only when new questions
// arrived since the last summary and the last one is >15s old.
http.route({
  path: "/summary",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const wantRefresh = url.searchParams.get("refresh") === "1";
    const questions = await ctx.runQuery(internal.questions.listAll, {});
    const cached = await ctx.runQuery(internal.questions.latestSummary, {});
    const stale =
      cached === null ||
      ((cached.text === "" || cached.questionCount !== questions.length) &&
        Date.now() - cached.generatedAt > 15_000);
    if (wantRefresh && stale && questions.length > 0) {
      try {
        const fresh = await ctx.runAction(internal.questions.summarize, {});
        return json(req, {
          summary: fresh.text,
          questionCount: questions.length,
          summarizedCount: fresh.questionCount,
        });
      } catch (e) {
        // fall through to cached so the slide never breaks mid-talk,
        // but leave a trace in convex logs so failures are debuggable
        console.error("summary refresh failed:", e);
      }
    }
    return json(req, {
      summary: cached?.text ?? "",
      questionCount: questions.length,
      summarizedCount: cached?.questionCount ?? 0,
    });
  }),
});

export default http;
