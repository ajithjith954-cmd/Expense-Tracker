# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Stack

The existing app is the stack: React Native, Expo SDK 57 with prebuild, Expo Router, TypeScript, NativeWind, and Zustand. A separate Express API is reserved for later Gemini extraction. Local transactions will use Expo SQLite in a later phase.

## Users

One or two people tracking their own money in India. They are often looking at the phone after a payment, or at the end of the day, and they want the answer without typing the expense in.

## Product Purpose

Show what was spent, what was received, where the money went, and the recent transactions. Success is a glance that answers those four questions, with automatic capture later removing manual entry.

## Positioning

Bank SMS is the source of transactions. The user does not confirm every capture. A deterministic parser handles known formats, and Gemini is used only when a financial message is unfamiliar. The API key stays on the server.

## Operating Context

Android phone, light theme, amounts in Indian rupees. Onboarding explains SMS access and gets consent before any permission prompt. The app is not the default SMS handler. Development uses synthetic transactions until real capture exists.

## Capabilities and Constraints

Phase 2 builds onboarding, home, transaction history, insights, and settings. Sample transactions are labeled as sample data. Editing and deleting in the UI updates that local sample state only. SQLite, Gemini, and Kotlin SMS capture are later phases.

Business rules the interface must already respect: a credit-card bill payment is not spending, a transfer between the user's own accounts is not spending, a failed payment is not a completed expense, and a refund reduces spending where the original expense is known. Insights stay quiet when the sample set is too thin to support a comparison.

Google Play may refuse SMS permissions. The screens must remain usable when permission is denied or revoked.

## Brand Commitments

The name is Expense Tracker. The interface is light, plain, and quiet. Typography stays readable. Spacing stays consistent. The home screen does not add decorative KPI cards. No advertising use of financial data.

## Evidence on Hand

No real bank messages, customers, or logos. Sample transactions are synthetic and must be identifiable as samples. Do not invent balances from a real account or claim that SMS capture is already active.

## Product Principles

- Answer the money question before explaining the system.
- Ask for SMS access only after the reason and the privacy terms are clear.
- Unknown categories and partial records stay visible and editable.
- A denied permission does not trap the user.
- Sample data is never presented as the user's real spending.

## Accessibility & Inclusion

Accessible type sizes, readable contrast on a light background, and amounts that can be read without relying on color alone. Debit and credit are indicated by sign, color, and a text label.
