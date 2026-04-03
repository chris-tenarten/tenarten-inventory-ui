'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type CatalogRow = {
  id: string;
  vendor: string;
  item_name: string;
  size: string;
  unit: string;
};

export default function TransactionsPage() {
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);

  const [txType, setTxType] = useState('intake');
  const [vendor, setVendor] = useState('');
  const [item, setItem] = useState('');
  const [size, setSize] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    async function loadCatalog() {
      const { data, error } = await supabase
        .from('vendor_catalog')
        .select('id, vendor, item_name, size, unit')
        .order('vendor', { ascending: true })
        .order('item_name', { ascending: true });

      if (error) {
        console.error('Failed to load transaction options:', error);
        return;
      }

      setCatalogRows(data || []);
    }

    loadCatalog();
  }, []);

  const vendors = useMemo(
    () => Array.from(new Set(catalogRows.map((r) => r.vendor))).sort(),
    [catalogRows]
  );

  const vendorItems = useMemo(() => {
    return Array.from(
      new Set(
        catalogRows
          .filter((r) => r.vendor === vendor)
          .map((r) => r.item_name)
      )
    ).sort();
  }, [catalogRows, vendor]);

  const itemSizes = useMemo(() => {
    return Array.from(
      new Set(
        catalogRows
          .filter((r) => r.vendor === vendor && r.item_name === item)
          .map((r) => r.size)
          .filter(Boolean)
      )
    ).sort();
  }, [catalogRows, vendor, item]);

  useEffect(() => {
    const match = catalogRows.find(
      (r) => r.vendor === vendor && r.item_name === item && r.size === size
    );
    setUnit(match?.unit || '');
  }, [catalogRows, vendor, item, size]);

  async function handleSubmitTransaction() {
    setSubmitMessage('');

    if (!vendor || !item || !quantity) {
      setSubmitMessage('Vendor, item, and quantity are required.');
      return;
    }

    const parsedQty = Number(quantity);
    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      setSubmitMessage('Quantity must be a positive number.');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from('inventory_transactions').insert({
      transaction_type: txType,
      vendor,
      item_name: item,
      size: size || null,
      unit: unit || null,
      quantity: parsedQty,
      location: location || null,
      notes: notes || null,
    });

    if (error) {
      console.error('Failed to submit transaction:', error);
      setSubmitMessage(`Failed to submit: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setSubmitMessage('Transaction submitted.');
    setQuantity('');
    setLocation('');
    setNotes('');
    setIsSubmitting(false);
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-[#f7f0d0]">Transactions</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Log intake, outtake, or adjustments here.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-neutral-400">
                Transaction Type
              </label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
              >
                <option value="intake">Intake</option>
                <option value="outtake">Outtake</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-400">Vendor</label>
              <select
                value={vendor}
                onChange={(e) => {
                  setVendor(e.target.value);
                  setItem('');
                  setSize('');
                  setUnit('');
                  setSubmitMessage('');
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
              >
                <option value="">Select vendor</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-400">Item Name</label>
              <input
                value={item}
                onChange={(e) => {
                  setItem(e.target.value);
                  setSize('');
                  setUnit('');
                  setSubmitMessage('');
                }}
                list="item-options"
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                placeholder="Start typing item name"
              />
              <datalist id="item-options">
                {vendorItems.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-400">Size</label>
              <input
                value={size}
                onChange={(e) => {
                  setSize(e.target.value);
                  setSubmitMessage('');
                }}
                list="size-options"
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                placeholder="Start typing size"
              />
              <datalist id="size-options">
                {itemSizes.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-400">Quantity</label>
              <input
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                placeholder="e.g. 20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-400">Unit</label>
              <input
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                placeholder="lb / bag / pallet"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-neutral-400">Location</label>
              <input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                placeholder="Warehouse A"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-neutral-400">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setSubmitMessage('');
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                rows={4}
                placeholder="Optional context, lot note, pallet note, or appearance note"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSubmitTransaction}
              disabled={isSubmitting}
              className="rounded bg-yellow-600 px-4 py-2 text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Transaction'}
            </button>

            <button
              onClick={() => {
                setQuantity('');
                setLocation('');
                setNotes('');
                setSubmitMessage('');
              }}
              className="rounded border border-neutral-700 bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800"
            >
              Reset
            </button>
          </div>

          {submitMessage && (
            <div className="mt-3 text-sm text-neutral-300">{submitMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}