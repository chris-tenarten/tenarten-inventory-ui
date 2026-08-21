import assert from "node:assert/strict";
import {
  reconstructJobUpdateMentionText,
  retainCanonicalMentions,
  tokenizeJobUpdateMentionText,
  type CanonicalMentionIdentity,
} from "../src/modules/production/job-update-mention-tokenization";

const chris: CanonicalMentionIdentity = {
  userId: "00000000-0000-4000-8000-000000000101",
  displayName: "Chris",
};
const anthony: CanonicalMentionIdentity = {
  userId: "00000000-0000-4000-8000-000000000102",
  displayName: "Anthony",
};

const cases: Array<{ label: string; value: string; mentions: CanonicalMentionIdentity[] }> = [
  { label: "empty", value: "", mentions: [] },
  { label: "plain", value: "hello", mentions: [] },
  { label: "mention only", value: "@Chris", mentions: [chris] },
  { label: "text after mention", value: "@Chris hello", mentions: [chris] },
  { label: "text before mention", value: "hello @Chris", mentions: [chris] },
  { label: "text around mention", value: "hello @Chris goodbye", mentions: [chris] },
  { label: "mention punctuation", value: "@Chris, please check this", mentions: [chris] },
  { label: "multiple mentions", value: "@Chris hello @Anthony", mentions: [chris, anthony] },
  { label: "multiline ordinary", value: "hello\nthis is another line", mentions: [] },
  { label: "multiline mentions", value: "@Chris hello\n@Anthony please review", mentions: [chris, anthony] },
  { label: "unselected literal", value: "@whatever", mentions: [] },
  { label: "immediately after selection", value: "@Chris h", mentions: [chris] },
  { label: "adjacent deletion", value: "@Chrishello", mentions: [chris] },
  { label: "existing mention edit", value: "Updated text for @Chris today", mentions: [chris] },
];

for (const testCase of cases) {
  const segments = tokenizeJobUpdateMentionText(testCase.value, testCase.mentions);
  assert.equal(
    reconstructJobUpdateMentionText(segments),
    testCase.value,
    `${testCase.label}: visible segments must reproduce the canonical controlled value exactly`,
  );
}

assert.deepEqual(
  tokenizeJobUpdateMentionText("@whatever hello", [chris]),
  [{ text: "@whatever hello", userId: null }],
  "Unselected arbitrary @text must remain ordinary text",
);
assert.deepEqual(
  tokenizeJobUpdateMentionText("@Chris @Chris", [chris]).filter((segment) => segment.userId === chris.userId).length,
  2,
  "Repeated readable references reconstruct exactly while canonical persistence remains user-deduplicated",
);
assert.deepEqual(
  retainCanonicalMentions("hello", [chris]),
  [],
  "Deleting a canonical mention token must remove its canonical relationship",
);
assert.deepEqual(
  retainCanonicalMentions("@Chris hello", [chris, anthony]),
  [chris],
  "Editing must preserve only canonical mentions whose readable token remains",
);

console.log("Job Update mention composer reconstruction checks passed.");
