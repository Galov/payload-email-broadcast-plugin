# Installation and Site Configuration

Този документ описва как се инсталира `payload-email-broadcast-plugin` в конкретен Payload сайт и кои настройки се правят веднага след това.

## 1. Инсталация

Докато плъгинът е private GitHub repo и не е публикуван в npm, инсталацията става от GitHub:

```bash
pnpm add git+ssh://git@github.com/Galov/payload-email-broadcast-plugin.git
```

За локален тестов проект може да се използва и file dependency:

```bash
pnpm add ../payload-email-broadcast-plugin
```

Проектът, който инсталира плъгина, трябва да има достъп до private repo-то.

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

## 6. Първоначална настройка на съдържанието

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

Накрая създай `Имейл кампания`, избери шаблон, избери режим на получателите и запази.

## 7. Проверка преди реално изпращане

Първо винаги използвай `Изпрати тестов имейл`.

Тестовият имейл отива само до `Имейл за тестове` от `Имейл настройки`.

Реалният бутон засега работи само за:

- `Ръчно избрани`
- `Групи`

Преди реално изпращане plugin-ът показва pre-send summary. Провери броя крайни получатели и пропуснатите записи.

Реално изпращане става само след ръчно потвърждение с:

```txt
ИЗПРАТИ
```

## 8. Какво не трябва да се прави

Не използвай реална production база за първи тест без копие или контролирана група.

Не изпращай към `Всички` или `Абонирани`, докато тези режими не бъдат изрично отключени и тествани.

Не слагай Resend API key в Payload admin.

Не пускай реална кампания без първо да си получил тестов имейл.
