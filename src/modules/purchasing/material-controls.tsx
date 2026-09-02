"use client";

import { useState } from "react";
import type { VendorOption } from "./types";

export const purchasingQuantityUnits = ["gal", "lb", "oz", "ea", "sq ft", "lin ft"];
export const purchasingContainerTypes = ["pail", "drum", "bag", "box", "case", "tote"];

export function PurchasingChoiceWithCustom({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: string[];
  onChange(value: string): void;
  className: string;
}) {
  const recognized = options.find((option) => option.toLowerCase() === value.trim().toLowerCase());
  const [custom, setCustom] = useState(Boolean(value) && !recognized);
  const showCustom = !recognized && (custom || Boolean(value));

  return (
    <div>
      <select
        value={showCustom ? "__other" : recognized || ""}
        onChange={(event) => {
          if (event.target.value === "__other") {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(event.target.value);
          }
        }}
        className={className}
      >
        <option value="">Not specified</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        <option value="__other">Other</option>
      </select>
      {showCustom && (
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter custom value"
          className={className}
        />
      )}
    </div>
  );
}

export function PurchasingVendorNameInput({
  id,
  value,
  vendors,
  onChange,
  className,
}: {
  id: string;
  value: string;
  vendors: VendorOption[];
  onChange(value: string): void;
  className: string;
}) {
  const optionsId = `${id}-options`;
  return (
    <>
      <input
        id={id}
        list={optionsId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      />
      <datalist id={optionsId}>
        {vendors.map((vendor) => <option key={vendor.id} value={vendor.name} />)}
      </datalist>
    </>
  );
}
