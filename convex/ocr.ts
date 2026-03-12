"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import Anthropic from "@anthropic-ai/sdk";

export const readDisplay = action({
  args: {
    imageBase64: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY must be set");
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 32,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: args.imageBase64,
              },
            },
            {
              type: "text",
              text: "This image shows a seven-segment LCD decibel meter. What number is displayed? Reply with ONLY the number (e.g. 42.5). If unreadable, reply UNREADABLE.",
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "";

    if (text === "UNREADABLE") {
      return { value: null, raw_text: text };
    }

    const value = parseFloat(text);
    if (isNaN(value) || value < 20 || value > 150) {
      return { value: null, raw_text: text };
    }

    return { value, raw_text: text };
  },
});
