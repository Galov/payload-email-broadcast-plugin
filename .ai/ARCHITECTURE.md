# Architecture

## Основни модули

Проектът е преизползваем Payload v3 plugin за подготовка и изпращане на Resend Broadcast кампании.

```txt
payload-email-broadcast-plugin/
  src/
    index.ts
    collections/
      EmailBroadcasts.ts
      EmailTemplates.ts
      EmailRecipientGroups.ts
      EmailLogs.ts
    globals/
      EmailSettings.ts
    endpoints/
      sendTest.ts
      sendSummary.ts
      syncAudience.ts
      createBroadcastDraft.ts
      sendResendBroadcast.ts
    providers/
      resend.ts
    utils/
      recipients.ts
      renderTemplate.ts
      emailBody.ts
      groupFilters.ts
```

## Водещ принцип

Plugin-ът не трябва да изпраща реални broadcast имейли един по един чрез `resend.emails.send()`.

Реалното масово изпращане трябва да минава през Resend Broadcast API:

1. Developer-ът задава постоянните Resend сегменти в plugin config.
2. Payload добавя checkbox група за тези сегменти в recipient collection.
3. При запис на recipient документа Payload създава или обновява Resend Contact.
4. При същия запис Payload добавя или маха contact-а от избраните постоянни Resend сегменти.
5. Кампанията избира един от тези постоянни сегменти.
6. Payload създава Resend Broadcast към избрания segment.
7. Resend изпраща Broadcast-а.

Така Resend отчита кампанията като marketing/broadcast, а не като transactional traffic.

## Административни структури

### `Email Broadcasts`

Кампанията остава основният работен документ в Payload.

Основни полета:

- `title`
- `subject`
- `previewText`
- `body`
- `status`: `draft | ready | preparing | synced | scheduled | sending | sent | failed`
- `resendSegmentKey`
- `sentAt`
- `recipientCount`
- `skippedCount`
- `failedCount`
- `resendSegmentId`
- `resendBroadcastId`
- `resendBroadcastStatus`
- `resendLastSyncedAt`
- `resendLastError`

Административни действия:

- recipient summary;
- send test email;
- prepare recipients locally for the selected persistent segment;
- create Resend Broadcast draft;
- send or schedule Resend Broadcast.

### `Email Templates`

Шаблоните държат съдържание и визуална рамка.

Полета:

- `name`
- `subject`
- `previewText`
- `body`
- header настройки;
- footer настройки;
- цветове.

### `Email Recipient Groups`

Групите са статични Payload списъци от получатели.

Има два начина за създаване:

- ръчно избиране на получатели;
- snapshot създаване по критерии.

Snapshot групата използва `groupFilterFields` от plugin config. Plugin-ът взема позволените полета от recipient collection config и поддържа само top-level полета от тип `text`, `email`, `number`, `date`, `checkbox`, `select` и `radio`.

Snapshot групата не е live dynamic query. При създаването й се записват конкретните recipient IDs.

### `Email Logs`

`Email Logs` вече не трябва да се мисли като per-recipient send log от наш batch sender.

Логовете служат като audit/sync история:

- `broadcast`
- `recipientId`
- `email`
- `status`: `pending_sync | synced | skipped | failed`
- `resendContactId`
- `resendSegmentId`
- `resendBroadcastId`
- `error`
- `syncedAt`

Изпращането, доставката, opens/clicks и unsubscribe поведението са отговорност на Resend Broadcast/Contacts. Ако по-късно добавим webhooks, те могат да обновяват локалните audit данни.

### `Email Settings` Global

Global-ът държи административните sender настройки и footer съдържание, без secret credentials.

Secret стойности остават в environment:

- `RESEND_API_KEY`
- евентуални webhook secrets.

## Resend model

### Contacts

Всеки валиден получател трябва да бъде синхронизиран като Resend Contact.

Минимални данни:

- `email`
- `firstName`
- `lastName`
- `unsubscribed`
- custom properties при нужда.

Resend Contacts са глобални по email. Един contact може да участва в нула, един или много Segments.

### Segments

Plugin-ът работи с постоянни segment-и, зададени от developer-а в plugin config. Това избягва лимитите на Resend free plan и прави segment membership-а дългосрочна част от recipient данните.

Пример за segment config:

```ts
resendSegments: [
  {
    key: 'all',
    label: 'Всички членове',
    resendSegmentId: process.env.RESEND_SEGMENT_ALL_ID || '',
  },
]
```

В кампанията не се избира `all`, `subscribed`, `groups` или `custom`. Кампанията избира един постоянен сегмент, а членството в сегментите се управлява в recipient документа.

### Broadcasts

След sync на contacts/segment plugin-ът създава Resend Broadcast.

Минимални данни:

- `segmentId`
- `from`
- `subject`
- `html`
- `text`
- `name`
- `send` или отделен send call.

Broadcast HTML трябва да използва Resend contact properties за персонализация, когато изпращането е през Broadcast API.

## Template variables

Сегашните Payload variables са:

- `{{ firstName }}`
- `{{ lastName }}`
- `{{ email }}`
- `{{ unsubscribeUrl }}`

При Resend Broadcast те трябва да се мапнат към Resend syntax:

- `{{ firstName }}` -> `{{{contact.first_name|}}}`
- `{{ lastName }}` -> `{{{contact.last_name|}}}`
- `{{ email }}` -> `{{{contact.email}}}`
- `{{ unsubscribeUrl }}` -> `{{{RESEND_UNSUBSCRIBE_URL}}}`

За тестов имейл през `emails.send()` plugin-ът може да продължи да render-ва реални стойности локално.

## Test email

`Изпрати тестов имейл` остава transactional call към `resend.emails.send()`.

Това е допустимо, защото тестовият имейл е единичен, контролиран и не представлява реална кампания.

## Deprecated model

Старият модел `prepareEmailBroadcast` + `processEmailBroadcastBatch` + cron/jobs runner е deprecated.

Причина: той изпраща реалните кампании чрез transactional email API, което е грешен Resend продукт за newsletter/broadcast кампании.

В текущия production модел:

- cron/job runner за изпращане отпада;
- batch sending към получатели отпада;
- `email-logs` вече не са delivery source of truth;
- Resend Broadcast е source of truth за реалното изпращане.

## Safety rules

- Реален Broadcast не се изпраща без explicit admin confirmation.
- Първи production test се прави само към малък контролен segment.
- Кампанията изпраща само към избран постоянен Resend сегмент.
- API keys не се пазят в Payload database.
- Plugin-ът не трябва да hardcode-ва project-specific recipient fields.
