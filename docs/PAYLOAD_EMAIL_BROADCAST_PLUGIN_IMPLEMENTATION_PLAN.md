# Payload Email Broadcast Plugin – Implementation Plan for Codex

## Purpose

This document defines the implementation workflow for the reusable Payload Email Broadcast Plugin.

Codex must follow this plan step by step.

Do not jump ahead.
Do not implement future phases early.
After each phase, stop and provide:
- what was changed
- which files were created/modified
- how to verify the result
- whether the checks pass

---

## Required companion document

Before starting, read:

```txt
docs/PAYLOAD_EMAIL_BROADCAST_PLUGIN_SPEC.md
```

That document defines the feature scope and architecture.

This document defines the execution order.

---

# Phase 1 — Project skeleton

## Goal

Create the initial npm-style TypeScript package structure for a reusable Payload v3 plugin.

## Tasks

Create:

```txt
package.json
tsconfig.json
README.md
src/index.ts
src/collections/
src/globals/
src/endpoints/
src/providers/
src/utils/
```

## Constraints

- Do not implement Resend sending.
- Do not integrate into a real Payload project.
- Do not add complex business logic.
- The package should build with TypeScript.

## Verification

Run:

```bash
npm install
npm run build
```

## Stop condition

Stop after this phase and report the result.

---

# Phase 2 — Plugin entry point

## Goal

Create the basic `emailBroadcastPlugin()` function.

## Tasks

Implement:

```ts
emailBroadcastPlugin(options)(config)
```

The plugin should accept typed options:

- usersCollection
- recipientFields.email
- recipientFields.firstName
- recipientFields.lastName
- subscriptionField
- unsubscribeTokenField
- resendApiKey

For now, the plugin may return the config unchanged or with placeholder collections.

## Verification

Run:

```bash
npm run build
```

## Stop condition

Stop after this phase and report the result.

---

# Phase 3 — Collections and Global skeleton

## Goal

Add the Payload admin structure.

## Tasks

Create skeletons for:

- Email Broadcasts collection
- Email Templates collection
- Email Logs collection
- Email Settings global

Add them to the plugin config.

## Verification

Run:

```bash
npm run build
```

If a test Payload project is available, install the plugin locally and verify that the admin sections appear.

## Stop condition

Stop after this phase and report the result.

---

# Phase 4 — Local integration test

## Goal

Verify that the plugin can be installed in a real Payload project via local file dependency.

## Tasks

In the target Payload project, install the plugin using:

```json
"payload-email-broadcast-plugin": "file:../payload-email-broadcast-plugin"
```

Register it in `payload.config.ts`.

## Verification

- Payload project builds.
- Payload admin opens.
- Plugin collections/global are visible.
- No runtime errors.

## Stop condition

Stop after this phase and report the result.

---

# Phase 5 — Recipient preview

## Goal

Add a recipient preview mechanism without sending emails.

## Tasks

Implement logic to count:

- total candidate recipients
- recipients without email
- duplicate emails
- unsubscribed recipients
- final recipients

## Verification

Run build.

Then test preview against the real users/members collection.

## Stop condition

Stop after this phase and report the result.

---

# Phase 6 — Template rendering

## Goal

Support basic template variables.

## Tasks

Implement replacement for:

```txt
{{ firstName }}
{{ lastName }}
{{ email }}
{{ unsubscribeUrl }}
```

Missing values should not break rendering.

## Verification

Add simple unit-style checks or a small local test script.

Run:

```bash
npm run build
```

## Stop condition

Stop after this phase and report the result.

---

# Phase 7 — Resend provider and test email

## Goal

Send a single test email through Resend.

## Tasks

Implement Resend provider.
Implement Send Test endpoint/action.

## Constraints

- Send only to configured test recipient.
- Do not send to real recipients.
- Do not send a broadcast.

## Verification

- Build passes.
- A single test email is received.
- No email is sent to the full list.

## Stop condition

Stop after this phase and report the result.

---

# Phase 8 — Unsubscribe support

## Goal

Add basic unsubscribe functionality.

## Tasks

Implement:

- unsubscribe token handling
- newsletter subscription fields or recommended alternative
- public unsubscribe endpoint

## Verification

Test with one user only.

Expected result:

- user becomes unsubscribed
- timestamp is stored
- endpoint returns a simple confirmation page

## Stop condition

Stop after this phase and report the result.

---

# Phase 9 — Broadcast sending MVP

## Goal

Enable actual broadcast sending.

## Tasks

Implement sending flow:

- load broadcast
- validate status
- load recipients
- skip invalid recipients
- render template
- send via Resend
- create logs
- update counters

## Constraints

- Do not auto-send from hooks.
- Send only after explicit admin action.
- Prefer simple sequential or small-batch sending.
- Keep structure ready for a future queue system.

## Verification

Test first with 2–3 test users only.

Do not send to the full production list yet.

## Stop condition

Stop after this phase and report the result.

---

# Phase 10 — Real campaign readiness

## Goal

Prepare for the first real email campaign.

## Tasks

Before sending to all members, verify:

- sender domain
- from email
- reply-to email
- unsubscribe footer
- recipient count
- test email rendering
- logs
- Resend limits

## Verification

Send only after explicit human approval.

## Stop condition

Stop and wait for approval before any real full-list broadcast.

---

# General rules for Codex

- Work in small phases.
- Do not skip verification.
- Do not implement future phases early.
- Do not hardcode project-specific fields.
- Do not store API keys in the database.
- Do not send real emails unless explicitly instructed.
- Prefer clear, boring, maintainable code.
- After each phase, summarize exactly what changed.
