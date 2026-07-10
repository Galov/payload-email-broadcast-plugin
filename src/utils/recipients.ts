import type { Payload } from "payload";

export type RecipientPreviewCandidate = {
  email?: unknown;
  id?: number | string;
  newsletterSubscribed?: unknown;
};

export type RecipientPreviewType = "marketing" | "service";

export type RecipientPreviewSummary = {
  totalCandidateRecipients: number;
  recipientsWithoutEmail: number;
  duplicateEmails: number;
  unsubscribedRecipients: number;
  finalRecipients: number;
};

export type RecipientPreviewResult = RecipientPreviewSummary & {
  acceptedRecipients: Array<{
    email: string;
    id?: number | string;
  }>;
};

export type BuildRecipientPreviewOptions = {
  candidates: RecipientPreviewCandidate[];
  type: RecipientPreviewType;
  subscriptionField?: string;
};

export type LoadRecipientPreviewOptions = {
  payload: Payload;
  collection: string;
  emailField: string;
  type: RecipientPreviewType;
  subscriptionField?: string;
};

const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length > 0 ? normalized : null;
};

const isSubscribed = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
};

export const buildRecipientPreview = ({
  candidates,
  type,
  subscriptionField,
}: BuildRecipientPreviewOptions): RecipientPreviewResult => {
  const seenEmails = new Set<string>();
  const acceptedRecipients: RecipientPreviewResult["acceptedRecipients"] = [];

  let recipientsWithoutEmail = 0;
  let duplicateEmails = 0;
  let unsubscribedRecipients = 0;

  for (const candidate of candidates) {
    const email = normalizeEmail(candidate.email);

    if (!email) {
      recipientsWithoutEmail += 1;
      continue;
    }

    if (seenEmails.has(email)) {
      duplicateEmails += 1;
      continue;
    }

    if (type === "marketing" && subscriptionField) {
      const isRecipientSubscribed = isSubscribed(candidate.newsletterSubscribed);

      if (!isRecipientSubscribed) {
        unsubscribedRecipients += 1;
        continue;
      }
    }

    seenEmails.add(email);
    acceptedRecipients.push({
      email,
      id: candidate.id,
    });
  }

  return {
    totalCandidateRecipients: candidates.length,
    recipientsWithoutEmail,
    duplicateEmails,
    unsubscribedRecipients,
    finalRecipients: acceptedRecipients.length,
    acceptedRecipients,
  };
};

export const loadRecipientPreview = async ({
  payload,
  collection,
  emailField,
  type,
  subscriptionField,
}: LoadRecipientPreviewOptions): Promise<RecipientPreviewResult> => {
  const result = await payload.find({
    collection,
    depth: 0,
    limit: 0,
    pagination: false,
  });

  const candidates: RecipientPreviewCandidate[] = result.docs.map((doc) => {
    const typedDoc = doc as Record<string, unknown>;

    return {
      id: typeof typedDoc.id === "number" || typeof typedDoc.id === "string" ? typedDoc.id : undefined,
      email: typedDoc[emailField],
      newsletterSubscribed: subscriptionField ? typedDoc[subscriptionField] : undefined,
    };
  });

  return buildRecipientPreview({
    candidates,
    type,
    subscriptionField,
  });
};
