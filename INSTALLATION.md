# Installation and Site Configuration

Този документ описва как се инсталира `payload-email-broadcast-plugin` в конкретен Payload сайт и кои настройки се правят веднага след това.

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

## 6. Payload import map

Плъгинът има custom admin компоненти. След инсталация или update пусни:

```bash
pnpm payload generate:importmap
```

Без това бутоните в Payload admin може да не се заредят.

## 7. Jobs runner

Реалното broadcast изпращане използва Payload Jobs queue.

Плъгинът създава jobs, но конкретният сайт трябва да има jobs runner, който ги изпълнява.

Ако няма jobs runner, админът ще може да натисне `Изпрати реално`, кампанията ще стане `queued`, но имейлите няма да тръгнат.

Queue name:

```txt
email-broadcasts
```

Task:

```txt
prepareEmailBroadcast
processEmailBroadcastBatch
```

### 7.1. Примерен runner endpoint за Next.js/Payload

Най-универсалният подход е host проектът да има защитен endpoint, който стартира чакащите jobs.

Примерен файл:

```txt
src/app/api/email-broadcast-jobs/run/route.ts
```

Примерен код:

```ts
import config from '@payload-config'
import { getPayload } from 'payload'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${process.env.EMAIL_JOBS_RUNNER_SECRET}`

  if (!process.env.EMAIL_JOBS_RUNNER_SECRET || authHeader !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })

  const result = await payload.jobs.run({
    queue: 'email-broadcasts',
    limit: 10,
    sequential: true,
  })

  return Response.json({ ok: true, result })
}
```

Добави secret в `.env`:

```env
EMAIL_JOBS_RUNNER_SECRET=some-long-random-string
```

`limit: 10` тук означава колко Payload jobs да се обработят при едно извикване на runner-а. Това не е брой имейли. Един plugin job обработва batch от получатели.

`sequential: true` означава jobs да се изпълняват един след друг. Това е по-бавно, но по-безопасно за email sending.

### 7.2. Локален тест

Когато сайтът върви локално, например на `http://localhost:3000`, можеш ръчно да стартираш runner-а така:

```bash
curl -X POST http://localhost:3000/api/email-broadcast-jobs/run \
  -H "Authorization: Bearer $EMAIL_JOBS_RUNNER_SECRET"
```

Практическият локален тест е:

1. Създай малка тестова група.
2. Създай кампания към тази група.
3. Натисни `Изпрати реално`.
4. Провери, че кампанията става `queued`.
5. Провери, че в `Имейл логове` има записи със статус `pending`.
6. Пусни `curl` командата.
7. Провери, че логовете минават към `sent` или `failed`.

Ако има повече чакащи jobs, пусни `curl` командата още веднъж.

### 7.3. Vercel

На Vercel няма постоянен Node процес. Затова runner-ът трябва да се стартира през Vercel Cron.

Добави `EMAIL_JOBS_RUNNER_SECRET` във Vercel Environment Variables.

Добави `vercel.json` в root-а на host проекта, ако проектът още няма такъв:

```json
{
  "crons": [
    {
      "path": "/api/email-broadcast-jobs/run",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Това извиква endpoint-а на всеки 5 минути.

Важно: Vercel Cron няма автоматично да добави твоя `Authorization` header. Затова за Vercel има два практични варианта:

- Да направиш endpoint-а да приема secret през query string, например `/api/email-broadcast-jobs/run?secret=...`.
- Да използваш външен cron service, който може да изпраща custom headers.

Ако използваш query string, endpoint-ът може да проверява така:

```ts
const url = new URL(request.url)
const secret = url.searchParams.get('secret')

if (!process.env.EMAIL_JOBS_RUNNER_SECRET || secret !== process.env.EMAIL_JOBS_RUNNER_SECRET) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
```

Тогава cron path-ът във `vercel.json` става:

```json
{
  "crons": [
    {
      "path": "/api/email-broadcast-jobs/run?secret=some-long-random-string",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

За публичен проект е по-добре да се документират и двата варианта, но да се препоръча външен cron с header, когато сигурността е по-важна.

### 7.4. VPS / Hetzner

На VPS има постоянна среда, затова настройката е по-гъвкава. Най-простият вариант е server cron, който извиква runner endpoint-а.

Примерен cron:

```cron
*/5 * * * * curl -fsS -X POST https://example.com/api/email-broadcast-jobs/run -H "Authorization: Bearer some-long-random-string" >/dev/null 2>&1
```

Това стартира jobs runner-а на всеки 5 минути.

Ако сайтът е зад reverse proxy и cron-ът се изпълнява на същия сървър, може да се използва локален адрес:

```cron
*/5 * * * * curl -fsS -X POST http://127.0.0.1:3000/api/email-broadcast-jobs/run -H "Authorization: Bearer some-long-random-string" >/dev/null 2>&1
```

По-късно може да се направи и постоянен worker процес, но cron е достатъчен за първа production версия.

### 7.5. Как се проверява дали runner-ът работи

След натискане на `Изпрати реално` трябва да видиш:

- кампанията става `queued`;
- в `Имейл логове` се появяват `pending` записи;
- след стартиране на runner-а част от записите стават `sending`;
- после стават `sent` или `failed`;
- когато няма повече `pending`, кампанията става `sent` или `failed`.

Тази настройка е задължителна за реални broadcast кампании.

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

Накрая създай `Имейл кампания`, избери шаблон, избери режим на получателите и запази.

## 9. Проверка преди реално изпращане

Първо винаги използвай `Изпрати тестов имейл`.

Тестовият имейл отива само до `Имейл за тестове` от `Имейл настройки`.

Реалният бутон показва pre-send summary, изисква потвърждение и поставя кампанията в Jobs queue.

Преди реално изпращане провери броя крайни получатели и пропуснатите записи.

Реално изпращане става само след ръчно потвърждение с:

```txt
ИЗПРАТИ
```

### 9.1. Dry-run тест без реални имейли

За тест на queue flow с много получатели може временно да включиш `dryRun` в plugin config:

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

При `dryRun: true` реалният broadcast flow създава logs, queue-ва jobs и маркира получателите като `sent`, но не изпраща имейли през Resend.

Тестовият бутон `Изпрати тестов имейл` остава реален и продължава да праща към `Имейл за тестове`.

Не оставяй `dryRun: true` в production конфигурация, когато очакваш реално изпращане.

## 10. Какво не трябва да се прави

Не използвай реална production база за първи тест без копие или контролирана група.

Не пускай реална кампания, ако jobs runner не е настроен и тестван.

Не слагай Resend API key в Payload admin.

Не пускай реална кампания без първо да си получил тестов имейл.
