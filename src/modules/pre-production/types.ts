export type BidStatus = 'active' | 'won' | 'lost';

export type Bid = {
  id: string;
  customer: string;
  projectName: string;
  creatorUserId: string;
  creatorName: string;
  ownerUserId: string;
  ownerName: string;
  status: BidStatus;
  depositReceivedDate: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type BidOwner = { userId: string; displayName: string };
export type BidActivity = { id: string; activityType: string; actorUserId: string; actorName: string; occurredAt: string; details: Record<string, unknown> };
export type BidUpdate = { id: string; bidId: string; authorUserId: string; authorName: string; body: string; createdAt: string };
export type BidFile = { id: string; bidId: string; uploaderUserId: string; uploaderName: string; storagePath: string; originalFilename: string; contentType: string; byteSize: number; createdAt: string };
