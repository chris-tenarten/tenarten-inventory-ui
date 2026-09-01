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
  createdAt: string;
  updatedAt: string;
};

export type BidOwner = { userId: string; displayName: string };
export type BidActivity = { id: string; activityType: string; actorUserId: string; actorName: string; occurredAt: string; details: Record<string, unknown> };
