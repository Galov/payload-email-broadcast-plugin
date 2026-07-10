# Payload Email Broadcast Plugin -- Project Specification

## Context

We have a Payload CMS project for the Manchester United Bulgaria
supporters club. We want to add broadcast email functionality using
Resend.

This functionality must be designed from day one as a reusable Payload
plugin, because it will be reused in multiple Payload projects.

The first real implementation will be inside the supporters club
project, where the initial use case is sending an annual financial
report to members.

------------------------------------------------------------------------

# Goals

Create a reusable Payload v3 plugin:

``` ts
emailBroadcastPlugin({...})
```

The plugin should add:

-   Email Broadcasts
-   Email Templates
-   Email Logs
-   Email Settings
-   Newsletter subscription / unsubscribe support
-   Resend integration

------------------------------------------------------------------------

# Project structure

    payload-email-broadcast-plugin/
      package.json
      tsconfig.json
      src/
        index.ts
        collections/
          EmailBroadcasts.ts
          EmailTemplates.ts
          EmailLogs.ts
        globals/
          EmailSettings.ts
        endpoints/
          previewRecipients.ts
          sendTest.ts
          sendBroadcast.ts
          unsubscribe.ts
        providers/
          resend.ts
        utils/
          recipients.ts
          renderTemplate.ts
          tokens.ts

The plugin will initially be installed locally:

``` json
"payload-email-broadcast-plugin": "file:../payload-email-broadcast-plugin"
```

------------------------------------------------------------------------

# Plugin API

``` ts
emailBroadcastPlugin({
  usersCollection: "users",

  recipientFields: {
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
  },

  subscriptionField: "newsletterSubscribed",
  unsubscribeTokenField: "unsubscribeToken",

  resendApiKey: process.env.RESEND_API_KEY,
})
```

## Required options

-   usersCollection
-   recipientFields.email
-   resendApiKey

## Optional options

-   recipientFields.firstName
-   recipientFields.lastName
-   subscriptionField
-   unsubscribeTokenField
-   defaultFromEmail
-   defaultFromName
-   defaultReplyTo

------------------------------------------------------------------------

# Configuration philosophy

## Developer configuration (code)

These remain inside code:

-   users collection
-   recipient fields
-   subscription field
-   unsubscribe token field
-   Resend API key

## Admin configuration (Payload Global)

Create an **Email Settings** Global.

Fields:

-   organizationName
-   defaultFromName
-   defaultFromEmail
-   defaultReplyTo
-   sendingDomain
-   testRecipientEmail
-   footerText

The Resend API key must never be stored in the database.

------------------------------------------------------------------------

# Collections

## Email Broadcasts

Fields:

-   title
-   subject
-   previewText
-   body
-   status
    -   draft
    -   ready
    -   sending
    -   sent
    -   failed
-   type
    -   service
    -   marketing
-   recipientMode
    -   all
    -   subscribed
    -   custom
-   sentAt
-   recipientCount
-   deliveredCount
-   failedCount

Actions:

-   Preview recipients
-   Send test
-   Send broadcast

------------------------------------------------------------------------

## Email Templates

Fields:

-   name
-   subject
-   previewText
-   body
-   type (service / marketing)

------------------------------------------------------------------------

## Email Logs

One record per recipient.

Fields:

-   broadcast
-   email
-   recipientId
-   status
-   error
-   sentAt
-   providerMessageId

------------------------------------------------------------------------

# Newsletter

Support basic newsletter subscription.

User fields:

-   newsletterSubscribed
-   newsletterSubscribedAt
-   newsletterUnsubscribedAt
-   unsubscribeToken

If extending the users collection directly is not the cleanest Payload
approach, propose a better architecture.

------------------------------------------------------------------------

# Public endpoint

    GET /api/email-broadcasts/unsubscribe?token=...

Behaviour:

-   validate token
-   unsubscribe user
-   save timestamp
-   return simple success/error HTML page

------------------------------------------------------------------------

# Sending flow

1.  Load broadcast.
2.  Validate status.
3.  Load recipients.
4.  Skip:
    -   missing email
    -   duplicate email
    -   unsubscribed users (marketing only)
5.  Render template.
6.  Inject unsubscribe link.
7.  Save log.
8.  Send through Resend.
9.  Update counters.

Do not build a queue system yet, but structure the code so one can be
added later.

------------------------------------------------------------------------

# Email types

Support:

-   service
-   marketing

Marketing:

-   only newsletterSubscribed users.

Service:

-   all relevant members.

Always include footer explaining why the recipient received the email.

------------------------------------------------------------------------

# Template variables

Support:

-   {{ firstName }}
-   {{ lastName }}
-   {{ email }}
-   {{ unsubscribeUrl }}

------------------------------------------------------------------------

# Admin UX (MVP)

The admin should be able to:

-   create broadcast
-   edit subject/body
-   choose service or marketing
-   preview recipient count
-   send test
-   send broadcast
-   inspect logs

------------------------------------------------------------------------

# Integration

After plugin creation:

1.  Install locally.
2.  Register in payload.config.ts.
3.  Configure real users collection.
4.  Add RESEND_API_KEY to .env.
5.  Verify admin screens.
6.  Send only test email.
7.  Never send a real broadcast without explicit confirmation.

------------------------------------------------------------------------

# Constraints

-   No hardcoded project-specific field names.
-   No hardcoded domains.
-   No API keys in database.
-   No automatic sending via hooks.
-   No drag-and-drop editor in MVP.
-   No complex segmentation in MVP.

------------------------------------------------------------------------

# Expected outcome

A reusable Payload plugin that can later be installed into any Payload
project with minimal configuration.

The implementation should prioritize clean architecture over feature
completeness.
