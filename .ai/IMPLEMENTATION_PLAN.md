# Implementation Plan

## Начин на работа

Този план определя реда на изпълнение. Той не отменя архитектурните ограничения от останалите `.ai/` документи.

Codex трябва:

- да работи стъпка по стъпка;
- да не прескача фази;
- да не имплементира бъдещи фази предварително;
- да спира след всяка фаза с отчет.

След всяка фаза отчетът трябва да съдържа:

- какво е променено;
- кои файлове са създадени или редактирани;
- как се проверява резултатът;
- дали проверките минават.

## Фаза 1 — Project skeleton

Цел: да се създаде базова npm-style TypeScript структура за Payload v3 plugin.

Задачи:

- `package.json`
- `tsconfig.json`
- `README.md`
- `src/index.ts`
- `src/collections/`
- `src/globals/`
- `src/endpoints/`
- `src/providers/`
- `src/utils/`

Ограничения:

- Без Resend sending implementation.
- Без интеграция в реален Payload проект.
- Без сложна бизнес логика.
- Пакетът трябва да се build-ва с TypeScript.

Проверка:

```bash
npm install
npm run build
```

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 2 — Plugin entry point

Цел: да се създаде базовата `emailBroadcastPlugin()` функция.

Задачи:

- Имплементация на `emailBroadcastPlugin(options)(config)`.
- Typed options за:
  - `usersCollection`
  - `recipientFields.email`
  - `recipientFields.firstName`
  - `recipientFields.lastName`
  - `subscriptionField`
  - `unsubscribeTokenField`
  - `resendApiKey`

Ограничение:

- На този етап plugin-ът може да връща `config` непроменен или с placeholder collections.

Проверка:

```bash
npm run build
```

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 3 — Collections and Global skeleton

Цел: да се добавят административните структури в Payload.

Задачи:

- Skeleton за `Email Broadcasts`
- Skeleton за `Email Templates`
- Skeleton за `Email Logs`
- Skeleton за `Email Settings` Global
- Добавяне към plugin config

Проверка:

```bash
npm run build
```

Ако има тестов Payload проект:

- plugin-ът се инсталира локално;
- admin секциите трябва да се виждат.

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 4 — Local integration test

Цел: да се потвърди локална инсталация чрез file dependency.

Задачи:

- Инсталиране в target Payload проект чрез:

```json
"payload-email-broadcast-plugin": "file:../payload-email-broadcast-plugin"
```

- Регистриране в `payload.config.ts`

Проверка:

- Payload проектът build-ва
- Payload admin се отваря
- Plugin collections/global се виждат
- Няма runtime errors

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 5 — Recipient preview

Цел: да се добави preview логика без реално изпращане.

Задачи:

- броене на total candidate recipients;
- броене на recipients without email;
- броене на duplicate emails;
- броене на unsubscribed recipients;
- броене на final recipients.

Проверка:

- build;
- preview тест срещу реалната users/members collection, ако е налична.

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 6 — Template rendering

Цел: да се добави базова поддръжка за template variables.

Задачи:

- подмяна на:
  - `{{ firstName }}`
  - `{{ lastName }}`
  - `{{ email }}`
  - `{{ unsubscribeUrl }}`

Правило:

- Липсващи стойности не трябва да чупят render-а.

Проверка:

- simple unit-style checks или малък local test script;
- `npm run build`

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 7 — Resend provider and test email

Цел: да се изпрати единичен тестов имейл през Resend.

Задачи:

- Resend provider
- `Send Test` endpoint/action

Ограничения:

- Изпращане само към конфигурирания test recipient
- Без изпращане към реални recipients
- Без broadcast send

Проверка:

- build минава;
- получен е единичен тестов имейл;
- не е изпратен имейл към пълния списък.

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 8 — Unsubscribe support

Цел: да се добави базова unsubscribe функционалност.

Задачи:

- unsubscribe token handling;
- newsletter subscription fields или одобрена алтернатива;
- public unsubscribe endpoint.

Проверка:

- тест с един user;
- user става unsubscribed;
- timestamp се записва;
- endpoint връща проста confirmation страница.

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 9 — Broadcast sending MVP

Цел: да се разреши реално broadcast изпращане в MVP вид.

Задачи:

- load broadcast;
- validate status;
- load recipients;
- skip invalid recipients;
- render template;
- send via Resend;
- create logs;
- update counters.

Ограничения:

- Без auto-send от hooks
- Само след изрично admin действие
- Предпочита се simple sequential или small-batch sending
- Структурата остава готова за бъдеща queue система

Проверка:

- първи тест с 2-3 test users;
- без пускане към пълния production list.

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 10 — Real campaign readiness

Цел: да се подготви първата реална кампания.

Преди реално изпращане трябва да се потвърдят:

- sender domain
- from email
- reply-to email
- unsubscribe footer
- recipient count
- test email rendering
- logs
- Resend limits

Проверка:

- изпращане само след изрично human approval.

Стоп условие: спиране и изчакване за одобрение преди full-list broadcast.
