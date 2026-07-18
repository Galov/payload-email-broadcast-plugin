# Installation and Site Configuration

Този документ описва как се инсталира `payload-email-broadcast-plugin` в конкретен Payload сайт и кои настройки се правят веднага след това.

## Важно: документът е в migration

До `v0.1.8` plugin-ът имаше работещ batch sender през Payload Jobs и `resend.emails.send()`.

Този модел вече е deprecated за реални marketing/newsletter кампании, защото Resend го третира като transactional sending.

Новият production модел трябва да използва Resend Contacts, Segments и Broadcast API.

Докато migration-ът не завърши:

- `Изпрати тестов имейл` може да се използва;
- групи, шаблони и preview могат да се използват;
- реални broadcast кампании през стария batch sender не трябва да се пускат в production.

## 1. Инсталация

Докато плъгинът не е публикуван в npm, инсталацията става от GitHub:

```bash
pnpm add git+ssh://git@github.com/Galov/payload-email-broadcast-plugin.git
```

За локален тестов проект може да се използва и file dependency:

```bash
pnpm add ../payload-email-broadcast-plugin
```

За production сайт е препоръчително dependency-то да сочи към конкретен tag, например:

```bash
pnpm add github:Galov/payload-email-broadcast-plugin#v0.1.4
```

## 2. Environment настройки

В сайта добави Resend API key в `.env`:

```env
RESEND_API_KEY=re_...
NEXT_PUBLIC_SITE_URL=https://www.reddevils.bg
```

Не пази Resend API key в Payload admin или в базата.

`NEXT_PUBLIC_SITE_URL` се използва, за да могат изображенията в имейлите да получат абсолютен URL. Без него email клиентите няма да могат да заредят относителни media URL-и като `/api/media/file/...`.

## 3. Payload config

В `payload.config.ts` добави plugin-а в `plugins`.

Пример за RDBG, където получателите са в `members`:

```ts
import { emailBroadcastPlugin } from 'payload-email-broadcast-plugin'
import { Members } from './collections/Members'

export default buildConfig({
  // ...
  plugins: [
    emailBroadcastPlugin({
      usersCollection: Members.slug,
      recipientFields: {
        email: 'email',
        firstName: 'name',
      },
      groupFilterFields: ['membershipStatus', 'membershipYear', 'createdAt'],
      resendApiKey: process.env.RESEND_API_KEY || '',
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.reddevils.bg',
    }),
  ],
})
```

Ако сайтът има поле за subscription статус, добави го:

```ts
emailBroadcastPlugin({
  usersCollection: Members.slug,
  recipientFields: {
    email: 'email',
    firstName: 'name',
  },
  subscriptionField: 'newsletterSubscribed',
  resendApiKey: process.env.RESEND_API_KEY || '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.reddevils.bg',
})
```

## 4. Как се избира правилната конфигурация за конкретен сайт

`usersCollection` е slug-ът на колекцията, към която ще се изпраща. В RDBG това е `members`, не `users`.

`recipientFields.email` е полето с имейл адреса. То е задължително.

`recipientFields.firstName` е полето, което ще попълва `{{ firstName }}`. В RDBG засега това е `name`.

`recipientFields.lastName` се задава само ако сайтът има отделно поле за фамилия.

`subscriptionField` се задава само ако сайтът има реално boolean поле за абонамент. Ако липсва, не го добавяй.

`siteUrl` трябва да е публичният адрес на сайта без slash накрая. За RDBG това е `https://www.reddevils.bg`.

`groupFilterFields` определя по кои полета админът може да създава имейл групи по критерии. Това не трябва да включва всяко поле от колекцията, а само безопасните и смислени за сегментиране полета.

Минималният вариант е списък с field names:

```ts
groupFilterFields: ['membershipStatus', 'membershipYear', 'createdAt']
```

Plugin-ът ще се опита сам да вземе label, type и опциите за `select`/`radio` от Payload collection config.

Ако искаш да override-неш label или options, използвай object config:

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

Първата версия поддържа top-level полета от тип `text`, `email`, `number`, `date`, `checkbox`, `select` и `radio`.

## 5. Настройки в Payload admin след инсталация

След стартиране на сайта отвори Payload admin и попълни `Кампании -> Имейл настройки`.

Минимално нужни полета:

- `Име на изпращача`
- `Имейл на изпращача`
- `Reply-To имейл`
- `Имейл за тестове`

Пример за RDBG:

```txt
Име на изпращача: Red Devils Bulgaria
Имейл на изпращача: адресът, верифициран в Resend
Reply-To имейл: reddevilsbulgaria@gmail.com
Имейл за тестове: личен контролиран адрес
```

`Текст във футъра` е само plain text fallback. Красив footer с линкове се прави в `Имейл шаблони -> Визия -> Футър`.

## 6. Payload import map

Плъгинът има custom admin компоненти. След инсталация или update пусни:

```bash
pnpm payload generate:importmap
```

Без това бутоните в Payload admin може да не се заредят.

## 7. Real broadcast sending

Production broadcast sending е в migration.

Старият модел с Payload Jobs runner и cron вече не е целевият модел. Той ще бъде заменен с Resend Contacts, Segments и Broadcast API.

След migration-а реалният flow трябва да бъде:

1. Админът създава кампания в Payload.
2. Админът проверява recipient summary.
3. Plugin-ът sync-ва получателите като Resend Contacts.
4. Plugin-ът създава Resend Segment за кампанията.
5. Plugin-ът създава Resend Broadcast draft към този segment.
6. Админът потвърждава реално изпращане.
7. Resend изпраща Broadcast-а.

Докато тази migration не е завършена, не пускай production broadcast кампании през стария jobs/cron модел.

## 8. Първоначална настройка на съдържанието

След `Имейл настройки` създай поне един `Имейл шаблон`.

В шаблона попълни:

- тема;
- preview текст;
- rich text съдържание;
- header лого или header заглавие;
- основен цвят;
- фон;
- footer.

След това създай `Имейл група`, ако ще изпращаш до подбран списък от членове.

Групата може да бъде:

- ръчна, чрез избор на конкретни получатели;
- snapshot група по критерии, ако `groupFilterFields` е настроено в plugin config.

Snapshot групата записва конкретните получатели в момента на създаването. Тя не се обновява автоматично, ако по-късно някой член промени статус или друго поле.

Накрая създай `Имейл кампания`, избери шаблон, избери режим на получателите и запази.

## 9. Проверка преди реално изпращане

Първо винаги използвай `Изпрати тестов имейл`.

Тестовият имейл отива само до `Имейл за тестове` от `Имейл настройки`.

Реалният бутон показва pre-send summary и изисква потвърждение. Production поведението му ще бъде мигрирано към Resend Broadcast API.

Преди реално изпращане провери броя крайни получатели и пропуснатите записи.

Реално изпращане става само след ръчно потвърждение с:

```txt
ИЗПРАТИ
```

### 9.1. Deprecated dry-run от стария модел

До `v0.1.8` plugin-ът поддържаше `dryRun` за стария queue flow:

```ts
emailBroadcastPlugin({
  usersCollection: Members.slug,
  recipientFields: {
    email: 'email',
    firstName: 'name',
  },
  dryRun: true,
  resendApiKey: process.env.RESEND_API_KEY || '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.reddevils.bg',
})
```

При `dryRun: true` старият broadcast flow създава logs, queue-ва jobs и маркира получателите като `sent`, но не изпраща имейли през Resend.

Този модел е deprecated за production кампании. След migration към Resend Broadcast API тестовият режим трябва да симулира sync към Contacts/Segment/Broadcast, а не batch изпращане през queue.

Тестовият бутон `Изпрати тестов имейл` остава реален и продължава да праща към `Имейл за тестове`.

Не оставяй `dryRun: true` в production конфигурация, когато очакваш реално изпращане.

## 10. Какво не трябва да се прави

Не използвай реална production база за първи тест без копие или контролирана група.

Не пускай реална кампания през стария jobs runner модел.

Не слагай Resend API key в Payload admin.

Не пускай реална кампания без първо да си получил тестов имейл.
