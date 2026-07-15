# Decisions

## Взети решения

1. Проектът се реализира като преизползваем Payload v3 plugin, а не като project-specific модул.
2. Provider за изпращане в първата версия е Resend.
3. Secret конфигурацията, включително `RESEND_API_KEY`, остава в code/environment и не се пази в базата данни.
4. Административно променимите sender настройки се пазят в `Email Settings` Global.
5. Изпращането на broadcast става само след изрично admin действие. То не трябва да се задейства автоматично от hooks.
6. Реалното broadcast изпращане трябва да използва Payload Jobs queue, а не директно изпращане в рамките на една HTTP заявка.
7. Queue-ът за broadcast jobs се казва `email-broadcasts`.
8. Историята на изпращането се пази в `Email Logs` с по един запис на recipient.
9. Marketing broadcast трябва да уважава newsletter subscription статуса и да поддържа unsubscribe flow.
10. Реални масови кампании не трябва да се изпращат без изрично човешко одобрение.
11. Началният batch size за broadcast jobs е `25`.
12. Началният retry лимит за broadcast jobs е `2`.
13. `Email Logs` е source of truth за progress и recovery при прекъснато изпращане.

## Отворени решения

1. Трябва да се потвърди дали user fields за newsletter да живеят директно в users collection, или е нужен по-чист Payload-specific алтернативен модел.
2. Трябва да се реши дали unsubscribe token-ите ще се генерират lazy, при subscription, или при първа нужда от broadcast.
3. Трябва да се уточни как host проектът стартира Payload Jobs на Vercel.
4. Трябва да се уточни препоръчителният runner/cron модел за Hetzner.
5. Трябва да се проектира advanced recipient groups UI.

## Правила за изпълнение

1. Codex трябва да изпълнява implementation plan-а фаза по фаза.
2. След всяка фаза трябва да има проверка, отчет и стоп преди следващата фаза.
3. Не трябва да се имплементират бъдещи фази предварително.
