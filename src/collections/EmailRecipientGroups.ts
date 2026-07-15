import { canAccessAdmin, type CollectionConfig, type Endpoint } from "payload";
import {
  buildSnapshotWhere,
  type SnapshotFilterField,
  type SnapshotFilterRule,
} from "../utils/groupFilters.js";

const getRelationshipId = (doc: Record<string, unknown>): number | string | null => {
  if (typeof doc.id === "string" || typeof doc.id === "number") {
    return doc.id;
  }

  return null;
};

const loadSnapshotRecipientIds = async ({
  recipientsCollection,
  req,
  where,
}: {
  recipientsCollection: string;
  req: Parameters<Endpoint["handler"]>[0];
  where: NonNullable<ReturnType<typeof buildSnapshotWhere>>;
}) => {
  const recipientIds: Array<number | string> = [];
  const limit = 200;
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await req.payload.find({
      collection: recipientsCollection,
      depth: 0,
      limit,
      overrideAccess: true,
      page,
      where,
    });

    for (const doc of result.docs) {
      const recipientId = getRelationshipId(doc as Record<string, unknown>);

      if (recipientId) {
        recipientIds.push(recipientId);
      }
    }

    hasNextPage = result.hasNextPage === true;
    page += 1;
  }

  return recipientIds;
};

const readFiltersFromRequest = async (req: Parameters<Endpoint["handler"]>[0]) => {
  const body = (await req.json?.().catch(() => null)) as {
    description?: unknown;
    filters?: unknown;
    name?: unknown;
  } | null;

  return {
    description:
      typeof body?.description === "string" ? body.description.trim() : "",
    filters: Array.isArray(body?.filters)
      ? (body.filters as SnapshotFilterRule[])
      : [],
    name: typeof body?.name === "string" ? body.name.trim() : "",
  };
};

const createSnapshotEndpoints = ({
  filterFields,
  recipientsCollection,
}: {
  filterFields: SnapshotFilterField[];
  recipientsCollection: string;
}): Endpoint[] => [
  {
    method: "get",
    path: "/snapshot-filter-fields",
    handler: async (req) => {
      try {
        await canAccessAdmin({ req });
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      return Response.json({
        fields: filterFields,
      });
    },
  },
  {
    method: "post",
    path: "/snapshot-preview",
    handler: async (req) => {
      try {
        await canAccessAdmin({ req });
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { filters } = await readFiltersFromRequest(req);
      const where = buildSnapshotWhere({
        fields: filterFields,
        filters,
      });

      if (!where) {
        return Response.json(
          { error: "Избери поне един валиден критерий." },
          { status: 400 },
        );
      }

      const preview = await req.payload.find({
        collection: recipientsCollection,
        depth: 0,
        limit: 5,
        overrideAccess: true,
        page: 1,
        where,
      });

      return Response.json({
        matchedCount: preview.totalDocs,
        sample: preview.docs.map((doc) => {
          const typedDoc = doc as Record<string, unknown>;

          return {
            id: typedDoc.id,
          };
        }),
      });
    },
  },
  {
    method: "post",
    path: "/snapshot-create",
    handler: async (req) => {
      try {
        await canAccessAdmin({ req });
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { description, filters, name } = await readFiltersFromRequest(req);

      if (!name) {
        return Response.json({ error: "Въведи име на групата." }, { status: 400 });
      }

      const where = buildSnapshotWhere({
        fields: filterFields,
        filters,
      });

      if (!where) {
        return Response.json(
          { error: "Избери поне един валиден критерий." },
          { status: 400 },
        );
      }

      const recipientIds = await loadSnapshotRecipientIds({
        recipientsCollection,
        req,
        where,
      });

      if (recipientIds.length === 0) {
        return Response.json(
          { error: "Няма получатели по тези критерии." },
          { status: 400 },
        );
      }

      const createdGroup = await req.payload.create({
        collection: "email-recipient-groups",
        data: {
          description,
          name,
          recipients: recipientIds,
          snapshotCriteria: JSON.stringify(filters, null, 2),
          snapshotCreatedAt: new Date().toISOString(),
          source: "snapshot",
        },
        overrideAccess: true,
      });

      return Response.json({
        groupId: (createdGroup as Record<string, unknown>).id,
        matchedCount: recipientIds.length,
        ok: true,
      });
    },
  },
];

export const createEmailRecipientGroupsCollection = (
  recipientsCollection: string,
  filterFields: SnapshotFilterField[] = [],
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
  endpoints: createSnapshotEndpoints({
    filterFields,
    recipientsCollection,
  }),
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "По критерии",
          fields: [
            {
              name: "snapshotBuilder",
              label: "Създаване на група по критерии",
              type: "ui",
              admin: {
                components: {
                  Field:
                    "payload-email-broadcast-plugin/dist/client/SnapshotGroupBuilder.js#SnapshotGroupBuilder",
                },
              },
            },
          ],
        },
        {
          label: "Ръчно",
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
            {
              name: "source",
              label: "Източник",
              type: "select",
              defaultValue: "manual",
              options: [
                {
                  label: "Ръчно създадена",
                  value: "manual",
                },
                {
                  label: "Създадена по критерии",
                  value: "snapshot",
                },
              ],
              admin: {
                readOnly: true,
              },
            },
            {
              name: "snapshotCreatedAt",
              label: "Snapshot създаден на",
              type: "date",
              admin: {
                readOnly: true,
              },
            },
            {
              name: "snapshotCriteria",
              label: "Snapshot критерии",
              type: "textarea",
              admin: {
                description:
                  "Тук се пазят критериите, с които е създадена групата. Самите получатели вече са записани статично в полето Получатели.",
                readOnly: true,
              },
            },
          ],
        },
      ],
    },
  ],
});
