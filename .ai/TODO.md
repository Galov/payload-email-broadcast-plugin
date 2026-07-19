# TODO

## Текущ статус

Проектът има работещ Payload v3 plugin за Resend Broadcast кампании.

Налични са:

- Payload admin структури за кампании, шаблони, групи, логове и настройки;
- тестово изпращане към един контролиран адрес;
- rich text съдържание с изображения;
- header/footer настройки;
- ръчни групи;
- snapshot групи по критерии;
- sync на получатели към Resend Contacts и Segment;
- създаване на Resend Broadcast чернова;
- реално изпращане през Resend Broadcast API;
- installation guide за production настройка.

Старият batch sender през Payload Jobs и `resend.emails.send()` не е production модел за marketing/newsletter кампании.

## Критични предпазни условия

- Реални broadcast имейли не се изпращат без изрично потвърждение.
- Първи production тест се прави само към малка контролирана група.
- API keys не се пазят в Payload admin или в базата.
- Project-specific recipient полета се подават през plugin config, не се hardcode-ват.
- Commit, tag и push се правят само след изрична инструкция.
- Всяка промяна в send модела трябва да обновява `INSTALLATION.md`.

## Следващи задачи

- Да се добави по-добър preview/статус в Payload admin, ако админът няма достъп до Resend dashboard.
- Да се добави optional scheduling през Resend Broadcast API.
- Да се добавят Resend webhooks за delivery/open/click/unsubscribe audit.
- Да се добавят по-удобни bulk инструменти за групи.
- Да се подготви публична npm публикация, ако plugin-ът се стабилизира в реална употреба.

## Отложени задачи

- Live dynamic groups.
- Resend Topics за по-фина subscription логика.
- По-богати analytics screens в Payload admin.
