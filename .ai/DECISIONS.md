# Decisions

## Взети решения

1. Проектът се реализира като преизползваем Payload v3 plugin, а не като project-specific модул.
2. Provider за email инфраструктурата е Resend.
3. Secret конфигурацията, включително `RESEND_API_KEY`, остава в code/environment и не се пази в базата данни.
4. Административно променимите sender настройки се пазят в `Email Settings` Global.
5. Изпращането на реален broadcast става само след изрично admin действие.
6. Реални масови кампании не трябва да се изпращат без изрично човешко одобрение.
7. Групите по критерии в първата версия са snapshot групи, не live dynamic queries.
8. Host проектът избира позволените criteria fields чрез `groupFilterFields`, за да няма project-specific hardcode в plugin-а.
9. Plugin-ът трябва да infer-ва label, type и `select`/`radio` options от recipient collection config, когато може.
10. Реалните marketing/newsletter кампании трябва да се изпращат чрез Resend Broadcast API.
11. Plugin-ът не трябва да изпраща реални broadcast recipients един по един чрез `resend.emails.send()`.
12. `resend.emails.send()` остава допустим за единичен тестов имейл.
13. Payload recipient аудиторията трябва да се материализира като Resend Segment преди реално изпращане.
14. Получателите трябва да се синхронизират като Resend Contacts.
15. Resend Broadcast е source of truth за реалното изпращане.
16. Старият Payload Jobs batch sender е deprecated като production broadcast model.
17. Cron/job runner вече не трябва да бъде задължителна част от production installation.

## Отворени решения

1. Трябва да се реши дали plugin-ът да използва Resend SDK или директен REST `fetch` за Contacts/Segments/Broadcasts.
2. Трябва да се реши дали всеки Payload broadcast винаги създава нов Resend Segment, или може да преизползва вече съществуващ Segment.
3. Трябва да се реши дали unsubscribe ще бъде само глобален Resend `unsubscribed`, или ще ползваме Resend Topics за по-фина subscription логика.
4. Трябва да се реши какви custom Contact Properties да поддържа plugin config-ът.
5. Трябва да се реши какъв progress/status UI да се показва след създаване и изпращане на Resend Broadcast.
6. Трябва да се реши дали advanced groups по-късно трябва да поддържат nested fields, relationships и array fields.

## Правила за изпълнение

1. Codex трябва да изпълнява implementation plan-а фаза по фаза.
2. След всяка фаза трябва да има проверка, отчет и стоп преди следващата фаза.
3. Не трябва да се имплементират бъдещи фази предварително.
4. Не трябва да се праща реален broadcast без изрично потвърждение.
5. Не трябва да се прави commit, tag или push без изрична инструкция.
