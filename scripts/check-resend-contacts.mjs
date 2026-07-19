import assert from "node:assert/strict";
import { buildResendContactSyncPlan } from "../dist/index.js";

const result = buildResendContactSyncPlan({
  fields: {
    email: "email",
    firstName: "name",
    lastName: "familyName",
    subscription: "newsletterSubscribed",
  },
  propertyMappings: [
    { field: "membershipStatus", property: "membership_status" },
    { field: "membershipYears", property: "membership_years" },
  ],
  recipients: [
    {
      id: "1",
      email: " IVAILO@example.com ",
      familyName: "Galov",
      membershipStatus: "active",
      membershipYears: 3,
      name: "Ivailo",
      newsletterSubscribed: true,
    },
    {
      id: "2",
      email: "ivailo@example.com",
      newsletterSubscribed: true,
    },
    {
      id: "3",
      newsletterSubscribed: true,
    },
    {
      id: "4",
      email: "stoyan@example.com",
      name: "Stoyan",
      newsletterSubscribed: false,
    },
  ],
});

assert.equal(result.contacts.length, 2);
assert.equal(result.skipped.length, 2);
assert.deepEqual(result.contacts[0], {
  email: "ivailo@example.com",
  firstName: "Ivailo",
  lastName: "Galov",
  properties: {
    membership_status: "active",
    membership_years: 3,
  },
  recipientId: "1",
  unsubscribed: false,
});
assert.deepEqual(result.contacts[1], {
  email: "stoyan@example.com",
  firstName: "Stoyan",
  recipientId: "4",
  unsubscribed: true,
});
assert.deepEqual(result.skipped, [
  {
    email: "ivailo@example.com",
    reason: "duplicate_email",
    recipientId: "2",
  },
  {
    reason: "missing_email",
    recipientId: "3",
  },
]);

console.log("Resend contact mapping check passed.");
