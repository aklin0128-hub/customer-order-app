import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prependOrderHistory } from "@/lib/orderHistory";
import {
  CLEARANCE_ORDER_EMAIL_TAG,
  getActiveClearanceSkuSet,
  incrementClearanceSold,
} from "@/lib/clearance";
import { incrementPromotionSold } from "@/lib/promotions";
import { mergeRecentItems } from "@/lib/recentItems";

const resend = new Resend(process.env.RESEND_API_KEY);

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

type OrderLine = { sku: string; qty: string };

function formatOrderLine(item: OrderLine, clearanceSkus: Set<string>) {
  const sku = String(item.sku || "").trim().toUpperCase();
  const qty = String(item.qty || "").trim();
  if (clearanceSkus.has(sku)) {
    return `${sku} - ${qty} - ${CLEARANCE_ORDER_EMAIL_TAG}`;
  }
  return `${sku} - ${qty}`;
}

function buildCsv(items: OrderLine[], clearanceSkus: Set<string>) {
  const rows = [["SKU", "Qty", "Tag"]];

  for (const item of items) {
    const sku = String(item.sku || "").trim().toUpperCase();
    const qty = String(item.qty || "").trim();
    const tag = clearanceSkus.has(sku) ? CLEARANCE_ORDER_EMAIL_TAG : "";
    rows.push([sku, qty, tag]);
  }

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const accountNo = String(body?.accountNo || "").trim().toUpperCase();
    const storeName = String(body?.storeName || "").trim();
    const phone = String(body?.phone || "").trim();
    const note = String(body?.note || "").trim();
    const orderRef = String(body?.orderRef || "").trim();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!accountNo || !storeName) {
      return NextResponse.json(
        { error: "Missing account information." },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No items in order." },
        { status: 400 }
      );
    }

    const cleanedItems: OrderLine[] = items
      .map((item: any) => ({
        sku: String(item?.sku || "").trim().toUpperCase(),
        qty: String(item?.qty || "").trim(),
      }))
      .filter((item: OrderLine) => item.sku && item.qty);

    if (cleanedItems.length === 0) {
      return NextResponse.json(
        { error: "No valid items in order." },
        { status: 400 }
      );
    }

    const finalOrderRef =
      orderRef ||
      `${accountNo}-${new Date().toISOString().slice(5, 10).replace("-", "")}`;

    const clearanceSkus = await getActiveClearanceSkuSet();
    const csv = buildCsv(cleanedItems, clearanceSkus);
    const clearanceLineCount = cleanedItems.filter((item) =>
      clearanceSkus.has(item.sku)
    ).length;

    const today = new Date().toISOString().slice(0, 10);
    const filename = `${accountNo}_order_${today}.csv`;

    const order = {
      accountNo,
      storeName,
      phone,
      note,
      orderRef: finalOrderRef,
      items: cleanedItems,
      createdAt: new Date().toISOString(),
    };

    await resend.emails.send({
      from: process.env.ORDER_FROM_EMAIL || "orders@rhorder.online",
      to: process.env.ORDER_TO_EMAIL || process.env.ORDER_FROM_EMAIL || "orders@rhorder.online",
      subject: `New Order - ${accountNo} - ${storeName} - ${finalOrderRef}`,
      text: [
        `New order received.`,
        ``,
        `Account: ${accountNo}`,
        `Store: ${storeName}`,
        `Phone: ${phone || "-"}`,
        `Note: ${note || "-"}`,
        `Ref: ${finalOrderRef}`,
        `Items: ${cleanedItems.length}`,
        ...(clearanceLineCount > 0
          ? [`Clearance (${CLEARANCE_ORDER_EMAIL_TAG}): ${clearanceLineCount}`, ``]
          : []),
        ...cleanedItems.map((item) => formatOrderLine(item, clearanceSkus)),
      ].join("\n"),
      attachments: [
        {
          filename,
          content: Buffer.from(csv).toString("base64"),
        },
      ],
    });

    const soldQtyItems = cleanedItems.map((item) => ({
      sku: item.sku,
      qty: Number(item.qty) || 0,
    }));

    await prependOrderHistory(order);
    await mergeRecentItems(accountNo, cleanedItems);
    await incrementPromotionSold(soldQtyItems);
    await incrementClearanceSold(soldQtyItems);

    return NextResponse.json({
      success: true,
      message: "Order submitted successfully.",
      orderRef: finalOrderRef,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to submit order." },
      { status: 500 }
    );
  }
}