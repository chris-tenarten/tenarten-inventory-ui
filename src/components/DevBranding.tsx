import Image from "next/image";

export function DevWordmarkOverlay() {
  return (
    <Image
      data-dev-branding-wordmark
      src="/dev-branding/tendev-overlay.webp"
      alt=""
      aria-hidden="true"
      width={1918}
      height={820}
      priority
      className="pointer-events-none absolute -left-3 top-[20%] z-20 h-auto w-20 -translate-y-1/2 rotate-[4deg] select-none sm:w-24"
    />
  );
}

export function DevLoginWordmark() {
  return (
    <span className="pointer-events-none relative mx-auto inline-block w-48 select-none sm:w-56">
      <Image
        data-dev-branding-login-wordmark
        src="/dev-branding/tendev-overlay.webp"
        alt="TenDev"
        width={1918}
        height={820}
        priority
        className="h-auto w-full"
      />
      <span
        data-dev-branding-login-environment
        className="absolute -right-12 top-[32%] block h-8 w-24 sm:-right-14"
        aria-hidden="true"
      >
        <Image
          src="/dev-branding/development-environment.webp"
          alt=""
          width={1536}
          height={1024}
          priority
          className="absolute left-1/2 top-[25%] h-auto w-[5.1rem] -translate-x-1/2 -translate-y-1/2 sm:w-[5.75rem]"
        />
        <Image
          src="/dev-branding/chris-tag.webp"
          alt=""
          width={1536}
          height={1024}
          priority
          className="absolute left-1/2 top-[55%] h-auto w-12 -translate-x-1/2 rotate-[-2deg] sm:w-[3.6rem]"
        />
      </span>
    </span>
  );
}

export function DevEnvironmentLockup() {
  return (
    <span data-dev-branding-environment className="pointer-events-none relative block h-5 w-20 shrink-0 select-none">
      <Image
        src="/dev-branding/development-environment.webp"
        alt=""
        aria-hidden="true"
        width={1536}
        height={1024}
        priority
        className="absolute left-1/2 top-[25%] h-auto w-[4.25rem] -translate-x-1/2 -translate-y-1/2 sm:w-[4.8rem]"
      />
    </span>
  );
}
