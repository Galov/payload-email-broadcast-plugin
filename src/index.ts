export type EmailBroadcastRecipientFields = {
  email: string;
  firstName?: string;
  lastName?: string;
};

export type EmailBroadcastPluginOptions = {
  usersCollection: string;
  recipientFields: EmailBroadcastRecipientFields;
  subscriptionField?: string;
  unsubscribeTokenField?: string;
  resendApiKey: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
};

export type EmailBroadcastPlugin = <TConfig>(config: TConfig) => TConfig;

export const emailBroadcastPlugin = (
  _options: EmailBroadcastPluginOptions,
): EmailBroadcastPlugin => {
  return <TConfig>(config: TConfig): TConfig => {
    return config;
  };
};
