import type { ProductionJob } from "@/modules/production/types";
import type { JobTransmittalDraft, TransmittalItem } from "./types";

const today = () => {
  const value = new Date();
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

export const createTransmittalItem = (): TransmittalItem => ({
  id: crypto.randomUUID(),
  submittal: "",
  quantity: "",
  date: "",
  number: "",
  description: "",
});

const DEFAULT_SENDER = {
  name: "",
  phone: "",
  email: "",
};

export function createStandaloneTransmittalDraft(): JobTransmittalDraft {
  return {
    jobId: "",
    jobNumber: "",
    jobName: "",
    customer: "",
    transmittalNumber: "",
    documentDate: today(),
    recipient: {
      company: "",
      addressLine1: "",
      addressLine2: "",
      attention: "",
      officePhone: "",
      mobilePhone: "",
      email: "",
    },
    cc: "",
    deliveryAttached: true,
    deliverySeparateCover: false,
    deliveryVia: "",
    typeShopDrawing: false,
    typeLetter: false,
    typeSamples: false,
    typeOther: false,
    typeOtherLabel: "",
    items: [createTransmittalItem()],
    purposeApproval: false,
    purposeUse: false,
    purposeRecord: false,
    purposeRfi: false,
    purposeReview: false,
    reviewBy: "",
    comments: "",
    senderName: DEFAULT_SENDER.name,
    senderPhone: DEFAULT_SENDER.phone,
    senderEmail: DEFAULT_SENDER.email,
  };
}

export function createJobTransmittalDraft(job: ProductionJob): JobTransmittalDraft {
  const colorPlateNumber = job.color_plate_number?.trim() ?? "";
  const draft = createStandaloneTransmittalDraft();

  return {
    ...draft,
    jobId: job.id,
    jobNumber: job.job_number ?? "",
    jobName: job.name,
    customer: job.customer ?? "",
    recipient: {
      ...draft.recipient,
      company: job.customer ?? "",
    },
    typeSamples: Boolean(colorPlateNumber),
    items: colorPlateNumber
      ? [{
          id: crypto.randomUUID(),
          submittal: "Color Plate",
          quantity: "1",
          date: job.sample_submitted_date ?? "",
          number: colorPlateNumber,
          description: job.name,
        }]
      : draft.items,
  };
}
