# Installation and Site Configuration

Този документ описва как се инсталира `payload-email-broadcast-plugin` в Payload v3 сайт и как се настройва за конкретна recipient collection.

Версия `1.0.0` използва production модел с Resend Contacts, Segments и Broadcasts. Реалните кампании не се изпращат като отделни transactional имейли.

## 1. Преди инсталация

В Resend трябва да има:

- активен API key;
- верифициран sending domain;
- позволен sender адрес, например `info@reddevils.bg`;
- по желание включен open/click tracking от настройките на домейна в Resend.

Tracking настройката не пречи на изпращането. Тя влияе само върху статистиките за отваряния и кликове.

## 2. Инсталация

Докато пакетът не е публикуван в npm, инсталацията става от GitHub.

Препоръчителният production вариант е към конкретен tag:

```bash
pnpm add github:Galov/payload-email-broadcast-plugin#v1.0.0
```

За локален тестов проект може да се използва file dependency:

```bash
pnpm add ../payload-email-broadcast-plugin
```

След инсталация задължително регенерирай Payload import map:

```bash
pnpm payload generate:importmap
```

Без тази команда custom бутоните в Payload admin може да не се заредят.

## 3. Environment настройки

В `.env` на сайта добави:

```env
RESEND_API_KEY=re_...
NEXT_PUBLIC_SITE_URL=https://www.example.com
```

`RESEND_API_KEY` не трябва да се пази в Payload admin или в базата.

`NEXT_PUBLIC_SITE_URL` трябва да е публичният адрес на сайта без slash накрая. Plugin-ът го използва, за да превърне media URL-и като `/api/media/file/...` в абсолютни URL-и, които email клиентите могат да заредят.

За RDBG стойността е:

```env
NEXT_PUBLIC_SITE_URL=https://www.reddevils.bg
```

## 4. Payload config

В `payload.config.ts` добави plugin-а в `plugins`.

Минимален пример:

```ts
import { emailBroadcastPlugin } from 'payload-email-broadcast-plugin'

export default buildConfig({
  // ...
  plugins: [
emailBroadcastPlugin({
      recipientsCollection: 'members',
      recipientFields: {
        email: 'email',
        firstName: 'name',
      },
      resendApiKey: process.env.RESEND_API_KEY || '',
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '',
    }),
  ],
})
```

За RDBG получателите са в `members`, не в `users`.

`usersCollection` остава като backward-compatible alias, но за нови инсталации използвай `recipientsCollection`.

## 5. Полета на получателя

`recipientsCollection` е slug-ът на колекцията с хората, до които може да се изпраща.

`recipientFields.email` е задължително поле. То трябва да сочи към имейл адреса.

`recipientFields.firstName` попълва `{{ firstName }}` в тестовите имейли и `{{{contact.first_name|}}}` в Resend Broadcast.

`recipientFields.lastName` се задава само ако сайтът има отделно поле за фамилия.

Ако сайтът има boolean поле за абонамент, добави го:

```ts
emailBroadcastPlugin({
  recipientsCollection: 'members',
  recipientFields: {
    email: 'email',
    firstName: 'name',
  },
  subscriptionField: 'newsletterSubscribed',
  resendApiKey: process.env.RESEND_API_KEY || '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '',
})
```

Ако `subscriptionField` липсва, режимът `Абонирани` не трябва да се използва като бизнес гаранция.

## 6. Групи по критерии

`groupFilterFields` определя по кои полета админът може да създава snapshot групи.

Пример:

```ts
emailBroadcastPlugin({
  recipientsCollection: 'members',
  recipientFields: {
    email: 'email',
    firstName: 'name',
  },
  groupFilterFields: ['membershipStatus', 'membershipYear', 'createdAt'],
  resendApiKey: process.env.RESEND_API_KEY || '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '',
})
```

Plugin-ът се опитва сам да вземе label, type и опциите за `select`/`radio` от Payload collection config.

Ако трябва ръчно уточнение, използвай object config:

```ts
groupFilterFields: [
  {
    name: 'membershipStatus',
    label: 'Статус на членството',
  },
  {
    name: 'membershipYear',
    label: 'Година на членство',
    type: 'number',
  },
]
```

Поддържат се top-level полета от тип `text`, `email`, `number`, `date`, `checkbox`, `select` и `radio`.

Групите по критерии са snapshot. Това означава, че plugin-ът записва конкретните получатели в момента на създаване на групата. Групата не се променя автоматично по-късно.

## 7. Resend custom properties

Ако сайтът иска да праща допълнителни данни към Resend Contacts, използвай `resendContactProperties`.

```ts
emailBroadcastPlugin({
  recipientsCollection: 'members',
  recipientFields: {
    email: 'email',
    firstName: 'name',
  },
  resendContactProperties: [
    {
      field: 'membershipStatus',
      property: 'membership_status',
    },
  ],
  resendApiKey: process.env.RESEND_API_KEY || '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '',
})
```

`field` е полето в Payload recipient collection.

`property` е името на custom property в Resend.

## 8. Настройки в Payload admin

След стартиране на сайта отвори Payload admin и попълни `Кампании -> Имейл настройки`.

Минимално нужни полета:

- `Име на изпращача`
- `Имейл на изпращача`
- `Reply-To имейл`
- `Имейл за тестове`

Пример за RDBG:

```txt
Име на изпращача: Red Devils Bulgaria
Имейл на изпращача: info@reddevils.bg
Reply-To имейл: reddevilsbulgaria@gmail.com
Имейл за тестове: личен контролиран адрес
```

`Имейл на изпращача` трябва да е позволен от Resend за верифицирания домейн.

## 9. Първоначално съдържание

Създай поне един `Имейл шаблон`.

В шаблона попълни:

- тема;
- preview текст;
- rich text съдържание;
- header лого или header заглавие;
- основен цвят;
- фон;
- footer.

След това създай `Имейл група`, ако ще изпращаш до подбран списък.

Групата може да бъде ръчна или създадена по критерии.

## 10. Ред за изпращане в админа

В `Имейл кампании` админът работи в този ред:

1. Създава кампания и я записва.
2. Натиска `1. Изпрати тестов имейл`.
3. Проверява получения тестов имейл.
4. Натиска `2. Подготви получателите`.
5. Проверява броя получатели в потвърждението.
6. Натиска `3. Подготви имейла`.
7. Натиска `4. Изпрати реално`, само ако всичко е проверено.

Plugin-ът показва бутоните поетапно. Завършените стъпки остават видими като неактивни бутони.

Реално изпращане става само след ръчно потвърждение с:

```txt
ИЗПРАТИ
```

## 11. Как работи реалното изпращане

При `2. Подготви получателите` plugin-ът:

- избира получателите според режима на кампанията;
- премахва дублирани имейли;
- пропуска записи без имейл;
- създава или обновява Resend Contacts;
- създава Resend Segment за тази кампания;
- добавя получателите към този Segment.

При `3. Подготви имейла` plugin-ът създава Resend Broadcast чернова към подготвения Segment.

При `4. Изпрати реално` plugin-ът казва на Resend да изпрати Broadcast-а.

Тестовият имейл е отделен. Той се праща само до `Имейл за тестове` и не използва получателите на кампанията.

## 12. Hosting бележки

### Локално

В локална среда е нормално изображенията в Resend preview да сочат към `localhost`, ако `NEXT_PUBLIC_SITE_URL` е локален адрес.

За реален production тест `NEXT_PUBLIC_SITE_URL` трябва да сочи към публичния сайт.

### Vercel

Във Vercel добави environment variables за production:

```env
RESEND_API_KEY=re_...
NEXT_PUBLIC_SITE_URL=https://www.example.com
```

След промяна на dependency версията към нов tag, commit-ни и push-ни host проекта. Vercel ще направи нов build.

Ако plugin update добавя или променя custom admin компоненти, пусни `pnpm payload generate:importmap` преди commit-а.

### VPS / Hetzner

На VPS добави същите environment variables в начина, по който процесът се стартира.

Пример с `.env`:

```env
RESEND_API_KEY=re_...
NEXT_PUBLIC_SITE_URL=https://www.example.com
```

След update на plugin-а изпълни:

```bash
pnpm install
pnpm payload generate:importmap
pnpm build
```

После рестартирай Node процеса или process manager-а, например `pm2`, `systemd` или Docker service.

## 13. Какво не трябва да се прави

Не изпращай реална кампания без получен и проверен тестов имейл.

Не изпращай към `Всички` като първи production тест. Първият реален тест трябва да бъде към малка контролирана група.

Не пази Resend API key в Payload admin.

Не използвай стар jobs/cron sender за marketing/newsletter кампании.
