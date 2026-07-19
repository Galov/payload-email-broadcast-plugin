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

## Исторически статус

Фази 1-11 вече създадоха работещ Payload plugin с:

- collections/global;
- шаблони;
- тестово изпращане;
- rich text email renderer;
- header/footer настройки;
- recipient preview;
- groups и snapshot groups по критерии;
- стар Payload Jobs based batch sender.

Старият batch sender е deprecated, защото използва `resend.emails.send()` за реални кампании. Това кара Resend да ги третира като transactional sending.

Фази 12-20 мигрират реалното изпращане към Resend Broadcast API.

Към версия `1.0.0` основният Broadcast flow е реализиран: sync на получатели, създаване на Broadcast чернова и реално изпращане през Resend Broadcast API. Release tag се създава само след изрична инструкция.

## Фаза 12 — Resend Broadcast architecture migration docs

Цел: постоянната документация да посочи Resend Broadcast API като единствен валиден модел за реални кампании.

Задачи:

- обновяване на `.ai/ARCHITECTURE.md`;
- обновяване на `.ai/DECISIONS.md`;
- обновяване на `.ai/TODO.md`;
- отбелязване на стария Payload Jobs batch sender като deprecated;
- отбелязване, че cron/job runner вече не е целевият production модел;
- отбелязване, че `emails.send()` остава само за тестови имейли и евентуални service/transactional email-и.

Проверка:

- документацията не трябва да си противоречи;
- следващите фази трябва да са изпълними без неяснота.

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 13 — Resend API provider layer

Цел: да се добави provider слой за новия Resend модел.

Задачи:

- `createResendContact`;
- `updateResendContact`;
- `createResendSegment`;
- `addResendContactToSegment`;
- `createResendBroadcast`;
- `sendResendBroadcast`;
- нормализирано error handling;
- typed резултати с Resend IDs.

Решение:

- Ако текущият `resend` SDK поддържа нужните методи стабилно, може да се използва SDK.
- Ако SDK типизациите са непълни или несигурни, provider-ът трябва да използва директен `fetch` към Resend REST API.

Ограничения:

- Без промяна на admin UI;
- без реално изпращане;
- без премахване на стария flow в тази фаза.

Проверка:

```bash
npm run build
```

Стоп условие: спиране и отчет.

## Фаза 14 — Broadcast data model migration

Цел: `Email Broadcasts` и `Email Logs` да могат да пазят Resend Broadcast state.

Задачи:

- добавяне на `resendSegmentId`;
- добавяне на `resendBroadcastId`;
- добавяне на `resendBroadcastStatus`;
- добавяне на `resendLastSyncedAt`;
- добавяне на `resendLastError`;
- добавяне на sync counters: `syncedCount`, `skippedCount`, `syncFailedCount`;
- преработка на `Email Logs` към sync/audit статуса: `pending_sync | synced | skipped | failed`.

Ограничения:

- Без реално изпращане;
- без автоматично sync-ване от hooks;
- backward compatible полетата могат временно да останат.

Проверка:

- `npm run build`;
- локална инсталация в тестов Payload проект;
- admin формите се отварят без runtime errors.

Стоп условие: спиране и отчет.

## Фаза 15 — Recipient to Resend Contact mapping

Цел: Payload recipient данните да се превръщат в Resend Contact payload.

Задачи:

- mapping на `recipientFields.email`;
- mapping на `recipientFields.firstName`;
- mapping на `recipientFields.lastName`;
- mapping на `subscriptionField` към Resend `unsubscribed`;
- optional custom properties config;
- dedupe по email;
- skip на recipients без email.

Решение:

- Resend Contact е глобален по email.
- Plugin-ът трябва да може да update-ва contact по email.
- Segment membership трябва да се добавя отделно.

Проверка:

- unit-style helper тестове или малък script;
- `npm run build`.

Стоп условие: спиране и отчет.

## Фаза 16 — Segment sync flow

Цел: избраната Payload аудитория да се материализира като Resend Segment.

Задачи:

- endpoint/action `sync audience`;
- създаване на Resend Segment за кампанията;
- sync/update на всеки Resend Contact;
- add contact to segment;
- записване на sync audit logs;
- idempotency: повторен sync не трябва да дублира или чупи кампанията;
- dry-run mode за sync без реални Resend write calls.

Ограничения:

- Без `send` на Broadcast;
- без full-list production sync без explicit approval.

Проверка:

- dry-run sync към малка група;
- реален sync към малка тестова група в Resend;
- Resend dashboard показва contacts и segment.

Стоп условие: спиране и отчет.

## Фаза 17 — Broadcast creation

Цел: от Payload кампания да се създаде Resend Broadcast draft.

Задачи:

- rendering на subject/html/text за Resend Broadcast;
- mapping на template variables към Resend syntax;
- използване на `{{{RESEND_UNSUBSCRIBE_URL}}}`;
- create broadcast с `segmentId`;
- записване на `resendBroadcastId`;
- admin feedback при успех/грешка.

Ограничения:

- По подразбиране да се създава draft, не да се изпраща веднага;
- `send: true` да се използва само след отделно потвърждение.

Проверка:

- създаден draft Broadcast в Resend;
- HTML изглежда коректно;
- unsubscribe placeholder е Resend placeholder, не локален fake URL.

Стоп условие: спиране и отчет.

## Фаза 18 — Broadcast send/schedule

Цел: реалното изпращане да се задейства чрез Resend Broadcast API.

Задачи:

- real send button да изисква summary и потвърждение `ИЗПРАТИ`;
- проверка, че има `resendSegmentId`;
- проверка, че има `resendBroadcastId`;
- send now чрез Resend Broadcast API;
- по-късно optional schedule;
- update на Payload campaign status.

Ограничения:

- Без стария Payload Jobs runner;
- без per-recipient `emails.send`;
- без режим `all` в production преди отделно одобрение.

Проверка:

- реален Broadcast към малка тестова група;
- Resend отчита изпращането като Broadcast;
- получателите получават имейла;
- unsubscribe link е Resend link.

Стоп условие: спиране и отчет.

## Фаза 19 — Remove/deprecate old batch sender

Цел: старият batch sender да не може да бъде използван случайно за marketing campaigns.

Задачи:

- премахване или hard-disable на `processEmailBroadcastBatch` за real broadcast;
- премахване на cron/job runner instructions от актуалната installation документация;
- ясно разделяне:
  - test email: `emails.send`;
  - real broadcast: Broadcast API.

Проверка:

- build;
- няма admin път, който праща campaign recipients през `emails.send`.

Статус: изпълнена за `v1.0.0`. Старият endpoint, jobs tasks и batch helper-и са премахнати от `src`.

## Фаза 20 — Documentation and release

Цел: новият модел да е описан като production-ready installation guide.

Задачи:

- пренаписване на `INSTALLATION.md`;
- migration notes от `v0.1.8`;
- списък с Resend prerequisites;
- setup на API key;
- setup на verified sender/domain;
- setup на първи тестов Segment;
- release tag.

Проверка:

- документацията може да се следва от админ без дълбоки технически знания;
- няма останали инструкции за cron като задължителна част от production install.

Статус: installation документацията е обновена за `v1.0.0`. Release tag се прави само след изрична инструкция.
