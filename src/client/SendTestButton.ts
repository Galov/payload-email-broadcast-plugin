"use client";

import { useFormModified } from "@payloadcms/ui";
import * as React from "react";

type SendTestButtonProps = {
  id?: number | string;
  params?: {
    segments?: string[];
  };
};

type ApiResponse = {
  error?: string;
  ok?: boolean;
  resendBroadcastId?: string;
  resendBroadcastStatus?: string;
  segmentId?: string;
  sentAt?: string;
  summary?: {
    skipped?: number;
    syncFailed?: number;
    synced?: number;
  };
  testRecipientEmail?: string;
};

type SendSummaryResponse = {
  allowed?: boolean;
  campaign?: {
    hasPreparedEmail?: boolean;
    hasPreparedRecipients?: boolean;
    isSent?: boolean;
    status?: string | null;
  };
  error?: string;
  modeLabel?: string;
  summary?: {
    duplicateEmails: number;
    finalRecipients: number;
    recipientsWithoutEmail: number;
    totalCandidateRecipients: number;
    unsubscribedRecipients: number;
  };
};

const panelStyle: React.CSSProperties = {
  alignItems: "flex-start",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginBottom: 16,
  padding: 16,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const buttonStyle: React.CSSProperties = {
  background: "#0f766e",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  padding: "8px 12px",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#1f2937",
};

const broadcastButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#b91c1c",
};

const disabledButtonStyle = (style: React.CSSProperties): React.CSSProperties => ({
  ...style,
  cursor: "not-allowed",
  opacity: 0.7,
});

const descriptionStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
};

const resolveDocumentID = (props: SendTestButtonProps): string | null => {
  if (typeof props.id === "string" || typeof props.id === "number") {
    return String(props.id);
  }

  const segments = Array.isArray(props.params?.segments) ? props.params.segments : [];
  const lastSegment = segments[segments.length - 1];

  if (typeof lastSegment === "string" && lastSegment.length > 0 && lastSegment !== "create") {
    return lastSegment;
  }

  const browserWindow = globalThis as typeof globalThis & {
    location?: {
      pathname?: string;
    };
  };

  if (typeof browserWindow.location?.pathname !== "string") {
    return null;
  }

  const match = browserWindow.location.pathname.match(
    /\/admin\/collections\/email-broadcasts\/([^/]+)/,
  );
  const documentID = match?.[1];

  if (!documentID || documentID === "create") {
    return null;
  }

  return decodeURIComponent(documentID);
};

const buildSummaryText = (summaryJson: SendSummaryResponse): string | null => {
  const summary = summaryJson.summary;

  if (!summary) {
    return null;
  }

  return [
    `Режим: ${summaryJson.modeLabel ?? "неизвестен"}`,
    `Крайни получатели: ${summary.finalRecipients}`,
    `Разгледани записи: ${summary.totalCandidateRecipients}`,
    `Без имейл: ${summary.recipientsWithoutEmail}`,
    `Дублирани имейли: ${summary.duplicateEmails}`,
    `Отписани: ${summary.unsubscribedRecipients}`,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
};

export const SendTestButton: React.FC<SendTestButtonProps> = (props) => {
  const [campaignState, setCampaignState] = React.useState<
    SendSummaryResponse["campaign"] | null
  >(null);
  const [documentID, setDocumentID] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const isModified = useFormModified();

  React.useEffect(() => {
    setDocumentID(resolveDocumentID(props));
  }, [props]);

  const ensureSaved = () => {
    if (!isModified) {
      return true;
    }

    setMessage(
      "Грешка: Първо запази кампанията. Действията използват записаните данни, не незаписаните промени във формата.",
    );
    return false;
  };

  const loadSummary = React.useCallback(async () => {
    if (!documentID) {
      throw new Error("Първо запази кампанията.");
    }

    const response = await fetch(`/api/email-broadcasts/${documentID}/send-summary`);
    const json = (await response.json()) as SendSummaryResponse;

    if (!response.ok || !json.summary) {
      throw new Error(json.error ?? "Неуспешна проверка на получателите.");
    }

    if (!json.allowed) {
      throw new Error(
        "Тази кампания не може да бъде изпратена в текущия контролиран режим.",
      );
    }

    setCampaignState(json.campaign ?? null);
    return json;
  }, [documentID]);

  React.useEffect(() => {
    if (!documentID) {
      setCampaignState(null);
      return;
    }

    void loadSummary().catch(() => {
      setCampaignState(null);
    });
  }, [documentID, loadSummary]);

  if (!documentID) {
    return React.createElement(
      "div",
      { style: panelStyle },
      React.createElement(
        "p",
        { style: descriptionStyle },
        "Запиши кампанията, за да можеш да използваш действията за изпращане.",
      ),
    );
  }

  const hasPreparedRecipients = campaignState?.hasPreparedRecipients === true;
  const hasPreparedEmail = campaignState?.hasPreparedEmail === true;
  const isSent = campaignState?.isSent === true;
  const isCheckingStatus = campaignState === null;

  const runSendTest = async () => {
    if (!ensureSaved()) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/email-broadcasts/${documentID}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = (await response.json()) as ApiResponse;

      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Неуспешно тестово изпращане.");
      }

      setMessage(
        `Тестовият имейл е изпратен до ${json.testRecipientEmail ?? "непознат адрес"}.`,
      );
      await loadSummary();
    } catch (error) {
      setMessage(
        `Грешка: ${error instanceof Error ? error.message : "Неуспешно тестово изпращане."}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const runSyncAudience = async () => {
    if (!ensureSaved()) {
      return;
    }

    const browserWindow = globalThis as typeof globalThis & {
      prompt?: (message?: string) => string | null;
    };

    setIsLoading(true);
    setMessage("");

    try {
      const summaryJson = await loadSummary();
      const summaryText = buildSummaryText(summaryJson);
      setIsLoading(false);

      const confirmation = browserWindow.prompt?.(
        `${summaryText}\n\nТова ще подготви списъка с получатели за тази кампания. Имейли няма да бъдат изпратени. Напиши "ПОДГОТВИ", за да потвърдиш.`,
      );

      if (confirmation !== "ПОДГОТВИ") {
        return;
      }

      setIsLoading(true);
      const response = await fetch(`/api/email-broadcasts/${documentID}/sync-audience`, {
        body: JSON.stringify({ confirmation: "СИНХРОНИЗИРАЙ" }),
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = (await response.json()) as ApiResponse;

      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Неуспешна подготовка на получателите.");
      }

      setMessage(
        `Списъкът с получатели е подготвен. Готови получатели: ${json.summary?.synced ?? 0}.`,
      );
      await loadSummary();
    } catch (error) {
      setMessage(
        `Грешка: ${error instanceof Error ? error.message : "Неуспешна подготовка на получателите."}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const runCreateDraft = async () => {
    if (!ensureSaved()) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/email-broadcasts/${documentID}/create-broadcast-draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const json = (await response.json()) as ApiResponse;

      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Неуспешна подготовка на имейла за преглед.");
      }

      setMessage(
        "Имейлът е подготвен за финален преглед. Провери съдържанието преди изпращане.",
      );
      await loadSummary();
    } catch (error) {
      setMessage(
        `Грешка: ${error instanceof Error ? error.message : "Неуспешна подготовка на имейла за преглед."}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const runSendBroadcast = async () => {
    if (!ensureSaved()) {
      return;
    }

    const browserWindow = globalThis as typeof globalThis & {
      prompt?: (message?: string) => string | null;
    };

    setIsLoading(true);
    setMessage("");

    try {
      const summaryJson = await loadSummary();
      const summaryText = buildSummaryText(summaryJson);
      setIsLoading(false);

      const confirmation = browserWindow.prompt?.(
        `${summaryText}\n\nТова ще изпрати реалния имейл до тези получатели. Напиши "ИЗПРАТИ", за да потвърдиш.`,
      );

      if (confirmation !== "ИЗПРАТИ") {
        return;
      }

      setIsLoading(true);
      const response = await fetch(
        `/api/email-broadcasts/${documentID}/send-resend-broadcast`,
        {
          body: JSON.stringify({ confirmation }),
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const json = (await response.json()) as ApiResponse;

      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Неуспешно изпращане.");
      }

      setMessage(
        "Кампанията е изпратена.",
      );
      await loadSummary();
    } catch (error) {
      setMessage(
        `Грешка: ${error instanceof Error ? error.message : "Неуспешно изпращане."}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return React.createElement(
    "div",
    { style: panelStyle },
    React.createElement(
      "p",
      { style: descriptionStyle },
      "Ред: 1) изпрати тест до тестовия адрес, 2) подготви списъка с получатели, 3) подготви имейла за изпращане, 4) изпрати реално.",
    ),
    React.createElement(
      "div",
      { style: actionsStyle },
      React.createElement(
        "button",
        {
          disabled: isLoading || isSent,
          onClick: runSendTest,
          style: isLoading || isSent ? disabledButtonStyle(buttonStyle) : buttonStyle,
          type: "button",
        },
        isLoading ? "Работи..." : "1. Изпрати тестов имейл",
      ),
      !isCheckingStatus
        ? React.createElement(
            "button",
            {
              disabled: isLoading || hasPreparedRecipients || isSent,
              onClick: runSyncAudience,
              style: isLoading || hasPreparedRecipients || isSent
                ? disabledButtonStyle(secondaryButtonStyle)
                : secondaryButtonStyle,
              type: "button",
            },
            isLoading
              ? "Работи..."
              : hasPreparedRecipients || isSent
                ? "2. Получателите са подготвени"
                : "2. Подготви получателите",
          )
        : null,
      !isCheckingStatus && (hasPreparedRecipients || hasPreparedEmail || isSent)
        ? React.createElement(
            "button",
            {
              disabled: isLoading || hasPreparedEmail || isSent,
              onClick: runCreateDraft,
              style: isLoading || hasPreparedEmail || isSent
                ? disabledButtonStyle(secondaryButtonStyle)
                : secondaryButtonStyle,
              type: "button",
            },
            isLoading
              ? "Работи..."
              : hasPreparedEmail || isSent
                ? "3. Имейлът е подготвен"
                : "3. Подготви имейла",
          )
        : null,
      !isCheckingStatus && (hasPreparedEmail || isSent)
        ? React.createElement(
            "button",
            {
              disabled: isLoading || isSent,
              onClick: runSendBroadcast,
              style: isLoading || isSent
                ? disabledButtonStyle(broadcastButtonStyle)
                : broadcastButtonStyle,
              type: "button",
            },
            isLoading ? "Работи..." : isSent ? "4. Изпратено" : "4. Изпрати реално",
          )
        : null,
    ),
    isCheckingStatus
      ? React.createElement(
          "p",
          { style: descriptionStyle },
          "Проверявам коя е следващата стъпка за тази кампания.",
        )
      : null,
    isSent
      ? React.createElement(
          "p",
          { style: descriptionStyle },
          "Кампанията е изпратена.",
        )
      : null,
    message
      ? React.createElement(
          "p",
          {
            style: {
              color: message.startsWith("Грешка:") ? "#b91c1c" : "#0f766e",
              fontSize: 14,
              lineHeight: 1.5,
              margin: 0,
            },
          },
          message,
        )
      : null,
  );
};
