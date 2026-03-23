import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const heartbeat = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: Date.now(),
        status: "online",
      });
    } else {
      await ctx.db.insert("devices", {
        deviceId: args.deviceId,
        status: "online",
        lastSeen: Date.now(),
      });
    }
  },
});

export const getOnlineDevices = query({
  args: {},
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").collect();
    const twoMinAgo = Date.now() - 120_000;
    return devices.filter((d) => d.lastSeen > twoMinAgo);
  },
});
