"use client";

import type { ComponentProps } from "react";
import { useAuth } from "@/lib/auth";

// Generic restriction, independent of department, identity and visibility.
// Existing action-specific authorization still applies through disabled/hidden props.
export function BusinessButton(props: ComponentProps<"button">) {
  const auth = useAuth();
  return <button {...props} disabled={props.disabled || !auth.can("writeBusinessData")} />;
}
export function BusinessInput(props: ComponentProps<"input">) {
  const auth = useAuth();
  return <input {...props} disabled={props.disabled || !auth.can("writeBusinessData")} />;
}
export function BusinessSelect(props: ComponentProps<"select">) {
  const auth = useAuth();
  return <select {...props} disabled={props.disabled || !auth.can("writeBusinessData")} />;
}
export function BusinessTextarea(props: ComponentProps<"textarea">) {
  const auth = useAuth();
  return <textarea {...props} disabled={props.disabled || !auth.can("writeBusinessData")} />;
}
