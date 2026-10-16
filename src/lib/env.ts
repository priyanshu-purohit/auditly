/**
 * Server-side environment settings.
 *
 * These are read inside functions rather than at the top of the file, so that
 * nothing touches process.env while Next.js is prerendering.
 *
 * This file must never be imported by a Client Component — it would leak the
 * keys into the browser bundle.
 */

/** Current ElevenLabs transcription model. scribe_v1 is deprecated. */
const DEFAULT_STT_MODEL = "scribe_v2";

export function elevenLabsApiKey(): string {
  return (process.env.ELEVENLABS_API_KEY ?? "").trim();
}

export function elevenLabsSttModel(): string {
  const value = (process.env.ELEVENLABS_STT_MODEL ?? "").trim();
  return value === "" ? DEFAULT_STT_MODEL : value;
}

/** Empty string means "let ElevenLabs auto-detect the language". */
export function elevenLabsLanguageCode(): string {
  return (process.env.ELEVENLABS_LANGUAGE_CODE ?? "").trim();
}

/**
 * Should we skip ElevenLabs and return a saved transcript instead?
 *
 * Defaults to YES. Spending credits has to be switched on deliberately, by
 * setting AUDITLY_MOCK_VOICE=false *and* providing a key. The free plan only
 * has 10,000 credits a month, so an accidental loop could wipe it out.
 */
export function shouldMockVoice(): boolean {
  const optedOut = (process.env.AUDITLY_MOCK_VOICE ?? "").trim().toLowerCase() === "false";
  if (!optedOut) return true;
  return elevenLabsApiKey() === "";
}

/** Why mocking is on, for a clear message in the UI and the server log. */
export function mockReason(): string | null {
  if (!shouldMockVoice()) return null;
  if (elevenLabsApiKey() === "") {
    return "ELEVENLABS_API_KEY is empty in .env.local";
  }
  return "AUDITLY_MOCK_VOICE is not set to false in .env.local";
}

// ---------------------------------------------------------------------------
// Groq — turns a transcript into records
// ---------------------------------------------------------------------------

/**
 * Default extraction model.
 *
 * Checked against this account's /v1/models on 16 Oct 2026: it has
 * openai/gpt-oss-120b, openai/gpt-oss-20b and qwen/qwen3.8-27b — no Llama.
 * If Hinglish results are weak, try qwen/qwen3.8-27b via GROQ_MODEL.
 */
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

export function groqApiKey(): string {
  return (process.env.GROQ_API_KEY ?? "").trim();
}

export function groqModel(): string {
  const value = (process.env.GROQ_MODEL ?? "").trim();
  return value === "" ? DEFAULT_GROQ_MODEL : value;
}

/** No key means no call — the Review screen falls back to manual entry. */
export function canExtract(): boolean {
  return groqApiKey() !== "";
}
