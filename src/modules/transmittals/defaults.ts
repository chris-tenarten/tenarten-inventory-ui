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

export function createJobTransmittalDraft(job: ProductionJob): JobTransmittalDraft {
  return {
    jobId: job.id,
    jobNumber: job.job_number ?? "",
    jobName: job.name,
    customer: job.customer ?? "",
    transmittalNumber: "",
    documentDate: today(),
    recipient: {
      company: job.customer ?? "",
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
    senderName: "",
    senderPhone: "",
    senderEmail: "",
  };
}

