import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  subscribers: defineTable({
    email: v.string(),
    source: v.string(),
  }).index("by_email", ["email"]),
  questions: defineTable({
    text: v.string(),
    source: v.string(),
  }),
  summaries: defineTable({
    text: v.string(),
    questionCount: v.number(),
    generatedAt: v.number(),
  }),
});
