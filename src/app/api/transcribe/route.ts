import {
  elevenLabsApiKey,
  elevenLabsLanguageCode,
  elevenLabsSttModel,
  mockReason,
  shouldMockVoice,
} from "@/lib/env";
import type { TranscribeResponse } from "@/lib/types";

const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

/**
 * Hard size cap. A 20-second Opus recording is well under 100 KB, so anything
 * above this is either a bug or an attempt to burn the month's credits in one
 * request (ElevenLabs charges 330 credits per minute of audio).
 */
const MAX_AUDIO_BYTES = 1_500_000;

/** Returned when mocking, so the voice flow can be built without spending credits. */
const MOCK_TRANSCRIPT =
  "Paanch kilo cheeni bechi do sau rupaye kilo, aur bijli ka bill bhara baarah sau rupaye";

function fail(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  // --- read and check the upload -------------------------------------------
  let audio: File;
  try {
    const form = await request.formData();
    const value = form.get("audio");
    if (!(value instanceof File)) {
      return fail(400, "Koi audio nahi mili. 'audio' field bhejein.");
    }
    audio = value;
  } catch {
    return fail(400, "Request padhi nahi ja saki.");
  }

  if (audio.size === 0) {
    return fail(400, "Recording khali hai. Dobara boliye.");
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return fail(413, "Recording bahut lambi hai. Chhoti recording bhejein.");
  }

  // --- the free path: no network call, no credits --------------------------
  if (shouldMockVoice()) {
    console.log(`[transcribe] mock mode — ${mockReason()}`);
    const body: TranscribeResponse = {
      transcript: MOCK_TRANSCRIPT,
      languageCode: "hi",
      mocked: true,
    };
    return Response.json(body);
  }

  // --- the paid path: this call costs credits ------------------------------
  const upstreamForm = new FormData();
  upstreamForm.append("model_id", elevenLabsSttModel());

  const languageCode = elevenLabsLanguageCode();
  if (languageCode !== "") {
    upstreamForm.append("language_code", languageCode);
  }

  // ElevenLabs picks the decoder from the filename extension, so keep one.
  upstreamForm.append("file", audio, audio.name === "" ? "voice.webm" : audio.name);

  let upstream: Response;
  try {
    upstream = await fetch(ELEVENLABS_STT_URL, {
      method: "POST",
      headers: { "xi-api-key": elevenLabsApiKey() },
      body: upstreamForm,
    });
  } catch {
    return fail(502, "ElevenLabs tak pahunch nahi paye. Internet check karein.");
  }

  if (!upstream.ok) {
    // Log the detail server-side; never send upstream text (or the key) to the browser.
    const detail = await upstream.text().catch(() => "");
    console.error(`[transcribe] ElevenLabs ${upstream.status}: ${detail.slice(0, 500)}`);

    if (upstream.status === 401) {
      return fail(502, "ElevenLabs key galat hai ya khatam ho gayi.");
    }
    if (upstream.status === 429) {
      return fail(502, "ElevenLabs credits khatam ya limit lag gayi.");
    }
    return fail(502, "ElevenLabs se transcript nahi mila.");
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return fail(502, "ElevenLabs ka jawab samajh nahi aaya.");
  }

  const transcript = readString(payload, "text");
  if (transcript === null || transcript.trim() === "") {
    return fail(502, "Kuch sunai nahi diya. Dobara boliye.");
  }

  const body: TranscribeResponse = {
    transcript: transcript.trim(),
    languageCode: readString(payload, "language_code"),
    mocked: false,
  };
  return Response.json(body);
}

/** Pulls one string field out of an unknown JSON object, safely. */
function readString(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : null;
}
