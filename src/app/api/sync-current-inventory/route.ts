import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type InventoryBalanceRow = {
  vendor: string | null;
  item_name: string | null;
  size: string | null;
  qty_on_hand: number | null;
};

type InventoryItemRow = {
  id: string;
  vendor: string | null;
  color: string | null;
  size: string | null;
  quantity: number | null;
  location: string | null;
  pallet_number: string | null;
  earmarked_for_job?: boolean | null;
  earmarked_job?: string | null;
  earmark_notes?: string | null;
};

type InventorySyncStateRow = {
  id: string;
  vendor: string;
  item_name: string;
  size: string;
  last_synced_qty: number;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

function makeInventoryKey(
  vendor: string | null,
  color: string | null,
  size: string | null
) {
  return `${vendor ?? ''}||${color ?? ''}||${size ?? ''}`;
}

function makeSyncKey(
  vendor: string | null,
  itemName: string | null,
  size: string | null
) {
  return `${vendor ?? ''}||${itemName ?? ''}||${size ?? ''}`;
}

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: 'Missing password.' }, { status: 400 });
    }

    if (password !== process.env.ADMIN_ACTION_PASSWORD) {
      return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Missing Supabase server environment variables.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: appendRows, error: appendError } = await supabase
      .from('inventory_balances')
      .select('vendor, item_name, size, qty_on_hand');

    if (appendError) {
      return NextResponse.json({ error: appendError.message }, { status: 500 });
    }

    const { data: currentRows, error: currentError } = await supabase
      .from('inventory_items')
      .select(
        'id, vendor, color, size, quantity, location, pallet_number, earmarked_for_job, earmarked_job, earmark_notes'
      );

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    const { data: syncRows, error: syncError } = await supabase
      .from('inventory_sync_state')
      .select(
        'id, vendor, item_name, size, last_synced_qty, last_synced_at, created_at, updated_at'
      );

    if (syncError) {
      return NextResponse.json({ error: syncError.message }, { status: 500 });
    }

    const appendData = (appendRows ?? []) as InventoryBalanceRow[];
    const currentData = (currentRows ?? []) as InventoryItemRow[];
    const syncData = (syncRows ?? []) as InventorySyncStateRow[];

    const normalizedAppend = appendData
      .filter((row) => row.vendor || row.item_name || row.size)
      .map((row) => ({
        vendor: row.vendor ?? null,
        item_name: row.item_name ?? null,
        color: row.item_name ?? null,
        size: row.size ?? null,
        quantity: Number(row.qty_on_hand ?? 0),
      }));

    const appendMap = new Map<
      string,
      {
        vendor: string | null;
        item_name: string | null;
        color: string | null;
        size: string | null;
        quantity: number;
      }
    >();

    for (const row of normalizedAppend) {
      appendMap.set(makeSyncKey(row.vendor, row.item_name, row.size), row);
    }

    const currentMap = new Map<string, InventoryItemRow>();
    for (const row of currentData) {
      currentMap.set(makeInventoryKey(row.vendor, row.color, row.size), row);
    }

    const syncMap = new Map<string, InventorySyncStateRow>();
    for (const row of syncData) {
      syncMap.set(makeSyncKey(row.vendor, row.item_name, row.size), row);
    }

    const rowsToInsert: Array<{
      vendor: string | null;
      color: string | null;
      size: string | null;
      quantity: number;
      location: string | null;
      pallet_number: string | null;
      earmarked_for_job: boolean;
      earmarked_job: string | null;
      earmark_notes: string | null;
    }> = [];

    const rowsToUpdate: Array<{
      id: string;
      quantity: number;
    }> = [];

    const idsToDelete: string[] = [];

    const syncRowsToUpsert: Array<{
      vendor: string;
      item_name: string;
      size: string;
      last_synced_qty: number;
      last_synced_at: string;
      updated_at: string;
    }> = [];

    const syncIdsToDelete: string[] = [];

    const nowIso = new Date().toISOString();

    for (const [syncKey, appendRow] of appendMap.entries()) {
      const inventoryKey = makeInventoryKey(
        appendRow.vendor,
        appendRow.color,
        appendRow.size
      );

      const existingInventory = currentMap.get(inventoryKey);

      if (!existingInventory) {
        rowsToInsert.push({
          vendor: appendRow.vendor,
          color: appendRow.color,
          size: appendRow.size,
          quantity: appendRow.quantity,
          location: null,
          pallet_number: null,
          earmarked_for_job: false,
          earmarked_job: null,
          earmark_notes: null,
        });
      } else {
        const existingQty = Number(existingInventory.quantity ?? 0);
        if (existingQty !== appendRow.quantity) {
          rowsToUpdate.push({
            id: existingInventory.id,
            quantity: appendRow.quantity,
          });
        }
      }

      syncRowsToUpsert.push({
        vendor: appendRow.vendor ?? '',
        item_name: appendRow.item_name ?? '',
        size: appendRow.size ?? '',
        last_synced_qty: appendRow.quantity,
        last_synced_at: nowIso,
        updated_at: nowIso,
      });
    }

    for (const [, currentRow] of currentMap.entries()) {
      const equivalentSyncKey = makeSyncKey(
        currentRow.vendor,
        currentRow.color,
        currentRow.size
      );

      if (!appendMap.has(equivalentSyncKey)) {
        idsToDelete.push(currentRow.id);
      }
    }

    for (const [syncKey, syncRow] of syncMap.entries()) {
      if (!appendMap.has(syncKey)) {
        syncIdsToDelete.push(syncRow.id);
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('inventory_items')
        .insert(rowsToInsert);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    for (const row of rowsToUpdate) {
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ quantity: row.quantity })
        .eq('id', row.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('inventory_items')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    if (syncRowsToUpsert.length > 0) {
      const { error: upsertSyncError } = await supabase
        .from('inventory_sync_state')
        .upsert(syncRowsToUpsert, {
          onConflict: 'vendor,item_name,size',
        });

      if (upsertSyncError) {
        return NextResponse.json(
          { error: upsertSyncError.message },
          { status: 500 }
        );
      }
    }

    if (syncIdsToDelete.length > 0) {
      const { error: deleteSyncError } = await supabase
        .from('inventory_sync_state')
        .delete()
        .in('id', syncIdsToDelete);

      if (deleteSyncError) {
        return NextResponse.json(
          { error: deleteSyncError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        added: rowsToInsert.length,
        updated: rowsToUpdate.length,
        removed: idsToDelete.length,
        sync_state_upserted: syncRowsToUpsert.length,
        sync_state_removed: syncIdsToDelete.length,
      },
    });
  } catch (error) {
    console.error('sync-current-inventory route error:', error);
    return NextResponse.json(
      { error: 'Server error during inventory sync.' },
      { status: 500 }
    );
  }
}