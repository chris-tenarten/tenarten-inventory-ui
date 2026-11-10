import type { JobTransmittalDraft, TransmittalMode } from "./types";

type ValidationOptions = {
  mode?: TransmittalMode;
  canonicalJobNumber?: string | null;
};

export function hasUsableTransmittalJobNumber(value: string | null | undefined): boolean {
  return /^\d{4}$/.test(String(value ?? "").replace(/\D/g, "").slice(-4));
}

export function validateJobTransmittal(
  draft: JobTransmittalDraft,
  { mode = "job-linked", canonicalJobNumber = draft.jobNumber }: ValidationOptions = {},
): string[] {
  const errors: string[] = [];
  if (mode === "job-linked") {
    if (!draft.jobId) errors.push("A valid Production Job is required.");
    if (!hasUsableTransmittalJobNumber(canonicalJobNumber)) {
      errors.push("Assign a canonical Job Number in Production before generating a Job-linked Letter of Transmittal.");
    }
    if (draft.transmittalNumber.trim()) {
      errors.push("The Transmittal Number for a Job-linked document is derived from its canonical Job Number.");
    }
  } else if (!draft.transmittalNumber.trim()) {
    errors.push("Enter a Transmittal Number for this standalone Letter of Transmittal.");
  }
  if (!draft.documentDate) errors.push("Document date is required.");
  if (!draft.recipient.company.trim() && !draft.recipient.attention.trim()) {
    errors.push("Recipient company or attention name is required.");
  }
  if (!draft.senderName.trim()) errors.push("Transmitted-by name is required.");
  if (draft.recipient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.recipient.email)) {
    errors.push("Recipient email is not valid.");
  }
  if (draft.senderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.senderEmail)) {
    errors.push("Sender email is not valid.");
  }
  const meaningful = draft.items.filter((item) =>
    [item.submittal, item.description, item.number].some((value) => value.trim()),
  );
  if (!meaningful.length) errors.push("Add at least one meaningful transmitted item.");
  for (const [index, item] of draft.items.entries()) {
    if (item.quantity && (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      errors.push(`Item ${index + 1} quantity must be positive.`);
    }
    if (item.date && !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      errors.push(`Item ${index + 1} date is not valid.`);
    }
  }
  if (draft.transmittalNumber.trim() && !/^\d{4}-\d{3}$/.test(draft.transmittalNumber.trim())) {
    errors.push("Use a Transmittal Number such as 0319-001.");
  }
  if (draft.recipient.company.length > 200 || draft.recipient.attention.length > 200 || draft.cc.length > 400) {
    errors.push("Recipient and CC fields are too long for the issued document.");
  }
  if (draft.customer.length > 200) errors.push("Customer Name must be 200 characters or fewer.");
  if (draft.recipient.addressLine1.length > 200 || draft.recipient.addressLine2.length > 200) {
    errors.push("Address fields must be 200 characters or fewer.");
  }
  if (draft.comments.length > 30000) errors.push("Comments must be 30,000 characters or fewer.");
  return errors;
}
