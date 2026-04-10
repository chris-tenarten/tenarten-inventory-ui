'use client';

import { useEffect, useState } from 'react';

export default function LoginGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('tenarten-auth');
    if (stored === 'true') setAuthed(true);
    setReady(true);
  }, []);

  const handleLogin = () => {
    if (password === 'tenarten123') {
      localStorage.setItem('tenarten-auth', 'true');
      setAuthed(true);
    } else {
      alert('Incorrect password');
    }
  };

  if (!ready) return null;

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="mb-6 text-center">
            <img
              src="/logo.png"
              alt="Tenarten logo"
              className="mx-auto mb-4 h-12 w-auto object-contain"
            />
            <h1 className="text-2xl font-semibold text-[#f7f0d0]">
              Tenarten Inventory
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Internal access only
            </p>
          </div>

          <input
            type="password"
            placeholder="Enter access password"
            className="mb-4 w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleLogin();
              }
            }}
            autoFocus
          />

          <button
            onClick={handleLogin}
            className="w-full rounded-xl bg-yellow-600 py-3 font-medium text-black transition hover:bg-yellow-500"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}