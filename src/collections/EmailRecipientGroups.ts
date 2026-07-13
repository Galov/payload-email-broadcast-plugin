import type { CollectionConfig } from "payload";

export const createEmailRecipientGroupsCollection = (
  recipientsCollection: string,
): CollectionConfig => ({
  slug: "email-recipient-groups",
  labels: {
    singular: "Имейл група",
    plural: "Имейл групи",
  },
  admin: {
    useAsTitle: "name",
    group: "Кампании",
    description:
      "Групи от получатели, които могат да се използват в имейл кампании.",
  },
  fields: [
    {
      name: "name",
      label: "Име",
      type: "text",
      required: true,
    },
    {
      name: "description",
      label: "Описание",
      type: "textarea",
    },
    {
      name: "recipients",
      label: "Получатели",
      type: "relationship",
      relationTo: recipientsCollection,
      hasMany: true,
      required: true,
      admin: {
        description:
          "Избери хората, които принадлежат към тази група. Дублираните имейли ще бъдат премахнати при изпращане.",
      },
    },
  ],
});
