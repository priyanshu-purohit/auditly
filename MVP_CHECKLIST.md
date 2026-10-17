# Auditly — MVP Checklist

> **Status — day 4 of 5 (17 Oct 2026).** Feature complete. The loop runs end to
> end: speak, ElevenLabs transcribes, Groq pulls out the records, correct them on
> screen, save to MongoDB Atlas, Home shows the real figures and stock, and
> ElevenLabs reads the day back in Hindi. README written.
>
> Two items stay unticked on purpose — shopkeeper onboarding and a product
> management screen. Both are listed under "Not built" in the README with the
> reasoning, rather than half-built before the deadline.

## 1. Project Setup
- [x] Initialize the project and configure dependencies
- [x] Set up the Next.js application with TypeScript
- [x] Configure Tailwind CSS
- [x] Configure environment variables
- [x] Establish the initial project structure

## 2. Database
- [x] Set up the MongoDB connection
- [x] Design the initial database schemas
- [x] Test database connectivity

## 3. Core Application
- [x] Build the main application layout
- [ ] Implement shopkeeper onboarding
- [ ] Implement product management
- [x] Implement sales and transaction recording
- [x] Display basic business summaries

## 4. Voice Interaction
- [x] Research free or browser-native speech recognition options
- [x] Implement voice input for supported commands
- [x] Handle Hindi and Hinglish input where supported
- [x] Provide a text-input fallback

## 5. Testing and Reliability
- [x] Validate user inputs
- [x] Handle errors and unsupported browser features
- [x] Test core workflows
- [x] Verify the application works on an ordinary laptop

## 6. MVP Completion
- [x] Complete the primary shopkeeper workflow
- [x] Document installation and usage
- [x] Verify that no paid service is required without explicit approval