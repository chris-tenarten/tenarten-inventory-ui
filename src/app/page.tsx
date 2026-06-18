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

function WorkflowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="font-semibold text-[#c8a43a]">{number}.</div>
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-sm text-neutral-400">{description}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-[calc(100vh-73px)] bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-7">
          <p className="text-xs uppercase tracking-[0.3em] text-[#bda86a]">
            Tenarten Inventory
          </p>

          <h1 className="mt-2 text-4xl font-semibold text-[#f7f0d0]">
            Inventory Dashboard
          </h1>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-400">
            Search current stock, add or remove materials, and keep a clean
            history of inventory changes. Catalog records are used as helpful
            suggestions, but new or custom materials can still be entered
            directly.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ActionCard
            href="/inventory"
            title="Inventory"
            description="Search current stock, locations, pallets, and reserved materials."
            cta="Open Inventory"
          />

          <ActionCard
            href="/transactions"
            title="Add Inventory"
            description="Add stock, remove stock, or record material movement."
            cta="Add or Remove Stock"
          />

          <ActionCard
            href="/catalog"
            title="Catalog"
            description="Look up vendor material references and suggestions."
            cta="Open Catalog"
          />
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-700 text-xs text-neutral-300">
              i
            </div>

            <div className="flex-1">
              <div className="text-sm font-semibold text-white">
                How this workflow works
              </div>

              <div className="mt-1 max-w-3xl text-sm text-neutral-400">
                Inventory is the current source of truth. Add Inventory records
                stock changes and keeps a history in the background.
              </div>

              <div className="mt-6 space-y-6">
                <WorkflowStep
                  number="1"
                  title="Find the material in Inventory"
                  description="Search by vendor, material, size, category, location, or pallet."
                />

                <WorkflowStep
                  number="2"
                  title="Add or remove stock"
                  description="Use Add Inventory when materials are received, used, moved, or corrected."
                />

                <WorkflowStep
                  number="3"
                  title="Use Catalog as a reference"
                  description="Catalog records help with consistent names and sizes, but custom materials can still be entered when needed."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}