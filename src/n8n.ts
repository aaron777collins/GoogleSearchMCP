import fetch from "cross-fetch";
import type { WebhookPayload } from "./types.js";

const url = process.env.N8N_WEBHOOK_URL;

export async function postToN8n(payload: WebhookPayload) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("[n8n] webhook failed:", err);
  }
}
