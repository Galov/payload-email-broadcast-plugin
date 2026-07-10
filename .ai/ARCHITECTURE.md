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
- `recipientMode`: `all | subscribed | custom`
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

## Sending flow

Последователността за broadcast sending MVP е:

1. Зареждане на broadcast.
2. Валидация на статуса.
3. Зареждане на recipient-ите.
4. Пропускане на записи без email, с duplicate email или unsubscribed при `marketing`.
5. Render на template.
6. Инжектиране на unsubscribe link.
7. Създаване на log.
8. Изпращане през Resend.
9. Обновяване на counters.

## Типове имейли

Поддържат се два типа:

- `service`
- `marketing`

`marketing` broadcast трябва да се изпраща само към users с активен subscription статус.
