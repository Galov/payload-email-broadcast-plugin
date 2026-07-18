# TODO

## Текущ статус

Проектът има работещ Payload plugin skeleton, админ структури, шаблони, тестово изпращане, rich text съдържание, header/footer настройки, базова работа с групи и snapshot групи по критерии.

Старият реален broadcast flow минава през Payload Jobs queue и `resend.emails.send()` по получател. Този модел вече е deprecated, защото Resend го третира като transactional sending.

Следващата цел е migration към Resend Contacts, Segments и Broadcast API.

## Предстоящ ред на работа

1. Да се използва `.ai/IMPLEMENTATION_PLAN.md` като водещ ред за изпълнение.
2. Да се започне от Фаза 12 — Resend Broadcast architecture migration docs.
3. След всяка фаза да се пуснат описаните проверки.
4. След всяка фаза да се спре и да се даде отчет.

## Критични предпазни условия

- Да не се изпращат реални broadcast имейли без изрично потвърждение.
- Да не се използва старият batch sender за production marketing/newsletter кампании.
- Да не се прескачат фази.
- Да не се имплементират бъдещи фази предварително.
- Да не се пазят API keys в базата данни.
- Да не се hardcode-ват project-specific полета.
- Да не се правят commit, tag или push без изрична инструкция.
- Да не се променя send моделът без да се обнови документацията.

## Следващи задачи

- Да се финализира документационната migration фаза.
- Да се добави Resend provider layer за Contacts, Segments и Broadcasts.
- Да се мигрира data model-ът към `resendSegmentId`, `resendBroadcastId` и sync statuses.
- Да се направи contact/segment sync flow.
- Да се направи create broadcast draft flow.
- Да се направи send broadcast flow.
- Да се премахне production зависимостта от cron/job runner.
- Да се пренапише `INSTALLATION.md` за новия Resend Broadcast модел.

## Отложени задачи

- Live dynamic groups.
- Bulk add към вече съществуваща група.
- Resend Topics за по-фина subscription логика.
- Webhooks от Resend за delivery/open/click/unsubscribe audit.
- Публична npm версия.
