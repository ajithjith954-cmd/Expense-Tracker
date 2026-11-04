# Expense Tracker

Android-first personal expense tracker for one or two people. The product goal is to capture bank transaction SMS, extract the details, and show them in a dashboard without asking the user to confirm every payment.

The phone keeps the ledger in SQLite. Familiar bank-alert wording is parsed on the phone. An unfamiliar alert can be sent to the server, and the Gemini key stays in `expense-tracker-api/.env`. The rows already in the app are still labeled sample payments. Reading a real SMS needs an Android development build; Expo Go cannot do it.

## Run the mobile shell

```bash
cd mobile
npm start
```

Then press `w` for the web preview, or scan the QR code with Expo Go. Custom Kotlin code cannot run inside Expo Go. That native work starts in Phase 6 and needs a development build.

```bash
cd mobile
npm run typecheck
```

## Run the API

```bash
cd expense-tracker-api
cp .env.example .env
npm install
npm test
npm start
```

`GET /health` returns the service status. `POST /api/extract-transaction` accepts one financial message, asks Gemini for structured JSON, and checks that JSON with Zod before returning it. Put `GEMINI_API_KEY` in `expense-tracker-api/.env`. Without that key the route returns `503` and does not call Google. The phone uses that route only when its own parser cannot read an alert. Tests use synthetic messages, so development does not send a real bank SMS.

## Where to read the design

[docs/architecture.md](docs/architecture.md) explains how React Native, Kotlin, SQLite, and the API fit together, and records the Google Play SMS limits.

## Phase status

| Phase | Status |
| --- | --- |
| 1. Project initialization and architecture | Done |
| 2. Design system and mobile UI | Done |
| 3. SQLite and transaction management | Done. Sample rows live in the local database. |
| 4. Gemini extraction API | Done. The server extracts one message when a key is set. The phone calls it only for an unfamiliar alert. |
| 5. Deterministic parser | Done. Known bank-alert wording is parsed on the phone. |
| 6. Kotlin SMS capture | Written. It runs only in an Android development build, not in Expo Go. |
| 7. Background processing and sync | Done. The phone queues an alert, then saves it when tracking is on. |
| 8. End-to-end testing | Done for synthetic alerts. A real phone build has not been run on this computer. |
