export type TransmittalItem = {
  id: string;
  submittal: string;
  quantity: string;
  date: string;
  number: string;
  description: string;
};

export type JobTransmittalDraft = {
  jobId: string;
  jobNumber: string;
  jobName: string;
  customer: string;
  transmittalNumber: string;
  documentDate: string;
  recipient: {
    company: string;
    addressLine1: string;
    addressLine2: string;
    attention: string;
    officePhone: string;
    mobilePhone: string;
    email: string;
  };
  cc: string;
  deliveryAttached: boolean;
  deliverySeparateCover: boolean;
  deliveryVia: string;
  typeShopDrawing: boolean;
  typeLetter: boolean;
  typeSamples: boolean;
  typeOther: boolean;
  typeOtherLabel: string;
  items: TransmittalItem[];
  purposeApproval: boolean;
  purposeUse: boolean;
  purposeRecord: boolean;
  purposeRfi: boolean;
  purposeReview: boolean;
  reviewBy: string;
  comments: string;
  senderName: string;
  senderPhone: string;
  senderEmail: string;
};

export type JobTransmittalRecord = {
  id: string;
  jobId: string;
  transmittalNumber: string;
  documentDate: string;
  recipientName: string;
  generatedBy: string;
  documentStatus: "pending" | "generating" | "generated" | "failed";
  documentError: string;
  generationAttempts: number;
  recoverable: boolean;
  generatedAt: string;
  issuedAt: string;
};
