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

## Конфигурационен модел

### Конфигурация в code

Следните стойности остават в developer configuration:

- `usersCollection`
- `recipientFields`
- `subscriptionField`
- `unsubscribeTokenField`
- `resendApiKey`

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
- Реалното broadcast изпращане трябва да минава през Payload Jobs queue.
- Всеки host проект трябва да има настроен jobs runner, който изпълнява queue `email-broadcasts`.

## Обхват на данните

Plugin-ът работи с потребители от конфигурируема Payload collection и използва конфигурируеми полета за email, име, subscription статус и unsubscribe token.

## Извън текущия обхват

- Не трябва да има auto-send логика от hooks.
- Не трябва да се hardcode-ват project-specific полета извън plugin options.
