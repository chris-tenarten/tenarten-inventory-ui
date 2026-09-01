import { supabase } from '@/lib/supabase';
import type { Bid, BidActivity, BidOwner, BidStatus } from './types';

type BidRow={id:string;customer:string;project_name:string;creator_user_id:string;creator_name:string;owner_user_id:string;owner_name:string;status:BidStatus;deposit_received_date:string|null;created_at:string;updated_at:string};
const mapBid=(row:BidRow):Bid=>({id:row.id,customer:row.customer,projectName:row.project_name,creatorUserId:row.creator_user_id,creatorName:row.creator_name,ownerUserId:row.owner_user_id,ownerName:row.owner_name,status:row.status,depositReceivedDate:row.deposit_received_date??'',createdAt:row.created_at,updatedAt:row.updated_at});

export async function loadBids(){const{data,error}=await supabase.rpc('list_bids');if(error)throw error;return((data??[]) as BidRow[]).map(mapBid);}
export async function loadBidOwners(){const{data,error}=await supabase.rpc('list_bid_owners');if(error)throw error;return((data??[]) as Array<{user_id:string;display_name:string}>).map((row):BidOwner=>({userId:row.user_id,displayName:row.display_name}));}
export async function loadBidActivity(bidId:string){const{data,error}=await supabase.rpc('list_bid_activity',{p_bid_id:bidId});if(error)throw error;return((data??[]) as Array<{id:string;activity_type:string;actor_user_id:string;actor_name:string;occurred_at:string;details:Record<string,unknown>}>).map((row):BidActivity=>({id:row.id,activityType:row.activity_type,actorUserId:row.actor_user_id,actorName:row.actor_name,occurredAt:row.occurred_at,details:row.details??{}}));}
export async function createBid(customer:string,projectName:string){const{data,error}=await supabase.rpc('create_bid',{p_customer:customer,p_project_name:projectName});if(error)throw error;return data as string;}
export async function updateBid(bid:Pick<Bid,'id'|'customer'|'projectName'|'ownerUserId'|'status'|'depositReceivedDate'>){const{error}=await supabase.rpc('update_bid',{p_bid_id:bid.id,p_customer:bid.customer,p_project_name:bid.projectName,p_owner_user_id:bid.ownerUserId,p_status:bid.status,p_deposit_received_date:bid.depositReceivedDate||null});if(error)throw error;}
