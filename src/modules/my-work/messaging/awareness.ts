import { CoalescedRead } from '@/lib/coalesced-read';
import { loadConversationSummaries, loadInboxRecipients } from '../inbox';

/** One owner per mounted authenticated shell account. No private module cache.
 * Brief reuse bridges shell/menu/dialog opens; meaningful changes always refresh. */
export class MessagingAwareness {
  readonly summaries = new CoalescedRead(loadConversationSummaries, 2000);
  readonly recipients = new CoalescedRead(loadInboxRecipients, 30000);
  readonly unread: CoalescedRead<number>;

  constructor(readonly userId: string) {
    this.unread = new CoalescedRead(async () => (await this.summaries.read()).reduce((sum,row)=>sum+row.unread,0), 2000);
  }

  overview(refresh = false) {
    return Promise.all([
      refresh ? this.summaries.refresh() : this.summaries.read(),
      refresh ? this.unread.refresh() : this.unread.read(),
    ]);
  }

  invalidateOverview() {
    this.summaries.invalidate();
    this.unread.invalidate();
  }

  reset() {
    this.summaries.reset();
    this.recipients.reset();
    this.unread.reset();
  }
}
