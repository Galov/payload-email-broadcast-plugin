import type { GlobalConfig } from "payload";

export const emailSettingsGlobal: GlobalConfig = {
  slug: "email-settings",
  label: "Имейл настройки",
  admin: {
    group: "Кампании",
    description:
      "Основни настройки за изпращача и съдържанието във футъра. Тайните ключове не се пазят в базата.",
  },
  fields: [
    { name: "organizationName", label: "Име на организацията", type: "text" },
    { name: "defaultFromName", label: "Име на изпращача", type: "text" },
    { name: "defaultFromEmail", label: "Имейл на изпращача", type: "text" },
    { name: "defaultReplyTo", label: "Reply-To имейл", type: "text" },
    { name: "sendingDomain", label: "Домейн за изпращане", type: "text" },
    { name: "testRecipientEmail", label: "Имейл за тестове", type: "text" },
    { name: "footerText", label: "Текст във футъра", type: "textarea" },
  ],
};
