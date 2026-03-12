import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const startRecording = mutation({
  args: {
    roomName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("recordings", {
      roomName: args.roomName,
      startedAt: Date.now(),
      status: "recording",
    });
  },
});

export const finishRecording = mutation({
  args: {
    recordingId: v.id("recordings"),
    s3Key: v.string(),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recordingId, {
      s3Key: args.s3Key,
      stoppedAt: Date.now(),
      durationMs: args.durationMs,
      status: "done",
    });
  },
});

export const failRecording = mutation({
  args: {
    recordingId: v.id("recordings"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recordingId, {
      stoppedAt: Date.now(),
      status: "error",
    });
  },
});

export const getActiveRecording = query({
  args: {
    roomName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recordings")
      .withIndex("by_room", (q) => q.eq("roomName", args.roomName))
      .filter((q) => q.eq(q.field("status"), "recording"))
      .first();
  },
});

export const getRecordings = query({
  args: {
    roomName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recordings")
      .withIndex("by_room", (q) => q.eq("roomName", args.roomName))
      .filter((q) => q.eq(q.field("status"), "done"))
      .order("desc")
      .take(20);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
