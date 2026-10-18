# Auditly

**A shopkeeper speaks. Auditly keeps the books.**

Small shopkeepers in India keep their accounts in a paper khata, or not at all. Typing
every sale into an app is slower than the sale itself, and most shop software assumes
you read English comfortably. So the books don't get kept.

Auditly removes the typing. The shopkeeper says what happened, in Hindi or Hinglish,
and the day's records write themselves.

```
Shopkeeper: "paanch kilo cheeni bechi do sau rupaye kilo, aur bijli ka bill bhara baarah sau rupaye"

Auditly:    Bikri   Cheeni          5 kg    ₹1,000     ← 5 × 200, worked out
            Kharch  Bijli ka bill           ₹1,200
```

Then it reads the day back out loud:

> नमस्ते। आज की बिक्री 1400 रुपये। खर्च 1700 रुपये। आज 300 रुपये ज़्यादा खर्च हुए।

So the whole loop — in and out — is voice. A shopkeeper who reads slowly can still run
their books.

---

## How it works

```
   speak  ──▶  ElevenLabs Scribe  ──▶  Groq  ──▶  review & correct  ──▶  MongoDB
                  (speech → text)     (text →      (on screen,            (saved)
                                       records)     always editable)          │
                                                                              ▼
   listen ◀──  ElevenLabs TTS  ◀──────────────────────────  today's figures
```

The review step is deliberate. Voice recognition and AI extraction are both
occasionally wrong, and a ledger the shopkeeper cannot trust is worse than no ledger.
Nothing is ever saved without being shown first.

## What it does

- **Voice in, Hindi or Hinglish** — Devanagari (`पाँच किलो चीनी`), Latin
  (`paanch kilo cheeni`), or mixed. All three work.
- **Works out the maths** — "200 rupaye kilo" is a *rate*. For 5 kg it records ₹1,000,
  not ₹200.
- **Understands spoken numbers** — `dhai` → 2.5, `do sau` → 200, `baarah sau` → 1200.
- **Handles three kinds of records** — sales (bikri), stock purchases (kharid), and
  expenses (kharch). An expense has no product or quantity, and the form knows that.
- **Tracks stock** — sells 5 kg, buys 25 kg, shows `+18 kg`. Calculated from the
  records, never a stored counter that can drift.
- **Builds its own catalogue** — say "cheeni" and the product appears. Say it
  differently next week and it matches the same product instead of making a second one.
- **Keeps past days** — the History screen lists the last 30 days, with each day's
  takings and spending.
- **Never overwrites history** — correcting a past record adds a new one and marks the
  old one `corrected`, struck through next to its replacement. Day totals count the
  replacement only. A book you can secretly edit isn't a book.
- **Speaks the day back** — in Hindi, through ElevenLabs.
- **Says "cash", not "profit"** — the summary shows money in minus money out, and says
  plainly on screen that this is not profit, because the cost of goods sold isn't
  tracked yet. Calling it profit would mislead the person relying on it.
- **Types as a fallback** — every field is editable, so a noisy shop or a failed API
  call never blocks a record.

## Tech

| Layer | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router, Cache Components) |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4 |
| Database | MongoDB Atlas via Mongoose 9 |
| Speech → text | ElevenLabs Scribe v2 |
| Text → records | Groq, `openai/gpt-oss-120b` |
| Text → speech | ElevenLabs `eleven_multilingual_v2` |

Everything runs on free tiers. **Total cost to run this project: ₹0.**

---

## Quick start

### You will need

- Node.js 18 or newer
- A MongoDB Atlas account ([free tier](https://www.mongodb.com/cloud/atlas/register))
- An ElevenLabs API key ([free](https://elevenlabs.io)) — for voice in and out
- A Groq API key ([free, no card](https://console.groq.com)) — for extraction

### Install

```bash
git clone https://github.com/priyanshu-purohit/auditly.git
cd auditly
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in the four values. Every setting is documented in the file.

```bash
npm run dev
```

Open <http://localhost:3000>.

### Microphone note

Browsers only allow microphone access over HTTPS or on `localhost`.

- On this machine at `http://localhost:3000` — works.
- From your phone at `http://192.168.x.x:3000` — **the mic will be blocked.**

To test on a phone, let Next.js issue itself a certificate:

```bash
npm run dev -- --experimental-https
```

## Settings

| Variable | Required | What it does |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string |
| `MONGODB_DB` | no | Database name (default `auditly`) |
| `GROQ_API_KEY` | for extraction | Turns transcripts into records |
| `ELEVENLABS_API_KEY` | for voice | Speech in and out |
| `ELEVENLABS_VOICE_ID` | for speaking | Must be a **premade** voice (see below) |
| `AUDITLY_MOCK_VOICE` | — | `true` (default) never calls ElevenLabs for listening |
| `AUDITLY_MOCK_SPEECH` | — | `true` (default) uses the browser's voice, not ElevenLabs |
| `AUDITLY_SHOP_NAME` | no | Name shown at the top (default "Meri Dukaan") |

### Two safety switches

The ElevenLabs free plan gives 10,000 credits a month — roughly 30 minutes of
transcription, shared with speech. That is easy to burn through by accident in an
afternoon of development, so spending is **off by default**:

- `AUDITLY_MOCK_VOICE=true` returns a saved transcript instead of calling the API.
- `AUDITLY_MOCK_SPEECH=true` has the browser read the summary instead.

Both need an explicit `false` *and* a valid key before a single credit is spent. The
Review screen shows an amber **"Mock — koi credit kharch nahi"** badge so you always
know which you are hearing. Recordings also stop themselves after 20 seconds, and
`/api/speak` composes its own sentence from the database rather than voicing whatever
is posted to it.

### Picking a voice

Tested October 2026: the ElevenLabs free plan allows **premade** voices over the API
but refuses **library** voices with `HTTP 402`. Use a premade one:

| Voice ID | Voice |
|---|---|
| `JBFqnCBsd6RMkjVDRZzb` | George — warm storyteller |
| `nPczCjzI2devNBz1zQrb` | Brian — deep, comforting |
| `EXAVITQu4vr4xnSDxMaL` | Sarah — mature, reassuring |

List your own with `curl https://api.elevenlabs.io/v1/voices -H "xi-api-key: KEY"`
(the key needs the `voices_read` permission).

---

## Checks

Start the app, then:

```bash
npm run check:extract   # 8 cases: Devanagari, mixed script, decimals, rate × quantity
npm run check:db        # 14 cases: validation, saving, reading the day back
npm run check:history   # 20 cases: a correction never destroys the original
npm run db:inspect      # what is in the database
npm run db:inspect -- --wipe   # clear records (keeps the shop)
```

`check:extract` is free and safe anytime — it never writes.

`check:db` and `check:history` **wipe every record first** so their totals are
predictable, so both refuse to run when the database already holds any. Point the app
at a throwaway database to run them safely:

```bash
MONGODB_DB=auditly_tmp npm run dev
MONGODB_DB=auditly_tmp npm run check:history
```

## Layout

```
src/
├── app/
│   ├── page.tsx              Home — summary, listen, mic, today's records
│   ├── review/page.tsx       Review — transcript, editable records, save
│   ├── history/page.tsx      History — past days, with safe corrections
│   └── api/
│       ├── transcribe/       audio → text   (ElevenLabs)
│       ├── extract/          text → records (Groq)
│       ├── records/          save confirmed records
│       ├── records/correct/  replace a record without erasing it
│       └── speak/            today's figures → Hindi speech (ElevenLabs)
├── components/               MicButton, SpeakButton, HistoryList, ...
└── lib/
    ├── models/               Mongoose schemas: shop, product, transaction
    ├── shop-data.ts          saving and reading
    ├── extract-prompt.ts     the extraction prompt
    ├── speech-text.ts        composes the spoken Hindi sentence
    └── env.ts                settings, read server-side only
```

## Data

Three collections — `shops`, `products`, `transactions`.

Money is stored as **whole paise**. ₹1,000 is `100000`. Money never touches a decimal,
so rounding can never quietly accumulate.

Each transaction keeps a copy of the product name, so old records stay readable after a
product is renamed, and the transcript that produced it, so the shopkeeper can see why
a row exists.

## Not built

Honest list:

- **No login.** One shop, fixed id. The schema carries `shopId` throughout, so
  multi-shop is a change in one place, not a rewrite.
- **No udhar (customer credit).** Needs a customer entity; deliberately left out rather
  than half-built.
- **No product management screen.** Products appear by being spoken; there is no screen
  to rename or delete one.
- **No profit.** Requires cost-of-goods tracking. The UI says so rather than guessing.

## Credits

Voice by **[ElevenLabs](https://elevenlabs.io)** — speech-to-text and text-to-speech.
Extraction by **[Groq](https://groq.com)**.

Built for Hacktoberfest 2026.
