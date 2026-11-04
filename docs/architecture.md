# Architecture

Checked against the Google Play SMS and Call Log policy on 4 November 2026: [Use of SMS or Call Log permission groups](https://support.google.com/googleplay/android-developer/answer/10208820).

## What we are building

The phone listens for bank SMS, keeps the financial ones, turns them into transactions, and shows spending in rupees. The user should not type each expense or approve each capture.

Phase 1 only creates the two programs and the boundaries between them. The home screen is a status page so we can see that the shell runs. The dashboard, database, parser, Gemini call, and Kotlin receiver come in later phases.

## How the pieces communicate

```text
Bank SMS
  -> Kotlin BroadcastReceiver          only financial SMS continue
  -> Room ingestion queue              survives the app being closed
  -> WorkManager
       -> Kotlin parser                known bank formats
       -> expense-tracker-api          only when the parser is unsure
            -> Gemini                  key stays on the server
            -> Zod                     reject malformed or invented fields
  -> native module event
  -> Expo SQLite                       the database the screens read
  -> React Native screens              Zustand holds UI state only
```

React Native reads Expo SQLite. Kotlin receives the SMS, keeps a short queue, and the screens ask a native bridge whether capture is available. In Expo Go that bridge says capture is unavailable.

Gemini is reached only from `expense-tracker-api`. `POST /api/extract-transaction` accepts one message, asks Gemini for JSON, and validates that JSON with Zod before responding. Unknown facts must be `null`. The model is not allowed to fill them in. The phone calls this route only for an unfamiliar financial alert, and only after tracking is on. An OTP is refused before the call. The Gemini key stays in `expense-tracker-api/.env`.

Supabase is not part of the MVP. A later backup can copy the local database. The app must work with no account and no network, except for the occasional unfamiliar SMS that needs Gemini.

## Why there are two local databases

Expo SQLite is available only while the React Native runtime is running. A bank SMS can arrive when the app is closed. Kotlin therefore needs its own store.

- The Android capture module keeps a small queue, `sms-ingestion.db`. A new bank alert is handed from the receiver to WorkManager. The queue holds the text until the app parses it, then deletes that copy. It does not share a file with Expo SQLite.
- Expo SQLite is the database behind the dashboard, history, and insights. It keeps transactions, categories, accounts, ingestion fingerprints, and the onboarding choices. A reload reads the same rows. The raw SMS body is not a column.

A sync step copies completed rows from the native queue into Expo SQLite. One shared file opened by both Kotlin and Expo SQLite at the same time is more likely to lock or corrupt, so the two stores stay separate. Expo Go does not include the Kotlin receiver. Reading real SMS needs an Android development build.

## Folder structure

```text
Expense Tracker/
├── docs/architecture.md
├── expense-tracker-api/
│   ├── .env.example
│   └── src/
│       ├── index.ts              starts the server
│       ├── app.ts                Express app, also used by tests
│       ├── gemini.ts             Gemini call and response parsing
│       ├── schema.ts             Zod contract for an extraction result
│       ├── routes/
│       ├── services/
│       └── middleware/
└── mobile/
    ├── app.json                  Expo config, including the Android package
    ├── global.css                NativeWind / Tailwind entry
    └── src/
        ├── app/                  Expo Router screens only
        ├── components/ui/        reusable views, Phase 2
        ├── features/             onboarding, dashboard, transactions,
        │                         insights, settings, ingestion
        ├── hooks/
        ├── services/             API base URL
        ├── database/             Expo SQLite, Phase 3
        ├── state/                Zustand
        ├── types/
        ├── utils/
        └── native/               JavaScript side of the Kotlin bridge
```

Generated `mobile/android` and `mobile/ios` folders are ignored. Expo prebuild creates them from `app.json` and, later, from a local native module. Kotlin for SMS will live in that module so the generated Android project can be rebuilt instead of edited by hand.

The Android package is `com.expensetracker.app`. No SMS permission is declared in Phase 1.

## Dependencies

### Mobile, installed now

| Package | Why |
| --- | --- |
| expo ~57, react-native 0.86, react 19.2 | Current stable SDK with a documented NativeWind release |
| expo-router | File-based screens |
| typescript | Typed boundaries between UI, database, and native code |
| nativewind 4.2 + tailwindcss 3.4 | Utility styling for the later design system |
| react-native-reanimated, react-native-worklets, react-native-safe-area-context | Required by NativeWind and the current Expo SDK |
| zustand | Small client state: tracking status and permission status |

NativeWind 4.2.7 is the stable release that documents Expo SDK 57. SDK 58 is newer, and NativeWind does not document that pair yet, so this project stays on SDK 57.

### Mobile, added in later phases

| Package | Phase | Why |
| --- | --- | --- |
| expo-sqlite | 3 | Transactions, categories, and accounts read by the UI |
| expo-dev-client | 6 | Expo Go cannot load a custom Kotlin receiver |

### API, installed now

| Package | Why |
| --- | --- |
| express 5 | HTTP server |
| zod 3 | Validation contract for extraction JSON |
| typescript, tsx | Run and typecheck the server without a separate build step during development |

`@google/genai` is installed only in `expense-tracker-api`. The server reads `GEMINI_API_KEY` and `GEMINI_MODEL` from the environment. The default model is `gemini-2.5-flash`. A missing key returns `503`. A reply that breaks the Zod contract returns `502`. The route allows 20 requests a minute per caller.

## Google Play and platform limits

Play treats the SMS permission group as sensitive. An app that is not the default SMS, Phone, or Assistant handler may not use those permissions unless Play grants an exception.

The current exception list includes **SMS-based money management**, described as apps that track and manage a budget. The permissions named for that exception are `READ_SMS`, `RECEIVE_MMS`, `RECEIVE_SMS`, and `RECEIVE_WAP_PUSH`. It does not include `SEND_SMS` or `WRITE_SMS`. The exception is reviewed, it can be refused, and it has to be the core purpose of the app. There must be no adequate alternative. A Permissions Declaration Form is required before a Play release. The listing has to describe this core feature prominently.

This project will not become the default SMS app. The product does not need to send messages. When SMS capture is added, the first permission to justify is `RECEIVE_SMS`, because the feature is about new bank alerts. `READ_SMS` would only be considered for an explicit import of older alerts. `RECEIVE_MMS` and `RECEIVE_WAP_PUSH` are not needed for normal bank SMS. Call Log permissions are out of scope.

Play's spyware rules also apply. A budgeting app may not collect, upload, or keep SMS that is not a financial transaction. OTPs are not collected. Advertising use is disallowed. Users need a clear explanation and consent before the permission prompt, and the app must keep working if they deny or later revoke it.

Other limits that will shape later phases:

- iOS apps cannot read the user's SMS. The capture feature is Android-only.
- `SMS_RECEIVED` can reach a non-default app when `RECEIVE_SMS` is granted, but a force-stopped app does not receive it until the user opens the app again. Some phones delay background work to save battery.
- The receiver has a short time to finish. Parsing and network calls belong in WorkManager, not in the receiver.
- Expo Go includes only Expo's own native modules. SMS capture requires a development build from Android Studio or `expo run:android`.
- This machine does not currently have a Java runtime or Android SDK, so Phase 1 is verified with the web shell, TypeScript, and the API tests. An Android build has to wait until that toolchain is installed.
- Sending an unfamiliar SMS to Gemini sends financial text to Google. Onboarding has to say that before the first call. Development uses synthetic messages only.
- A credit-card bill payment, a transfer between the user's own accounts, a refund, and a failed payment must not be treated as ordinary spending. Those rules belong to the parser and the dashboard, not to this phase.
