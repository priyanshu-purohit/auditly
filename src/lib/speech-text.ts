import type { DaySummary } from "@/lib/summary";
import type { ProductUnit } from "@/lib/types";

/**
 * Writes the sentence the app says out loud.
 *
 * Written in Devanagari on purpose, even though the screen uses English
 * letters. Both ElevenLabs' multilingual model and the browser's hi-IN voice
 * pronounce "आज की बिक्री" as Hindi; given "Aaj ki bikri" they read it with an
 * English accent and it sounds wrong.
 *
 * Numerals are left as digits — the models read "1400" correctly in a Hindi
 * sentence, and spelling numbers out in words would be a lot of code for no
 * audible gain.
 */

/** Speaking costs about one credit per character, so keep it short. */
const MAX_SPEECH_CHARS = 300;

const UNIT_HINDI: Record<ProductUnit, string> = {
  kg: "किलो",
  litre: "लीटर",
  piece: "पीस",
  packet: "पैकेट",
};

export type StockMove = {
  productName: string;
  change: number;
  unit: ProductUnit;
};

function rupees(paise: number): number {
  return Math.round(Math.abs(paise) / 100);
}

export function buildDailySummarySpeech(
  summary: DaySummary,
  stockMoves: StockMove[],
): string {
  const parts: string[] = ["नमस्ते।"];

  if (summary.recordCount === 0) {
    parts.push("आज अभी कोई रिकॉर्ड नहीं है। कुछ बोलकर दर्ज करें।");
    return parts.join(" ");
  }

  parts.push(`आज की बिक्री ${rupees(summary.cashInPaise)} रुपये।`);
  parts.push(`खर्च ${rupees(summary.cashOutPaise)} रुपये।`);

  // Say plainly whether cash came in or went out, rather than a minus sign.
  const net = rupees(summary.netCashPaise);
  if (summary.netCashPaise < 0) {
    parts.push(`आज ${net} रुपये ज़्यादा खर्च हुए।`);
  } else {
    parts.push(`आज ${net} रुपये का कैश बचा।`);
  }

  // Only the two biggest stock movements — this is audio, not a report.
  const biggest = [...stockMoves]
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 2);

  for (const move of biggest) {
    const amount = Math.abs(move.change);
    const unit = UNIT_HINDI[move.unit];
    if (move.change < 0) {
      parts.push(`${move.productName} ${amount} ${unit} कम हुआ।`);
    } else {
      parts.push(`${move.productName} ${amount} ${unit} आया।`);
    }
  }

  const text = parts.join(" ");
  return text.length <= MAX_SPEECH_CHARS ? text : `${text.slice(0, MAX_SPEECH_CHARS - 1)}।`;
}
