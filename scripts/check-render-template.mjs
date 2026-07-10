import assert from "node:assert/strict";
import { renderTemplate } from "../dist/utils/renderTemplate.js";

const completeResult = renderTemplate(
  "Hello {{ firstName }} {{ lastName }} <{{ email }}> {{ unsubscribeUrl }}",
  {
    firstName: "Ivo",
    lastName: "Galov",
    email: "ivo@example.com",
    unsubscribeUrl: "https://example.com/unsubscribe",
  },
);

assert.equal(
  completeResult,
  "Hello Ivo Galov <ivo@example.com> https://example.com/unsubscribe",
);

const missingValuesResult = renderTemplate(
  "Hello {{ firstName }} {{ lastName }} <{{ email }}> {{ unsubscribeUrl }}",
  {},
);

assert.equal(missingValuesResult, "Hello   <> ");

console.log("renderTemplate checks passed");
