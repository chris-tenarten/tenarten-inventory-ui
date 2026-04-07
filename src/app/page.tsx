import Link from 'next/link';

function ActionCard({
  href,
  title,
  description,
  cta,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:border-[#c8a43a] hover:bg-neutral-900"
    >
      <div className="text-lg font-semibold text-[#f7f0d0]">{title}</div>
      <p className="mt-2 text-sm text-neutral-400">{description}</p>
      <div className="mt-4 text-sm font-medium text-[#c8a43a]">{cta} →</div>
    </Link>
  );
}

function ReleaseSection({
  title,
  status,
  statusClassName,
  bullets,
}: {
  title: string;
  status: string;
  statusClassName: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-black/40 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-base font-semibold text-white">{title}</div>
        <div className={`rounded-full border px-3 py-1 text-xs ${statusClassName}`}>
          {status}
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-sm text-neutral-400">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-3">
            <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-neutral-500" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-neutral-800 bg-black/40 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c8a43a] font-semibold text-black">
        {number}
      </div>
      <div>
        <div className="font-medium text-white">{title}</div>
        <p className="mt-1 text-sm text-neutral-400">{description}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-[calc(100vh-73px)] bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-[#bda86a]">
            System Overview
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[#f7f0d0]">
            Inventory Operations Dashboard
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-neutral-400">
            This interface separates material catalog search, vendor-specific notes,
            and inventory transaction logging from ad hoc edits. The goal is to make
            inventory movement more traceable, reduce ambiguity between similar materials,
            and provide a clearer path toward reliable stock validation.
          </p>

          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/40 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold text-[#f7f0d0]">
                  Release 1.0.0
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  Current application state and active workflow surfaces.
                </div>
              </div>

              <div className="rounded-full border border-[#5a4b1a] bg-[#1a1610] px-3 py-1 text-xs text-[#f7f0d0]">
                Internal Preview
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <ReleaseSection
                title="Catalog"
                status="Live"
                statusClassName="border-green-900 bg-green-950/40 text-green-300"
                bullets={[
                  'Vendor material records are searchable by item, size, unit, category, and class.',
                  'Notes, match warnings, and appearance notes can be saved directly on catalog entries.',
                  'Intended to reduce ambiguity when similar material names do not produce the same visual result.',
                ]}
              />

              <ReleaseSection
                title="Transactions"
                status="Live"
                statusClassName="border-green-900 bg-green-950/40 text-green-300"
                bullets={[
                  'Intake, outtake, and adjustment events are being written to the append-only transaction log.',
                  'This creates a visible history of inventory movement rather than silent overwrites.',
                  'The transaction flow is meant to support auditability and easier troubleshooting.',
                ]}
              />

              <ReleaseSection
                title="Sync Layer"
                status="Planned"
                statusClassName="border-yellow-900 bg-yellow-950/40 text-yellow-300"
                bullets={[
                  'Append-derived balances are visible now and can be compared against the legacy current inventory table.',
                  'Automatic synchronization into the current inventory table is not final yet.',
                  'The current phase is focused on validating the new workflow before replacing the old method.',
                ]}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <ActionCard
            href="/catalog"
            title="Start in Catalog"
            description="Find the right material, compare vendors, and document mismatch or appearance risk before stock movement."
            cta="Open Catalog"
          />
          <ActionCard
            href="/transactions"
            title="Log Inventory Movement"
            description="Record intake, outtake, or adjustments as transactions instead of silently overwriting inventory state."
            cta="Open Transactions"
          />
          <ActionCard
            href="/inventory"
            title="Review Inventory Views"
            description="Compare append-derived balances against the current inventory table to validate the new workflow."
            cta="Open Inventory"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="text-lg font-semibold text-[#f7f0d0]">
              Recommended operating flow
            </div>

            <div className="mt-5 space-y-4">
              <FlowStep
                number="1"
                title="Confirm the material"
                description="Use Catalog to confirm vendor, size, and any known visual or substitution risks."
              />
              <FlowStep
                number="2"
                title="Record movement as an event"
                description="Use Transactions to post intake, outtake, or adjustment activity into the append-only log."
              />
              <FlowStep
                number="3"
                title="Validate inventory position"
                description="Use Inventory to compare append-derived balances with the current inventory table while the workflow is being validated."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="text-lg font-semibold text-[#f7f0d0]">
              Why this system exists
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                <div className="font-medium text-white">Reduce ambiguity</div>
                <p className="mt-2 text-neutral-400">
                  Similar names across vendors do not always mean equivalent material appearance or behavior.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                <div className="font-medium text-white">Preserve history</div>
                <p className="mt-2 text-neutral-400">
                  Transaction logging makes stock movement traceable instead of relying only on manually edited quantities.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-black/40 p-4">
                <div className="font-medium text-white">Support transition</div>
                <p className="mt-2 text-neutral-400">
                  The app currently shows both the append-derived model and the legacy current inventory table so the workflow can be validated safely.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}