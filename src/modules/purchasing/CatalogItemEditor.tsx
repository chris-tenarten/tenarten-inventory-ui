"use client";

import { useState } from "react";
import { savePurchasingCatalogItem } from "./mutations";
import { getPurchasingCatalogCategory } from "./catalog-category";
import type {
  PurchasingCatalogItemInput,
  PurchasingCatalogSuggestion,
  VendorOption,
} from "./types";

const field = "mt-1 h-10 w-full border border-slate-300 px-3 text-sm";
const label = "text-xs font-bold uppercase tracking-[0.08em] text-slate-600";
export default function CatalogItemEditor({
  vendors,
  defaultVendorId,
  existing,
  suggestedMode,
  proposedPrice,
  onCancel,
  onSaved,
}: {
  vendors: VendorOption[];
  defaultVendorId: string;
  existing?: PurchasingCatalogSuggestion;
  suggestedMode?: "individual" | "bulk" | "truckload";
  proposedPrice?: string;
  onCancel(): void;
  onSaved(item: PurchasingCatalogSuggestion): void;
}) {
  const matchedVendor =
    vendors.find((v) => v.id === defaultVendorId) ||
    vendors.find((v) => v.name === existing?.vendor);
  const [draft, setDraft] = useState<PurchasingCatalogItemInput>({
    id: existing?.source === "specialty" ? existing.id : undefined,
    vendorId: matchedVendor?.id || "",
    vendorSku: existing?.vendorSku || "",
    itemName: existing?.materialName || "",
    category: getPurchasingCatalogCategory(existing),
    size: existing?.chipSize || "",
    unitSize: existing?.packageQuantity || "",
    unitSizeUom: existing?.packageMeasure || "LB",
    packaging: existing?.containerType || "Bag",
    price:
      suggestedMode === "individual" && proposedPrice !== undefined
        ? proposedPrice
        : existing?.referencePrice || "",
    bulkPrice: existing?.bulkPrice || "",
    bulkMinimumQuantity: existing?.bulkMinimumQuantity || "",
    bulkMinimumUom:
      existing?.bulkMinimumUom || (suggestedMode === "bulk" ? "Bag" : ""),
    truckloadPrice: existing?.truckloadPrice || "",
    truckloadMinimumQuantity:
      existing?.truckloadMinimumQuantity ||
      (suggestedMode === "truckload" ? "900" : ""),
    truckloadMinimumUom:
      existing?.truckloadMinimumUom ||
      (suggestedMode === "truckload" ? "Bag" : ""),
    priceUnit: existing?.priceBasis || "",
    leadTimeDays:
      existing?.leadTimeDays === null || existing?.leadTimeDays === undefined
        ? ""
        : String(existing.leadTimeDays),
    minimumOrderQty: existing?.minimumOrder.split(" ")[0] || "",
    minimumOrderUom: existing?.minimumOrder.split(" ").slice(1).join(" ") || "",
    productLine: "",
    materialType: "chip",
    notes: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (
    key: keyof PurchasingCatalogItemInput,
    value: string | boolean,
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (Number(draft.price) < 0 || Number(draft.bulkPrice) < 0 || Number(draft.truckloadPrice) < 0) {
      setError("Catalog prices cannot be negative.");
      return;
    }
    if (
      (draft.bulkPrice || draft.bulkMinimumQuantity) &&
      (!(Number(draft.bulkMinimumQuantity) > 0) || !draft.bulkMinimumUom)
    ) {
      setError(
        "Bulk price requires a positive minimum quantity and compatible unit.",
      );
      return;
    }
    if (
      (draft.truckloadPrice || draft.truckloadMinimumQuantity) &&
      (!(Number(draft.truckloadMinimumQuantity) > 0) || !draft.truckloadMinimumUom)
    ) {
      setError(
        "Truckload price requires a positive minimum quantity and compatible unit.",
      );
      return;
    }
    const fieldName =
      suggestedMode === "truckload"
        ? "Truckload Catalog Price"
        : suggestedMode === "bulk"
        ? "Bulk Catalog Price"
        : "Individual Catalog Price";
    const oldValue =
      suggestedMode === "truckload"
        ? existing?.truckloadPrice
        : suggestedMode === "bulk"
          ? existing?.bulkPrice
          : existing?.referencePrice;
    const newValue =
      suggestedMode === "truckload"
        ? draft.truckloadPrice
        : suggestedMode === "bulk"
          ? draft.bulkPrice
          : draft.price;
    if (
      existing &&
      !window.confirm(
        `${draft.id ? "Update" : "Save as"} ${fieldName}?\n\nCurrent: ${oldValue || "Not set"}\nNew: ${newValue || "Not set"}\n\nHistorical Purchase Orders will not change.`,
      )
    )
      return;
    setSaving(true);
    setError("");
    try {
      const id = await savePurchasingCatalogItem(draft);
      const vendor = vendors.find((v) => v.id === draft.vendorId);
      onSaved({
        source: "specialty",
        id,
        vendor: vendor?.name || "",
        vendorSku: draft.vendorSku,
        materialName: draft.itemName,
        chipSize: draft.size,
        packageQuantity: draft.unitSize,
        packageMeasure: draft.unitSizeUom,
        containerType: draft.packaging,
        materialType: draft.materialType,
        referencePrice: draft.price,
        bulkPrice: draft.bulkPrice,
        bulkMinimumQuantity: draft.bulkMinimumQuantity,
        bulkMinimumUom: draft.bulkMinimumUom,
        truckloadPrice: draft.truckloadPrice,
        truckloadMinimumQuantity: draft.truckloadMinimumQuantity,
        truckloadMinimumUom: draft.truckloadMinimumUom,
        priceBasis: draft.priceUnit,
        leadTimeDays: draft.leadTimeDays ? Number(draft.leadTimeDays) : null,
        minimumOrder: [draft.minimumOrderQty, draft.minimumOrderUom]
          .filter(Boolean)
          .join(" "),
        score: 10,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : typeof caught === "object" &&
              caught !== null &&
              "message" in caught &&
              typeof caught.message === "string"
            ? caught.message
            : "Unable to save catalog item.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      role="region"
      aria-label="Catalog pricing configuration"
      className="mx-3 mb-3 rounded-sm border border-blue-200 bg-blue-50/60 p-3"
    >
      <div className="flex items-center justify-between border-b border-blue-200 pb-3">
        <div>
          <div className="text-sm font-bold">
            {draft.id
              ? "Maintain Vendor Catalog Pricing"
              : existing
                ? "Create Maintained Vendor Catalog Item"
              : "Create Vendor Catalog Item"}
          </div>
          <div className="text-xs text-slate-600">
            Catalog changes are explicit; this Purchase Order remains
            independently editable.
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 border border-slate-300 bg-white px-2 text-xs font-bold"
        >
          Cancel
        </button>
      </div>
      {error && (
        <div role="alert" className="mt-2 text-xs font-bold text-red-700">
          {error}
        </div>
      )}
      <div className="mx-auto mt-4 grid max-w-[1040px] gap-3 px-2 sm:grid-cols-3">
        <label className={label}>
          Vendor
          <select
            className={field}
            value={draft.vendorId}
            onChange={(e) => set("vendorId", e.target.value)}
          >
            <option value="">Select Vendor</option>
            {vendors
              .filter((v) => v.isActive)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>
        </label>
        <label className={label}>
          Material
          <input
            className={field}
            value={draft.itemName}
            onChange={(e) => set("itemName", e.target.value)}
            readOnly={Boolean(draft.id)}
          />
        </label>
        <label className={label}>
          Vendor SKU
          <input
            className={field}
            value={draft.vendorSku}
            onChange={(e) => set("vendorSku", e.target.value)}
            readOnly={Boolean(draft.id)}
          />
        </label>
        <label className={label}>
          Chip Size
          <input
            className={field}
            value={draft.size}
            onChange={(e) => set("size", e.target.value)}
            readOnly={Boolean(draft.id)}
          />
        </label>
        <label className={label}>
          Amount Per Container
          <input
            className={field}
            value={draft.unitSize}
            onChange={(e) => set("unitSize", e.target.value)}
            readOnly={Boolean(draft.id)}
          />
        </label>
        <label className={label}>
          Measure
          <select
            className={field}
            value={draft.unitSizeUom}
            onChange={(e) => set("unitSizeUom", e.target.value)}
            disabled={Boolean(draft.id)}
          >
            <option>LB</option>
            <option>KG</option>
            <option>OZ</option>
          </select>
        </label>
        <label className={label}>
          Container
          <input
            className={field}
            value={draft.packaging}
            onChange={(e) => set("packaging", e.target.value)}
            readOnly={Boolean(draft.id)}
          />
        </label>
        <label className={label}>
          Individual Price
          <input
            inputMode="decimal"
            className={field}
            value={draft.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </label>
        <label className={label}>
          Bulk Price - Optional
          <input
            inputMode="decimal"
            className={field}
            value={draft.bulkPrice}
            onChange={(e) => set("bulkPrice", e.target.value)}
          />
          <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-slate-500">
            Leave blank for Call for pricing.
          </span>
        </label>
        <label className={label}>
          Bulk Minimum Quantity
          <input
            inputMode="decimal"
            className={field}
            value={draft.bulkMinimumQuantity}
            onChange={(e) => set("bulkMinimumQuantity", e.target.value)}
          />
        </label>
        <label className={label}>
          Bulk Minimum Unit
          <input
            className={field}
            value={draft.bulkMinimumUom}
            onChange={(e) => set("bulkMinimumUom", e.target.value)}
          />
        </label>
        <label className={label}>
          Truckload Price - Optional
          <input
            inputMode="decimal"
            className={field}
            value={draft.truckloadPrice}
            onChange={(e) => set("truckloadPrice", e.target.value)}
          />
          <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-slate-500">
            Leave blank for Call for pricing.
          </span>
        </label>
        <label className={label}>
          Truckload Minimum Quantity
          <input
            inputMode="decimal"
            className={field}
            value={draft.truckloadMinimumQuantity}
            onChange={(e) => set("truckloadMinimumQuantity", e.target.value)}
          />
        </label>
        <label className={label}>
          Truckload Minimum Unit
          <input
            className={field}
            value={draft.truckloadMinimumUom}
            onChange={(e) => set("truckloadMinimumUom", e.target.value)}
          />
        </label>
        <label className={label}>
          Price Basis
          <input
            className={field}
            value={draft.priceUnit}
            onChange={(e) => set("priceUnit", e.target.value)}
          />
        </label>
        {!draft.id && (
          <>
            <label className={label}>
              Minimum Order
              <input
                inputMode="decimal"
                className={field}
                value={draft.minimumOrderQty}
                onChange={(e) => set("minimumOrderQty", e.target.value)}
              />
            </label>
            <label className={label}>
              Minimum Unit
              <input
                className={field}
                value={draft.minimumOrderUom}
                onChange={(e) => set("minimumOrderUom", e.target.value)}
              />
            </label>
          </>
        )}
      </div>
      <button
        type="button"
        disabled={saving || !draft.vendorId || !draft.itemName.trim()}
        onClick={() => void save()}
        className="mx-auto mt-4 block h-9 bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50"
      >
        {saving
          ? "Saving…"
          : draft.id
            ? suggestedMode === "truckload"
              ? existing?.truckloadPrice
                ? "Update Truckload Pricing"
                : "Save Truckload Pricing Tier"
              : suggestedMode === "bulk"
              ? existing?.bulkPrice
                ? "Update Bulk Pricing"
                : "Save Bulk Pricing Tier"
              : "Update Individual Catalog Price"
            : existing
              ? suggestedMode === "truckload"
                ? "Create Maintained Item with Truckload Tier"
                : suggestedMode === "bulk"
                  ? "Create Maintained Item with Bulk Tier"
                  : "Save as Individual Catalog Price"
              : "Create and Use Catalog Item"}
      </button>
    </div>
  );
}
