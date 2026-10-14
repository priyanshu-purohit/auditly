# Auditly — Project Instructions

## Project Overview
Auditly is a voice-first Hindi/Hinglish business assistant for small shopkeepers. The goal is to help them manage everyday shop operations through a simple, accessible interface.

## Project Constraints
- Keep the project compatible with an ordinary laptop.
- Prefer free tiers and open-source tools.
- Do not introduce paid APIs or services without explicit approval.
- Use MongoDB rather than PostgreSQL.
- Do not require heavy local AI models.
- Build the MVP incrementally.
- Respect free-tier quotas. The ElevenLabs free plan is 10,000 credits/month (~30 minutes of speech-to-text at 330 credits/minute), shared with text-to-speech. Never burn credits on automated tests — use saved audio files and mock responses during development.
- The ElevenLabs free plan forbids commercial use and requires visible attribution.

## Technology Stack
- Next.js
- TypeScript
- Tailwind CSS
- MongoDB Atlas (via Mongoose)
- Node.js
- ElevenLabs — speech-to-text (Scribe) and text-to-speech
- Groq — free hosted LLM for Hindi/Hinglish entity extraction

## Development Rules
- Inspect existing files before modifying them.
- Reuse existing dependencies and components where practical.
- Do not replace working code without a clear reason.
- Keep code modular, readable, and beginner-friendly.
- Validate user input and handle errors appropriately.
- Never hardcode credentials or API keys.
- Use environment variables for secrets.
- Run relevant checks after making changes.
- Do not mark a feature complete until it has been tested.

## Workflow
1. Inspect the repository and README.md.
2. Review MVP_CHECKLIST.md.
3. Explain the proposed changes before implementing a major feature.
4. Work in small, verifiable steps.
5. Update documentation and the MVP checklist when appropriate.
6. Ask before introducing new paid services or major architectural changes.

## Database
Use MongoDB. Plan for shops, products, and transactions as the initial data entities. Confirm the schema and relationships before implementing database-dependent features.

## Important
Do not build the entire application in one step. Focus on the next explicitly requested task and preserve the existing project structure.