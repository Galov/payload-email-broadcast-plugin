"use client";

import { useFormModified } from "@payloadcms/ui";
import * as React from "react";

type SendTestButtonProps = {
  id?: number | string;
  params?: {
    segments?: string[];
  };
};

type SendTestResponse = {
  deliveredCount?: number;
  error?: string;
  failedCount?: number;
  ok?: boolean;
  providerMessageId?: string;
  recipientCount?: number;
  testRecipientEmail?: string;
};

type SendSummaryResponse = {
  allowed?: boolean;
  error?: string;
  maxControlledRecipients?: number;
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
  alignItems: "center",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  marginBottom: 16,
  padding: 16,
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

const disabledButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  cursor: "not-allowed",
  opacity: 0.7,
};

const broadcastButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#b91c1c",
};

const disabledBroadcastButtonStyle: React.CSSProperties = {
  ...broadcastButtonStyle,
  cursor: "not-allowed",
  opacity: 0.7,
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

export const SendTestButton: React.FC<SendTestButtonProps> = (props) => {
  const [documentID, setDocumentID] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const isModified = useFormModified();

  React.useEffect(() => {
    setDocumentID(resolveDocumentID(props));
  }, [props]);

  if (!documentID) {
    return React.createElement(
      "div",
      { style: panelStyle },
      React.createElement(
        "p",
        { style: { margin: 0, fontSize: 14, lineHeight: 1.5 } },
        "Запиши кампанията, за да можеш да изпратиш тестов имейл.",
      ),
      );
    }

  const runSendTest = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/email-broadcasts/${documentID}/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const json = (await response.json()) as SendTestResponse;

      if (!response.ok || !json.ok) {
        setMessage(`Грешка: ${json.error ?? "Неуспешно тестово изпращане."}`);
        return;
      }

      const sentTo = json.testRecipientEmail ?? "непознат адрес";
      setMessage(
        `Тестовият имейл е изпратен до ${sentTo}. Ако искаш, презареди страницата, за да видиш обновените служебни полета.`,
      );
    } catch (error) {
      setMessage(
        `Грешка: ${error instanceof Error ? error.message : "Неуспешно тестово изпращане."}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const runSendBroadcast = async () => {
    if (isModified) {
      setMessage(
        "Грешка: Първо запази кампанията. Реалното изпращане използва записаните данни, не незаписаните промени във формата.",
      );
      return;
    }

    const browserWindow = globalThis as typeof globalThis & {
      prompt?: (message?: string) => string | null;
    };

    setIsLoading(true);
    setMessage("");

    let summaryText = "";

    try {
      const summaryResponse = await fetch(
        `/api/email-broadcasts/${documentID}/send-summary`,
      );
      const summaryJson = (await summaryResponse.json()) as SendSummaryResponse;

      if (!summaryResponse.ok || !summaryJson.summary) {
        setMessage(`Грешка: ${summaryJson.error ?? "Неуспешна проверка преди изпращане."}`);
        return;
      }

      const summary = summaryJson.summary;
      summaryText = [
        `Режим: ${summaryJson.modeLabel ?? "неизвестен"}`,
        `Крайни получатели: ${summary.finalRecipients}`,
        `Разгледани записи: ${summary.totalCandidateRecipients}`,
        `Без имейл: ${summary.recipientsWithoutEmail}`,
        `Дублирани имейли: ${summary.duplicateEmails}`,
        `Отписани: ${summary.unsubscribedRecipients}`,
        `Лимит за контролирано изпращане: ${summaryJson.maxControlledRecipients ?? 10}`,
      ].join("\n");

      if (!summaryJson.allowed) {
        setMessage(
          "Грешка: Тази кампания не може да бъде изпратена в текущия контролиран режим. Провери режима и броя крайни получатели.",
        );
        return;
      }
    } catch (error) {
      setMessage(
        `Грешка: ${error instanceof Error ? error.message : "Неуспешна проверка преди изпращане."}`,
      );
      return;
    } finally {
      setIsLoading(false);
    }

    const confirmation = browserWindow.prompt?.(
      `${summaryText}\n\nТова ще изпрати реални имейли до тези получатели. Напиши "ИЗПРАТИ", за да потвърдиш.`,
    );

    if (confirmation !== "ИЗПРАТИ") {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/email-broadcasts/${documentID}/send-broadcast`, {
        body: JSON.stringify({ confirmation }),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const json = (await response.json()) as SendTestResponse;

      if (!response.ok) {
        setMessage(`Грешка: ${json.error ?? "Неуспешно изпращане."}`);
        return;
      }

      setMessage(
        `Изпращането приключи. Успешни: ${json.deliveredCount ?? 0}. Неуспешни: ${json.failedCount ?? 0}.`,
      );
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
      "button",
      {
        disabled: isLoading,
        onClick: runSendTest,
        style: isLoading ? disabledButtonStyle : buttonStyle,
        type: "button",
      },
      isLoading ? "Изпращане..." : "Изпрати тестов имейл",
    ),
    React.createElement(
      "button",
      {
        disabled: isLoading,
        onClick: runSendBroadcast,
        style: isLoading ? disabledBroadcastButtonStyle : broadcastButtonStyle,
        type: "button",
      },
      isLoading ? "Изпращане..." : "Изпрати реално",
    ),
    React.createElement(
      "p",
      { style: { color: "#374151", fontSize: 14, lineHeight: 1.5, margin: 0 } },
      "Запази кампанията преди реално изпращане. Реалният бутон засега работи само за ръчно избрани получатели и групи.",
    ),
    message
      ? React.createElement(
          "p",
          {
            style: {
              color: message.startsWith("Грешка:") ? "#b91c1c" : "#0f766e",
              flexBasis: "100%",
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
