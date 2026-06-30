import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server credentials are not configured." },
        { status: 500 },
      );
    }

    const { transactionId } = await request.json();

    if (!transactionId || typeof transactionId !== "string") {
      return NextResponse.json(
        { error: "A valid transactionId is required." },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error } = await supabase
      .from("inventory_transactions")
      .delete()
      .eq("id", transactionId);

    if (error) {
      console.error("Failed to delete inventory transaction:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete transaction." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, transactionId });
  } catch (error) {
    console.error("Unexpected delete-transaction error:", error);
    return NextResponse.json(
      { error: "Unexpected server error while deleting transaction." },
      { status: 500 },
    );
  }
}