import Link from "next/link";

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
      className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 transition hover:border-[#c8a43a] hover:bg-neutral-900"
    >
      <div className="text-base font-semibold text-[#f7f0d0]">{title}</div>
      <p className="mt-2 text-sm text-neutral-400">{description}</p>
      <div className="mt-3 text-sm font-medium text-[#c8a43a]">{cta} →</div>
    </Link>
  );
}

function ReleaseRow({
  title,
  status,
  statusClassName,
  bullets,
  hideDivider = false,
}: {
  title: string;
  status: string;
  statusClassName: string;
  bullets: string[];
  hideDivider?: boolean;
}) {
  return (
    <div
      className={`${
        hideDivider ? "" : "border-b border-neutral-800"
      } py-4 first:pt-0 last:pb-0`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-semibold tracking-wide text-white">
          {title}
        </div>

        <div
          className={`rounded-md border px-2.5 py-0.5 text-[11px] ${statusClassName}`}
        >
          {status}
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 text-sm text-neutral-400">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-neutral-500" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-[calc(100vh-73px)] bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-7">
          <p className="text-xs uppercase tracking-[0.3em] text-[#bda86a]">
            System Overview
          </p>

          <h1 className="mt-2 text-4xl font-semibold text-[#f7f0d0]">
            Inventory Operations Dashboard
          </h1>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-400">
            This interface separates material catalog search, vendor-specific notes,
            and inventory transaction logging from ad hoc edits. The goal is to make
            inventory movement more traceable, reduce ambiguity between similar materials,
            and provide a clearer path toward reliable stock validation.
          </p>

          <div className="mt-5 rounded-2xl border border-neutral-800 bg-black/30 p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-semibold text-[#f7f0d0]">
                  Release 1.0.0
                </div>
                <div className="text-xs text-neutral-500">
                  Current system capabilities
                </div>
              </div>

              <div className="rounded-md border border-[#5a4b1a] bg-[#1a1610] px-2.5 py-0.5 text-[11px] text-[#f7f0d0]">
                Internal Preview
              </div>
            </div>

            <div className="mt-4">
              <ReleaseRow
                title="Catalog"
                status="Live"
                statusClassName="border-green-900 bg-green-950/40 text-green-300"
                bullets={[
                  "Search vendor material records by item, size, and category.",
                  "Attach notes, warnings, and appearance guidance.",
                  "Reduce ambiguity between similar material names.",
                ]}
              />

              <ReleaseRow
                title="Transactions"
                status="Live"
                statusClassName="border-green-900 bg-green-950/40 text-green-300"
                bullets={[
                  "All inventory movement is logged as append-only events.",
                  "Provides traceable history instead of silent edits.",
                  "Supports auditing and troubleshooting.",
                ]}
              />

              <ReleaseRow
                title="Sync Layer"
                status="Planned"
                statusClassName="border-yellow-900 bg-yellow-950/40 text-yellow-300"
                bullets={[
                  "Append balances can be compared with current inventory.",
                  "Automatic sync is not finalized yet.",
                  "Current phase focuses on validation before full replacement.",
                ]}
                hideDivider
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <ActionCard
            href="/catalog"
            title="Catalog"
            description="Search and validate materials before use."
            cta="Open"
          />
          <ActionCard
            href="/transactions"
            title="Transactions"
            description="Record intake, outtake, and adjustments."
            cta="Open"
          />
          <ActionCard
            href="/inventory"
            title="Inventory"
            description="Compare balances against current state."
            cta="Open"
          />
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-700 text-xs text-neutral-300">
              i
            </div>

            <div className="flex-1">
              <div className="text-sm font-semibold text-white">
                How this workflow is intended to work
              </div>
              <div className="mt-1 max-w-3xl text-sm text-neutral-400">
                The goal is to reduce material ambiguity, preserve inventory history,
                and validate a more reliable operating model before replacing the
                legacy approach.
              </div>

              <div className="mt-6 space-y-6">
                <div className="flex gap-4">
                  <div className="text-[#c8a43a] font-semibold">1.</div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      Confirm the material in Catalog
                    </div>
                    <div className="mt-1 text-sm text-neutral-400">
                      Search by vendor, item, size, or category first so similarly named
                      materials do not get treated as equivalent when they are not.
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="text-[#c8a43a] font-semibold">2.</div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      Record stock movement as a transaction
                    </div>
                    <div className="mt-1 text-sm text-neutral-400">
                      Intake, outtake, and adjustments are logged as events so inventory
                      changes are traceable instead of being silently overwritten.
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="text-[#c8a43a] font-semibold">3.</div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      Validate balances in Inventory
                    </div>
                    <div className="mt-1 text-sm text-neutral-400">
                      Compare append-derived balances against the current inventory table
                      while the new workflow is being proven out and sync behavior is still pending.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}