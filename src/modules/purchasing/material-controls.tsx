"use client";

import { BusinessSelect, BusinessInput } from '@/components/BusinessWriteControls';

import SuggestionInput from '@/components/SuggestionInput';

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
      <BusinessSelect
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
      </BusinessSelect>
      {showCustom && (
        <BusinessInput
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
  ariaLabel = "Vendor",
  value,
  vendors,
  onChange,
  className,
}: {
  id: string;
  ariaLabel?: string;
  value: string;
  vendors: VendorOption[];
  onChange(value: string): void;
  className: string;
}) {
  return <SuggestionInput ariaLabel={ariaLabel} id={id} value={value} options={vendors.map(vendor=>vendor.name)} onChange={onChange} className={className}/>;
}
