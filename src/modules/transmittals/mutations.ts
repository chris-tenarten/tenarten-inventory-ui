import { supabase } from "@/lib/supabase";
import type { JobTransmittalDraft } from "./types";

async function throwFunctionError(error: unknown): Promise<never> {
  if (typeof error === "object" && error !== null && "context" in error && error.context instanceof Response) {
    try {
      const body = (await error.context.clone().json()) as { error?: unknown };
      if (body.error) throw new Error(String(body.error));
    } catch (parsed) {
      if (parsed instanceof Error) throw parsed;
    }
  }
  throw error;
}

export function buildTransmittalSnapshot(draft: JobTransmittalDraft, forPreview = false) {
  return {
    document_date: draft.documentDate,
    recipient: {
      company: draft.recipient.company.trim(),
      address_line_1: draft.recipient.addressLine1.trim(),
      address_line_2: draft.recipient.addressLine2.trim(),
      attention: draft.recipient.attention.trim(),
      office_phone: draft.recipient.officePhone.trim(),
      mobile_phone: draft.recipient.mobilePhone.trim(),
      email: draft.recipient.email.trim(),
    },
    cc: draft.cc.trim(),
    delivery: {
      attached: draft.deliveryAttached,
      separate_cover: draft.deliverySeparateCover,
      via: draft.deliveryVia.trim(),
    },
    transmitted_types: {
      shop_drawing: draft.typeShopDrawing,
      letter: draft.typeLetter,
      samples: draft.typeSamples,
      other: draft.typeOther,
      other_label: draft.typeOtherLabel.trim(),
    },
    items: draft.items
      .filter((item) => [item.submittal, item.quantity, item.date, item.number, item.description].some((value) => value.trim()))
      .map((item, index) => ({
        line_number: index + 1,
        submittal: item.submittal.trim(),
        quantity: item.quantity.trim(),
        date: item.date,
        number: item.number.trim(),
        description: item.description.trim(),
      })),
    purpose: {
      approval: draft.purposeApproval,
      use: draft.purposeUse,
      record: draft.purposeRecord,
      rfi: draft.purposeRfi,
      review: draft.purposeReview,
      review_by: draft.reviewBy,
    },
    comments: draft.comments.trim(),
    sender: {
      name: draft.senderName.trim(),
      phone: draft.senderPhone.trim(),
      email: draft.senderEmail.trim(),
    },
    job_id: draft.jobId,
    job_number: draft.jobNumber,
    job_name: draft.jobName,
    customer: draft.customer.trim(),
    transmittal_number: draft.transmittalNumber.trim() || (forPreview ? "" : "PROVISIONAL"),
    template_version: 1,
    document_version: "job-transmittal-pdf-v1",
  };
}

export async function previewJobTransmittal(draft: JobTransmittalDraft): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke("generate-job-transmittal-pdf", {
    body: { action: "draft-preview", snapshot: buildTransmittalSnapshot(draft, true) },
  });
  if (error) await throwFunctionError(error);
  if (data instanceof Blob) return data;
  if (data instanceof ArrayBuffer) return new Blob([data], { type: "application/pdf" });
  throw new Error("The transmittal preview returned an invalid document.");
}

export async function issueJobTransmittal(
  draft: JobTransmittalDraft,
  requestedNumber: string | null = draft.transmittalNumber.trim() || null,
): Promise<{ id: string; number: string }> {
  const { data, error } = await supabase.rpc("issue_job_transmittal", {
    p_job_id: draft.jobId,
    p_requested_number: requestedNumber,
    p_snapshot: buildTransmittalSnapshot(draft),
    p_actor: draft.senderName.trim(),
  });
  if (error) {
    const message = String(error.message || "Unable to issue the Letter of Transmittal.");
    if (message.includes("TRANSMITTAL_NUMBER_REQUIRED_WITHOUT_JOB_NUMBER")) {
      throw new Error("Enter a Transmittal Number because this Production Job does not yet have a Job Number.");
    }
    if (message.includes("DOCUMENT_NUMBER_FORMAT_INVALID")) {
      throw new Error("Use a Transmittal Number in NNNN-NNN format, such as 0904-001.");
    }
    if (message.includes("DOCUMENT_NUMBER_COLLISION")) {
      throw new Error("That Transmittal Number is already in use. Enter another number.");
    }
    throw new Error(message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("The Letter of Transmittal was not issued.");
  return { id: String(row.transmittal_id), number: String(row.transmittal_number) };
}

export async function generateJobTransmittalPdf(id: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("generate-job-transmittal-pdf", {
    body: { action: "generate", transmittalId: id },
  });
  if (error) await throwFunctionError(error);
  if (!data?.url) throw new Error(String(data?.error || "The permanent PDF was not generated."));
  return String(data.url);
}

export async function getJobTransmittalPdfUrl(id: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("generate-job-transmittal-pdf", {
    body: { action: "preview", transmittalId: id },
  });
  if (error) await throwFunctionError(error);
  if (!data?.url) throw new Error(String(data?.error || "The permanent PDF is unavailable."));
  return String(data.url);
}

export async function loadProvisionalTransmittalNumber(jobId: string): Promise<string> {
  const { data, error } = await supabase.rpc("preview_next_job_document_number", {
    p_job_id: jobId,
  });
  if (error) throw error;
  return String(data ?? "");
}

export async function downloadJobTransmittalPdf(id: string, filename: string): Promise<void> {
  const url = await getJobTransmittalPdfUrl(id);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The PDF download failed with status ${response.status}.`);
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
