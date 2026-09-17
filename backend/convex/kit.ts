import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const KIT_API = "https://api.kit.com/v4";
const TAG_NAME = "domvibes";

// Signups from these sources also get enrolled in a Kit sequence.
// recharge-deck = the "get this deck via email" form on the stage deck.
const SEQUENCE_BY_SOURCE: Record<string, number> = {
  "recharge-deck": 2896769,
};

function headers(apiKey: string) {
  return {
    "X-Kit-Api-Key": apiKey,
    "Content-Type": "application/json",
  };
}

async function getOrCreateTagId(apiKey: string): Promise<number> {
  const res = await fetch(`${KIT_API}/tags?per_page=500`, {
    headers: headers(apiKey),
  });
  if (res.ok) {
    const data = await res.json();
    const existing = (data.tags ?? []).find(
      (t: { id: number; name: string }) =>
        t.name.toLowerCase() === TAG_NAME.toLowerCase(),
    );
    if (existing) return existing.id;
  }
  const created = await fetch(`${KIT_API}/tags`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ name: TAG_NAME }),
  });
  if (!created.ok) {
    throw new Error(`Kit create tag failed: ${created.status}`);
  }
  const data = await created.json();
  return data.tag.id;
}

async function pushToKit(apiKey: string, email: string, source?: string) {
  const sub = await fetch(`${KIT_API}/subscribers`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ email_address: email }),
  });
  // 200/201 = created or already exists; anything else is a real failure
  if (!sub.ok) {
    throw new Error(`Kit create subscriber failed: ${sub.status}`);
  }
  const tagId = await getOrCreateTagId(apiKey);
  const tagged = await fetch(`${KIT_API}/tags/${tagId}/subscribers`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ email_address: email }),
  });
  if (!tagged.ok) {
    throw new Error(`Kit tag subscriber failed: ${tagged.status}`);
  }
  const sequenceId = source ? SEQUENCE_BY_SOURCE[source] : undefined;
  if (sequenceId) {
    // 200 = already in the sequence, 201 = enrolled
    const enrolled = await fetch(
      `${KIT_API}/sequences/${sequenceId}/subscribers`,
      {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify({ email_address: email }),
      },
    );
    if (!enrolled.ok) {
      throw new Error(
        `Kit sequence ${sequenceId} enroll failed: ${enrolled.status}`,
      );
    }
  }
}

// Fire-and-forget from subscribers.add. No-op until KIT_API_KEY is set,
// so email capture keeps working even if Kit is down or unconfigured.
export const forward = internalAction({
  args: { email: v.string(), source: v.optional(v.string()) },
  handler: async (_ctx, args) => {
    const apiKey = process.env.KIT_API_KEY;
    if (!apiKey) return { status: "skipped_no_key" };
    await pushToKit(apiKey, args.email, args.source);
    return { status: "forwarded" };
  },
});

// One-time sync of everyone already in the Convex subscribers table:
// npx convex run kit:backfill --prod
export const backfill = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.KIT_API_KEY;
    if (!apiKey) throw new Error("Set KIT_API_KEY first");
    const subs = await ctx.runQuery(internal.subscribers.list, {});
    let ok = 0;
    const failed: string[] = [];
    for (const s of subs) {
      try {
        await pushToKit(apiKey, s.email, s.source);
        ok++;
      } catch {
        failed.push(s.email);
      }
    }
    return { forwarded: ok, failed };
  },
});
