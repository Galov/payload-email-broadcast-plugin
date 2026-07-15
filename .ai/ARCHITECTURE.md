# Architecture

## Основни модули

Планираната структура на plugin-а е:

```txt
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
    jobs/
      processBroadcastBatch.ts
    providers/
      resend.ts
    utils/
      recipients.ts
      renderTemplate.ts
      tokens.ts
```

## Административни структури

### `Email Broadcasts`

Полета:

- `title`
- `subject`
- `previewText`
- `body`
- `status`: `draft | ready | sending | sent | failed`
- `type`: `service | marketing`
- `recipientMode`: `all | subscribed | groups | custom`
- `sentAt`
- `recipientCount`
- `deliveredCount`
- `failedCount`

Административни действия:

- Preview recipients
- Send test
- Send broadcast

### `Email Templates`

Полета:

- `name`
- `subject`
- `previewText`
- `body`
- `type`: `service | marketing`

### `Email Logs`

Има по един запис за всеки recipient.

Полета:

- `broadcast`
- `email`
- `recipientId`
- `status`
- `error`
- `sentAt`
- `providerMessageId`

### `Email Settings` Global

Global-ът държи административните настройки за изпращане и footer съдържание, без secret credentials.

### `Email Recipient Groups`

Групите са статични списъци от получатели.

Има два начина за създаване:

- ръчно избиране на получатели;
- snapshot създаване по критерии.

Snapshot групата използва `groupFilterFields` от plugin config. Plugin-ът взема позволените полета от recipient collection config и поддържа само top-level полета от тип `text`, `email`, `number`, `date`, `checkbox`, `select` и `radio`.

За `select` и `radio` plugin-ът използва options от Payload field config, когато са налични.

Snapshot групата не е live dynamic query. При създаването й се записват конкретните recipient IDs. Това прави кампанията проследима и предпазва от неочаквана промяна на аудиторията след време.

## Публичен endpoint

Планиран е публичен endpoint:

```txt
GET /api/email-broadcasts/unsubscribe?token=...
```

Поведение:

- валидира token-а;
- маркира потребителя като unsubscribed;
- записва timestamp;
- връща проста HTML страница за success/error.

## Newsletter модел

Базовата поддръжка за newsletter включва следните user fields:

- `newsletterSubscribed`
- `newsletterSubscribedAt`
- `newsletterUnsubscribedAt`
- `unsubscribeToken`

Ако директното разширяване на users collection не е най-чистият подход в Payload, архитектурата трябва да се прецизира преди implementation phase-а за unsubscribe.

## Broadcast sending model

Broadcast изпращането не трябва да зависи от една HTTP заявка. Реалното изпращане трябва да минава през Payload Jobs queue, за да работи надеждно както на serverless платформи като Vercel, така и на long-running сървъри като Hetzner.

Основният модел е:

1. Админът натиска реално изпращане.
2. Endpoint-ът валидира кампанията и получателите.
3. Кампанията се маркира като `queued`.
4. Queue-ва се prepare task в queue `email-broadcasts`.
5. Prepare task-ът създава `email-logs` записи за всички валидни получатели със статус `pending`.
6. Prepare task-ът queue-ва batch task.
7. Batch task-ът обработва малък batch от pending получатели.
8. Всеки получател се маркира като `sending`, после `sent` или `failed`.
9. Ако остават pending получатели, batch task-ът queue-ва следващ batch.
10. Когато няма pending/sending получатели, кампанията се маркира като `sent` или `failed`.

## Payload Jobs

Plugin-ът регистрира Payload task за обработка на broadcast batch.

Начални решения:

- task: `processEmailBroadcastBatch`
- prepare task: `prepareEmailBroadcast`
- queue: `email-broadcasts`
- batch size: `25`
- retry attempts: `2`
- source of truth за progress: `email-logs`

Task-ът трябва да бъде идемпотентен. Ако процесът спре или job бъде повторен, вече изпратените получатели не трябва да получат втори имейл.

## Jobs runner requirement

Plugin-ът регистрира Payload task и queue-ва jobs, но host проектът трябва да осигури механизъм, който реално изпълнява jobs от queue `email-broadcasts`.

Това е задължителна част от инсталацията:

- локално: ръчно стартиране на jobs runner или защитен endpoint за тест;
- Vercel/serverless: защитен cron endpoint, който вика `payload.jobs.run({ queue: "email-broadcasts" })`;
- Hetzner/собствен сървър: cron, systemd timer или постоянен worker процес.

Без jobs runner кампанията може да стигне до статус `queued`, но имейлите няма да бъдат изпратени.

## Email log statuses

`Email Logs` трябва да поддържа следните статуси:

- `pending`
- `sending`
- `sent`
- `failed`
- `skipped`

`pending` означава, че получателят е избран, но още не е обработен.

`sending` означава, че текущ batch го обработва.

`sent` означава, че provider-ът е приел имейла.

`failed` означава, че изпращането към този получател е неуспешно.

`skipped` означава, че получателят е пропуснат по правило, например липсващ имейл, duplicate email или неподходящ subscription статус.

## Типове имейли

Поддържат се два типа:

- `service`
- `marketing`

`marketing` broadcast трябва да се изпраща само към users с активен subscription статус.
