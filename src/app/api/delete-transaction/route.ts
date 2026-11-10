import { NextResponse } from "next/server";
import { authorizeServerRequest, createServiceClient } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    await authorizeServerRequest(request, "adjustInventory");

    const { transactionId } = await request.json();

    if (!transactionId || typeof transactionId !== "string") {
      return NextResponse.json(
        { error: "A valid transactionId is required." },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

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
    if (error instanceof Response) return error;
    console.error("Unexpected delete-transaction error:", error);
    return NextResponse.json(
      { error: "Unexpected server error while deleting transaction." },
      { status: 500 },
    );
  }
}
