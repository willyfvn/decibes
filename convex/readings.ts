import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const addReading = mutation({
  args: {
    value: v.number(),
    raw_text: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("readings", {
      value: args.value,
      raw_text: args.raw_text,
      timestamp: args.timestamp,
    });
  },
});

export const getRecentReadings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("readings")
      .withIndex("by_timestamp")
      .order("desc")
      .take(15);
  },
});

export const getReadingsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { startTime, endTime } = args;
    let q = ctx.db
      .query("readings")
      .withIndex("by_timestamp", (idx) => {
        if (startTime !== undefined && endTime !== undefined) {
          return idx.gte("timestamp", startTime).lte("timestamp", endTime);
        } else if (startTime !== undefined) {
          return idx.gte("timestamp", startTime);
        } else if (endTime !== undefined) {
          return idx.lte("timestamp", endTime);
        }
        return idx;
      })
      .order("desc");
    return await q.paginate(args.paginationOpts);
  },
});
