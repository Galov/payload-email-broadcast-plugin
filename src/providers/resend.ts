import { Resend } from "resend";
import type {
  CreateBroadcastOptions,
  CreateContactOptions,
  UpdateContactOptions,
} from "resend";

export type SendWithResendArgs = {
  apiKey: string;
  from: string;
  html: string;
  replyTo?: string;
  subject: string;
  text?: string;
  to: string;
};

export type SendWithResendResult = {
  providerMessageId?: string;
};

type ResendErrorLike = {
  message?: string;
  name?: string;
  statusCode?: null | number;
};

type ResendResponse<TData> = {
  data?: TData | null;
  error?: ResendErrorLike | null;
};

export class ResendProviderError extends Error {
  operation: string;
  statusCode?: number;

  constructor({
    message,
    operation,
    statusCode,
  }: {
    message: string;
    operation: string;
    statusCode?: number;
  }) {
    super(message);
    this.name = "ResendProviderError";
    this.operation = operation;
    this.statusCode = statusCode;
  }
}

const assertResendSuccess = <TData>(
  operation: string,
  result: ResendResponse<TData>,
): TData => {
  if (result.error) {
    throw new ResendProviderError({
      message: result.error.message ?? `Resend ${operation} failed.`,
      operation,
      statusCode: result.error.statusCode ?? undefined,
    });
  }

  if (!result.data) {
    throw new ResendProviderError({
      message: `Resend ${operation} returned no data.`,
      operation,
    });
  }

  return result.data;
};

export const sendWithResend = async ({
  apiKey,
  from,
  html,
  replyTo,
  subject,
  text,
  to,
}: SendWithResendArgs): Promise<SendWithResendResult> => {
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    html,
    replyTo,
    subject,
    text,
    to,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    providerMessageId: typeof result.data?.id === "string" ? result.data.id : undefined,
  };
};

export type ResendContactProperties = Record<string, number | string | null>;

export type CreateResendContactArgs = {
  apiKey: string;
  email: string;
  firstName?: string;
  lastName?: string;
  properties?: ResendContactProperties;
  segmentIds?: string[];
  unsubscribed?: boolean;
};

export type CreateResendContactResult = {
  contactId: string;
};

export const createResendContact = async ({
  apiKey,
  email,
  firstName,
  lastName,
  properties,
  segmentIds,
  unsubscribed,
}: CreateResendContactArgs): Promise<CreateResendContactResult> => {
  const resend = new Resend(apiKey);
  const payload: CreateContactOptions = {
    email,
    ...(firstName !== undefined ? { firstName } : {}),
    ...(lastName !== undefined ? { lastName } : {}),
    ...(properties ? { properties } : {}),
    ...(segmentIds ? { segments: segmentIds.map((id) => ({ id })) } : {}),
    ...(unsubscribed !== undefined ? { unsubscribed } : {}),
  };
  const data = assertResendSuccess(
    "contacts.create",
    await resend.contacts.create(payload),
  );

  return {
    contactId: data.id,
  };
};

export type UpdateResendContactArgs = {
  apiKey: string;
  contactId?: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  properties?: ResendContactProperties;
  unsubscribed?: boolean;
};

export type UpdateResendContactResult = {
  contactId: string;
};

export const updateResendContact = async ({
  apiKey,
  contactId,
  email,
  firstName,
  lastName,
  properties,
  unsubscribed,
}: UpdateResendContactArgs): Promise<UpdateResendContactResult> => {
  if (!contactId && !email) {
    throw new ResendProviderError({
      message: "Resend contact update requires contactId or email.",
      operation: "contacts.update",
    });
  }

  const resend = new Resend(apiKey);
  const payload: UpdateContactOptions = {
    ...(contactId ? { id: contactId } : { email: email as string }),
    ...(firstName !== undefined ? { firstName } : {}),
    ...(lastName !== undefined ? { lastName } : {}),
    ...(properties ? { properties } : {}),
    ...(unsubscribed !== undefined ? { unsubscribed } : {}),
  };
  const data = assertResendSuccess(
    "contacts.update",
    await resend.contacts.update(payload),
  );

  return {
    contactId: data.id,
  };
};

export type AddResendContactToSegmentArgs = {
  apiKey: string;
  contactId?: string;
  email?: string;
  segmentId: string;
};

export type AddResendContactToSegmentResult = {
  segmentId: string;
};

export const addResendContactToSegment = async ({
  apiKey,
  contactId,
  email,
  segmentId,
}: AddResendContactToSegmentArgs): Promise<AddResendContactToSegmentResult> => {
  if (!contactId && !email) {
    throw new ResendProviderError({
      message: "Adding a Resend contact to a segment requires contactId or email.",
      operation: "contacts.segments.add",
    });
  }

  const resend = new Resend(apiKey);
  const data = assertResendSuccess(
    "contacts.segments.add",
    await resend.contacts.segments.add({
      ...(contactId ? { contactId } : { email: email as string }),
      segmentId,
    }),
  );

  return {
    segmentId: data.id,
  };
};

export type RemoveResendContactFromSegmentArgs = {
  apiKey: string;
  contactId?: string;
  email?: string;
  segmentId: string;
};

export type RemoveResendContactFromSegmentResult = {
  segmentId: string;
};

export const removeResendContactFromSegment = async ({
  apiKey,
  contactId,
  email,
  segmentId,
}: RemoveResendContactFromSegmentArgs): Promise<RemoveResendContactFromSegmentResult> => {
  const contactIdentifier = contactId ?? email;

  if (!contactIdentifier) {
    throw new ResendProviderError({
      message: "Removing a Resend contact from a segment requires contactId or email.",
      operation: "contacts.segments.remove",
    });
  }

  const response = await fetch(
    `https://api.resend.com/contacts/${encodeURIComponent(contactIdentifier)}/segments/${encodeURIComponent(segmentId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ResendErrorLike | null;

    throw new ResendProviderError({
      message: body?.message ?? "Resend contacts.segments.remove failed.",
      operation: "contacts.segments.remove",
      statusCode: response.status,
    });
  }

  return {
    segmentId,
  };
};

export type CreateResendBroadcastArgs = {
  apiKey: string;
  from: string;
  html: string;
  name?: string;
  previewText?: string;
  replyTo?: string | string[];
  scheduledAt?: string;
  segmentId: string;
  send?: boolean;
  subject: string;
  text?: string;
};

export type CreateResendBroadcastResult = {
  broadcastId: string;
};

export const createResendBroadcast = async ({
  apiKey,
  from,
  html,
  name,
  previewText,
  replyTo,
  scheduledAt,
  segmentId,
  send,
  subject,
  text,
}: CreateResendBroadcastArgs): Promise<CreateResendBroadcastResult> => {
  const resend = new Resend(apiKey);
  const payload = {
    from,
    html,
    segmentId,
    subject,
    ...(name ? { name } : {}),
    ...(previewText ? { previewText } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(text ? { text } : {}),
    ...(send === true ? { send: true, ...(scheduledAt ? { scheduledAt } : {}) } : {}),
  } as CreateBroadcastOptions;
  const data = assertResendSuccess(
    "broadcasts.create",
    await resend.broadcasts.create(payload),
  );

  return {
    broadcastId: data.id,
  };
};

export type SendResendBroadcastArgs = {
  apiKey: string;
  broadcastId: string;
  scheduledAt?: string;
};

export type SendResendBroadcastResult = {
  broadcastId: string;
};

export const sendResendBroadcast = async ({
  apiKey,
  broadcastId,
  scheduledAt,
}: SendResendBroadcastArgs): Promise<SendResendBroadcastResult> => {
  const resend = new Resend(apiKey);
  const data = assertResendSuccess(
    "broadcasts.send",
    await resend.broadcasts.send(broadcastId, scheduledAt ? { scheduledAt } : undefined),
  );

  return {
    broadcastId: data.id,
  };
};
