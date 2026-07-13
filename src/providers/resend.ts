import { Resend } from "resend";

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
