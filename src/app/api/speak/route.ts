import { connection } from "next/server";

import { isDatabaseConfigured } from "@/lib/db";
import {
  elevenLabsApiKey,
  elevenLabsTtsModel,
  elevenLabsVoiceId,
  shouldMockSpeech,
  speechMockReason,
} from "@/lib/env";
import { getToday } from "@/lib/shop-data";
import { buildDailySummarySpeech } from "@/lib/speech-text";
import { summariseDay, summariseStockMovement } from "@/lib/summary";
import type { SpeakResponse } from "@/lib/types";

/**
 * Reads today's figures out loud.
 *
 * The sentence is composed on the server from the database — the client does
 * NOT get to send arbitrary text. That matters: speaking costs about a credit
 * per character, and an endpoint that will voice anything you post to it is a
 * free way for someone to drain the month's quota.
 */
function fail(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST() {
  if (!isDatabaseConfigured()) {
    return fail(503, "Database set nahi hai.");
  }

  await connection();

  let text: string;
  try {
    const data = await getToday(new Date());
    const summary = summariseDay(data.transactions);
    const stockMoves = summariseStockMovement(
      data.transactions,
      data.products.map((product) => ({
        id: product.id,
        shopId: "",
        name: product.name,
        unit: product.unit,
        openingStock: product.openingStock,
        createdAt: "",
      })),
    );
    text = buildDailySummarySpeech(summary, stockMoves);
  } catch (cause) {
    console.error("[speak] could not read today:", cause);
    return fail(502, "Hisaab padha nahi ja saka.");
  }

  // --- the free path: hand the text back, the browser speaks it ------------
  if (shouldMockSpeech()) {
    console.log(`[speak] browser voice — ${speechMockReason()}`);
    const body: SpeakResponse = { text, audioBase64: null, source: "browser" };
    return Response.json(body);
  }

  // --- the paid path: this costs about one credit per character -----------
  const voiceId = encodeURIComponent(elevenLabsVoiceId());
  let upstream: Response;
  try {
    upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: elevenLabsTtsModel(),
        output_format: "mp3_44100_128",
      }),
    });
  } catch {
    return fail(502, "ElevenLabs tak pahunch nahi paye.");
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`[speak] ElevenLabs ${upstream.status}: ${detail.slice(0, 600)}`);

    // These three are the ones that actually happen, so name them clearly.
    if (upstream.status === 401) {
      return fail(502, "ElevenLabs key ko text-to-speech ki permission nahi hai.");
    }
    if (upstream.status === 402) {
      return fail(
        502,
        "Yeh voice free plan par API se nahi chalti. Apne account ki khud ki voice ka ID daalein.",
      );
    }
    if (upstream.status === 422) {
      return fail(502, "Voice ID ya model galat hai.");
    }
    if (upstream.status === 429) {
      return fail(502, "ElevenLabs credits khatam ya limit lag gayi.");
    }
    return fail(502, "Awaaz bani nahi.");
  }

  const audio = await upstream.arrayBuffer();
  if (audio.byteLength === 0) {
    return fail(502, "Khali awaaz mili.");
  }

  const body: SpeakResponse = {
    text,
    audioBase64: Buffer.from(audio).toString("base64"),
    source: "elevenlabs",
  };
  return Response.json(body);
}
