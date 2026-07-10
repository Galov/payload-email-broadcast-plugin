import type { GlobalConfig } from "payload";

export const emailSettingsGlobal: GlobalConfig = {
  slug: "email-settings",
  label: "Email Settings",
  admin: {
    group: "Broadcasts",
    description:
      "Admin-managed sender defaults and footer content. Secret credentials stay outside the database.",
  },
  fields: [
    { name: "organizationName", type: "text" },
    { name: "defaultFromName", type: "text" },
    { name: "defaultFromEmail", type: "text" },
    { name: "defaultReplyTo", type: "text" },
    { name: "sendingDomain", type: "text" },
    { name: "testRecipientEmail", type: "text" },
    { name: "footerText", type: "textarea" },
  ],
};
