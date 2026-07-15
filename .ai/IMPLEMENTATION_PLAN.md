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

## Фаза 9 — Broadcast queue foundation

Цел: да се замени директното real broadcast изпращане с надежден Payload Jobs модел.

Задачи:

- регистриране на Payload Jobs task `processEmailBroadcastBatch`;
- регистриране на Payload Jobs task `prepareEmailBroadcast`;
- използване на queue `email-broadcasts`;
- добавяне на `queued` статус за кампания;
- добавяне на `pending`, `sending`, `sent`, `failed`, `skipped` статуси за `email-logs`;
- промяна на real send endpoint-а така, че да queue-ва prepare job и да не върши тежка работа в HTTP заявката;
- batch processing с начален batch size `25`;
- retry настройка с начален лимит `2`;
- защита срещу повторно изпращане към вече `sent` получател;
- обновяване на campaign counters след всеки batch.

Ограничения:

- Без auto-send от hooks
- Само след изрично admin действие
- Без изпращане към пълен production list преди отделно човешко одобрение
- Без commit/tag/push без изрична инструкция

Проверка:

- build минава;
- real send към малка тестова група queue-ва job;
- prepare job създава logs като `pending`;
- task обработва batch и маркира logs като `sent` или `failed`;
- повторно стартиране не изпраща повторно към `sent` получатели;
- кампанията показва коректен progress.

Стоп условие: спиране и отчет след завършване на фазата.

## Фаза 10 — Large broadcast readiness

Цел: да се подготви безопасно изпращане към големи групи и режим `all`.

Задачи:

- разрешаване на големи recipient sets само след стабилен queue flow;
- потвърждение, че големите recipient sets минават през Jobs queue след explicit admin confirmation;
- проверка на batch size спрямо Resend и hosting средата;
- настройка/описание как jobs се стартират на Vercel;
- настройка/описание как jobs се стартират на Hetzner;
- ясна admin индикация за progress и крайно състояние;
- документиране на recovery поведение при прекъснат процес.

Преди първо голямо изпращане трябва да се потвърдят:

- sender domain
- from email
- reply-to email
- recipient count
- test email rendering
- logs
- Resend limits
- Payload Jobs runner/cron

Проверка:

- тест с малка група;
- тест с по-голяма контролирана група;
- пълно изпращане само след изрично human approval.

Стоп условие: спиране и изчакване за одобрение преди full-list broadcast.

## Фаза 11 — Advanced recipient groups

Цел: да се добави по-софистицирано създаване и поддръжка на групи получатели.

Задачи:

- bulk добавяне към група;
- създаване на група по критерии;
- preview преди материализиране на групата;
- защита срещу duplicate recipients;
- документиране на разликата между статични и бъдещи динамични групи.

Проверка:

- група се създава по избран критерий;
- админът вижда preview преди запис;
- real send към група използва същия Payload Jobs механизъм.

Стоп условие: спиране и отчет след завършване на фазата.
