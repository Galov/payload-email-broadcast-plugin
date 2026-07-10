import type { GlobalConfigLike } from "../types.js";

export const emailSettingsGlobal: GlobalConfigLike = {
  slug: "email-settings",
  label: "Email Settings",
  admin: {
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
