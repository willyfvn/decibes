import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  readings: defineTable({
    value: v.number(),
    raw_text: v.string(),
    image: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),

  recordings: defineTable({
    roomName: v.string(),
    storageId: v.optional(v.id("_storage")), // legacy, kept for old data
    s3Key: v.optional(v.string()),
    startedAt: v.number(),
    stoppedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    status: v.string(), // "recording" | "uploading" | "done" | "error"
    sessionId: v.optional(v.string()),
    segmentIndex: v.optional(v.number()),
  })
    .index("by_room", ["roomName"])
    .index("by_session", ["sessionId"]),

  devices: defineTable({
    deviceId: v.string(),
    status: v.string(), // "online" | "offline"
    lastSeen: v.number(),
  }).index("by_deviceId", ["deviceId"]),
});
