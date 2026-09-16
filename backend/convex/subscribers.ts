import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const add = internalMutation({
  args: { email: v.string(), source: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("subscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing !== null) {
      return { status: "already_subscribed" };
    }
    await ctx.db.insert("subscribers", { email, source: args.source });
    await ctx.scheduler.runAfter(0, internal.kit.forward, { email });
    return { status: "subscribed" };
  },
});

export const remove = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("subscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing !== null) {
      await ctx.db.delete(existing._id);
      return { status: "removed" };
    }
    return { status: "not_found" };
  },
});

// Internal so the public deployment URL can't be used to read the list.
// View emails via the Convex dashboard or: npx convex run subscribers:list
export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("subscribers").order("desc").collect();
  },
});
