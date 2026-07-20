import type { Payload, Where } from "payload";
import {
  buildRecipientPreview,
  type RecipientPreviewCandidate,
  type RecipientPreviewType,
} from "./recipients.js";

export type CandidateDoc = RecipientPreviewCandidate & Record<string, unknown>;

export type SendCommonConfig = {
  recipientEmailField: string;
  recipientFirstNameField?: string;
  recipientLastNameField?: string;
  recipientSegmentsFieldName?: string;
  recipientsCollection: string;
  subscriptionField?: string;
};

export const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
};

export const stripHtml = (value: string): string => {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
};

export const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const buildFromAddress = ({
  defaultFromEmail,
  defaultFromName,
  settings,
}: {
  defaultFromEmail?: string;
  defaultFromName?: string;
  settings: Record<string, unknown>;
}): string | null => {
  const fromEmail =
    asNonEmptyString(settings.defaultFromEmail) ?? defaultFromEmail ?? null;
  const fromName =
    asNonEmptyString(settings.defaultFromName) ?? defaultFromName ?? null;

  if (!fromEmail) {
    return null;
  }

  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
};

export const getRelationshipId = (value: unknown): number | string | null => {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    (typeof value.id === "string" || typeof value.id === "number")
  ) {
    return value.id;
  }

  return null;
};

export const resolveBroadcastTemplate = async ({
  broadcast,
  payload,
}: {
  broadcast: Record<string, unknown>;
  payload: Payload;
}): Promise<Record<string, unknown> | null> => {
  const templateId = getRelationshipId(broadcast.template);

  if (!templateId) {
    return null;
  }

  return (await payload.findByID({
    collection: "email-templates",
    id: templateId,
    depth: 1,
    overrideAccess: true,
  })) as Record<string, unknown>;
};

const mapRecipientDocToCandidate = ({
  config,
  doc,
}: {
  config: SendCommonConfig;
  doc: Record<string, unknown>;
}): CandidateDoc => {
  const {
    recipientEmailField,
    recipientFirstNameField,
    recipientLastNameField,
    subscriptionField,
  } = config;

  return {
    ...doc,
    email: doc[recipientEmailField],
    id:
      typeof doc.id === "number" || typeof doc.id === "string"
        ? doc.id
        : undefined,
    ...(recipientFirstNameField
      ? { [recipientFirstNameField]: doc[recipientFirstNameField] }
      : {}),
    ...(recipientLastNameField
      ? { [recipientLastNameField]: doc[recipientLastNameField] }
      : {}),
    ...(subscriptionField
      ? { newsletterSubscribed: doc[subscriptionField] }
      : {}),
  };
};

const loadRecipientDocs = async ({
  config,
  payload,
  where,
}: {
  config: SendCommonConfig;
  payload: Payload;
  where?: Where;
}): Promise<CandidateDoc[]> => {
  const candidates: CandidateDoc[] = [];
  const limit = 200;
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await payload.find({
      collection: config.recipientsCollection,
      depth: 0,
      limit,
      overrideAccess: true,
      page,
      where,
    });

    candidates.push(
      ...result.docs.map((doc) =>
        mapRecipientDocToCandidate({
          config,
          doc: doc as Record<string, unknown>,
        }),
      ),
    );

    hasNextPage = result.hasNextPage === true;
    page += 1;
  }

  return candidates;
};

export const resolveCandidateDocs = async ({
  broadcast,
  config,
  payload,
}: {
  broadcast: Record<string, unknown>;
  config: SendCommonConfig;
  payload: Payload;
}): Promise<CandidateDoc[]> => {
  const selectedSegmentKey = asNonEmptyString(broadcast.resendSegmentKey);

  if (config.recipientSegmentsFieldName && selectedSegmentKey) {
    return loadRecipientDocs({
      config,
      payload,
      where: {
        [`${config.recipientSegmentsFieldName}.${selectedSegmentKey}`]: {
          equals: true,
        },
      },
    });
  }

  return loadRecipientDocs({ config, payload });
};

export const getBroadcastPreviewType = (
  broadcast: Record<string, unknown>,
): RecipientPreviewType => {
  return "marketing";
};

export const buildAcceptedRecipients = ({
  broadcast,
  candidates,
  subscriptionField,
}: {
  broadcast: Record<string, unknown>;
  candidates: CandidateDoc[];
  subscriptionField?: string;
}) => {
  return buildRecipientPreview({
    candidates,
    subscriptionField,
    type: getBroadcastPreviewType(broadcast),
  }).acceptedRecipients;
};

export const resolveRenderData = ({
  candidate,
  config,
  email,
  unsubscribeUrl,
}: {
  candidate?: CandidateDoc;
  config: Pick<SendCommonConfig, "recipientFirstNameField" | "recipientLastNameField">;
  email: string;
  unsubscribeUrl: string;
}) => {
  return {
    email,
    firstName:
      (config.recipientFirstNameField
        ? asNonEmptyString(candidate?.[config.recipientFirstNameField])
        : null) ?? "",
    lastName:
      (config.recipientLastNameField
        ? asNonEmptyString(candidate?.[config.recipientLastNameField])
        : null) ?? "",
    unsubscribeUrl,
  };
};
