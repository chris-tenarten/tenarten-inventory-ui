import Link from "next/link";

const settings = [
  {
    href: "/purchasing",
    title: "Vendors & Contacts",
    description: "Open Purchasing to maintain Vendor profiles and contacts.",
  },
  {
    href: "/manpower-reporting",
    title: "Workers & Tasks",
    description: "Open Manpower Reporting to maintain labor references.",
  },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        Administration
      </div>
      <h1 className="mt-1 text-3xl font-bold text-slate-950">Settings</h1>
      <p className="mt-1 text-sm text-slate-600">
        Operational configuration remains with the module that owns it.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {settings.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="border border-slate-300 bg-white p-4 transition hover:border-slate-500 hover:bg-slate-50"
          >
            <div className="font-bold text-slate-950">{item.title}</div>
            <div className="mt-1 text-sm text-slate-600">{item.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
