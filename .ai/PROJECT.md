# Project: Payload Email Broadcast Plugin

## Цел

`payload-email-broadcast-plugin` е преизползваем Payload v3 plugin за broadcast имейли с интеграция към Resend.

Първата реална употреба е в Payload CMS проекта на Manchester United Bulgaria supporters club, където началният use case е изпращане на годишен финансов отчет към членовете.

Проектът трябва да бъде проектиран като самостоятелен plugin още от самото начало, за да може да се използва и в други Payload проекти без пренаписване на основната логика.

## Основни цели

Plugin-ът трябва да предоставя:

- `Email Broadcasts`
- `Email Templates`
- `Email Logs`
- `Email Settings`
- newsletter subscription / unsubscribe поддръжка
- Resend интеграция

## Очакван API

```ts
emailBroadcastPlugin({
  recipientsCollection: "users",
  recipientFields: {
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
  },
  subscriptionField: "newsletterSubscribed",
  resendApiKey: process.env.RESEND_API_KEY,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
})
```

## Конфигурационен модел

### Конфигурация в code

Следните стойности остават в developer configuration:

- `recipientsCollection` (`usersCollection` остава legacy alias)
- `recipientFields`
- `subscriptionField`
- `resendApiKey`
- `siteUrl`

### Конфигурация в Payload Global

`Email Settings` трябва да съдържа:

- `organizationName`
- `defaultFromName`
- `defaultFromEmail`
- `defaultReplyTo`
- `sendingDomain`
- `testRecipientEmail`
- `footerText`

## Ограничения

- `Resend API key` не трябва да се пази в базата данни.
- Реални broadcast имейли не трябва да се изпращат без изрично човешко потвърждение.
- Реалните marketing/newsletter кампании трябва да минават през Resend Broadcast API.
- Plugin-ът не трябва да изпраща реални broadcast получатели един по един чрез `resend.emails.send()`.
- `resend.emails.send()` остава допустим само за единичен тестов имейл.
- Payload Jobs queue и cron runner не трябва да са задължителна част от production инсталацията.

## Обхват на данните

Plugin-ът работи с потребители от конфигурируема Payload collection и използва конфигурируеми полета за email, име, subscription статус и unsubscribe token.

## Извън текущия обхват

- Не трябва да има auto-send логика от hooks.
- Не трябва да се hardcode-ват project-specific полета извън plugin options.
