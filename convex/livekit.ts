"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { AccessToken } from "livekit-server-sdk";

export const generateToken = action({
  args: {
    roomName: v.string(),
    participantName: v.string(),
    canPublish: v.boolean(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set");
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: args.participantName,
      ttl: "6h",
    });
    token.addGrant({
      room: args.roomName,
      roomJoin: true,
      canPublish: args.canPublish,
      canSubscribe: true,
    });

    return await token.toJwt();
  },
});
