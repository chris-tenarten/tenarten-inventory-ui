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

const ANTHONY_SENDER = {
  name: "Anthony",
  phone: "469-491-7002",
  email: "sales@tenartenterrazzo.com",
};

export function createJobTransmittalDraft(job: ProductionJob): JobTransmittalDraft {
  const colorPlateNumber = job.color_plate_number?.trim() ?? "";
  const items = colorPlateNumber
    ? [{
        id: crypto.randomUUID(),
        submittal: "Color Plate",
        quantity: "1",
        date: job.sample_submitted_date ?? "",
        number: colorPlateNumber,
        description: job.name,
      }]
    : [createTransmittalItem()];

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
    typeSamples: Boolean(colorPlateNumber),
    typeOther: false,
    typeOtherLabel: "",
    items,
    purposeApproval: false,
    purposeUse: false,
    purposeRecord: false,
    purposeRfi: false,
    purposeReview: false,
    reviewBy: "",
    comments: "",
    senderName: ANTHONY_SENDER.name,
    senderPhone: ANTHONY_SENDER.phone,
    senderEmail: ANTHONY_SENDER.email,
  };
}
