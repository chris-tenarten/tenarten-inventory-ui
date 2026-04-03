import Link from 'next/link';

const walkthroughSteps = [
  {
    title: '1. Start in Catalog',
    description:
      'Search by vendor, item, size, or unit. This is where you compare similar materials and capture notes about mismatch risk.',
  },
  {
    title: '2. Save annotations',
    description:
      'Use notes, match warnings, and appearance notes to document things like “same name, different look” across vendors.',
  },
  {
    title: '3. Log inventory movement',
    description:
      'Use Transactions to record intake, outtake, or adjustments. This is the new append-only audit trail.',
  },
  {
    title: '4. Review Inventory',
    description:
      'Append View shows balances derived from transactions. Current Inventory shows the legacy/current table for comparison.',
  },
];

export default function DashboardPage() {
  return (
    <div className="min-h-[calc(100vh-73px)] bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#bda86a]">
            Tenarten Terrazzo
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-[#f7f0d0]">
            Inventory & Material Management
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-neutral-400">
            This UI separates catalog search, notes, and inventory transactions from Monday while
            still supporting material planning and comparison workflows.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/catalog"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:border-[#c8a43a] hover:bg-neutral-900"
          >
            <div className="text-lg font-semibold text-[#f7f0d0]">Catalog</div>
            <p className="mt-2 text-sm text-neutral-400">
              Search vendor materials, compare similar items, and save warnings or appearance notes.
            </p>
          </Link>

          <Link
            href="/transactions"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:border-[#c8a43a] hover:bg-neutral-900"
          >
            <div className="text-lg font-semibold text-[#f7f0d0]">Transactions</div>
            <p className="mt-2 text-sm text-neutral-400">
              Log intake, outtake, or adjustments without editing database rows directly.
            </p>
          </Link>

          <Link
            href="/inventory"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:border-[#c8a43a] hover:bg-neutral-900"
          >
            <div className="text-lg font-semibold text-[#f7f0d0]">Inventory</div>
            <p className="mt-2 text-sm text-neutral-400">
              Compare append-derived balances against the current inventory table.
            </p>
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h2 className="text-xl font-semibold text-[#f7f0d0]">Guided walkthrough</h2>
            <div className="mt-4 space-y-4">
              {walkthroughSteps.map((step) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-neutral-800 bg-black/40 p-4"
                >
                  <div className="font-medium text-[#f7f0d0]">{step.title}</div>
                  <p className="mt-1 text-sm text-neutral-400">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h2 className="text-xl font-semibold text-[#f7f0d0]">What each page means</h2>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="font-medium text-white">Catalog</div>
                <p className="mt-1 text-neutral-400">
                  Best for finding the right material and documenting vendor-specific differences.
                </p>
              </div>

              <div>
                <div className="font-medium text-white">Transactions</div>
                <p className="mt-1 text-neutral-400">
                  Best for recording stock movement. Think of this as the event log.
                </p>
              </div>

              <div>
                <div className="font-medium text-white">Inventory → Append View</div>
                <p className="mt-1 text-neutral-400">
                  Computed from transactions. This is the new, auditable model.
                </p>
              </div>

              <div>
                <div className="font-medium text-white">Inventory → Current Inventory</div>
                <p className="mt-1 text-neutral-400">
                  Reads the existing inventory table directly. Useful as a reference while the new flow is being proven out.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <h2 className="text-xl font-semibold text-[#f7f0d0]">Intended workflow</h2>
          <ol className="mt-4 space-y-3 text-sm text-neutral-300">
            <li>1. Start on Catalog and search for a known item.</li>
            <li>2. Show how notes and warnings can explain why similarly named materials should not be mixed.</li>
            <li>3. Go to Transactions and submit a simple intake or outtake.</li>
            <li>4. Go to Inventory and show the Append View updating from that transaction.</li>
            <li>5. Flip to Current Inventory to show the legacy/current state for comparison.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}