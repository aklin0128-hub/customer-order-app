import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prependOrderHistory } from "@/lib/orderHistory";
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

function buildCsv(items: any[]) {
  const rows = [["SKU", "Qty"]];

  for (const item of items) {
    rows.push([String(item?.sku || "").trim().toUpperCase(), String(item?.qty || "").trim()]);
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

    const cleanedItems = items
      .map((item: any) => ({
        sku: String(item?.sku || "").trim().toUpperCase(),
        qty: String(item?.qty || "").trim(),
      }))
      .filter((item: any) => item.sku && item.qty);

    if (cleanedItems.length === 0) {
      return NextResponse.json(
        { error: "No valid items in order." },
        { status: 400 }
      );
    }

    const finalOrderRef =
      orderRef ||
      `${accountNo}-${new Date().toISOString().slice(5, 10).replace("-", "")}`;

    const csv = buildCsv(cleanedItems);

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
        ``,
        ...cleanedItems.map((item: any) => `${item.sku} - ${item.qty}`),
      ].join("\n"),
      attachments: [
        {
          filename,
          content: Buffer.from(csv).toString("base64"),
        },
      ],
    });

    await prependOrderHistory(order);
    await mergeRecentItems(accountNo, cleanedItems);
    await incrementPromotionSold(cleanedItems);

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