import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prependOrderHistory } from "@/lib/orderHistory";
import { CLEARANCE_ORDER_EMAIL_TAG, incrementClearanceSold } from "@/lib/clearance";
import { incrementPromotionSold } from "@/lib/promotions";
import { isValidOrderEmail, resolveCustomerOrderEmail } from "@/lib/customerOrderEmail";
import { getCustomerByAccount, upsertCustomerContact } from "@/lib/customers";
import { mergeRecentItems } from "@/lib/recentItems";
import { getMergedCatalogProducts } from "@/lib/catalogMerge";
import { isOrderableCatalogStatus } from "@/lib/orderableCatalog";

const resend = new Resend(process.env.RESEND_API_KEY);

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

type OrderLine = { sku: string; qty: string; nhItems?: boolean };

function formatOrderLine(item: OrderLine) {
  const sku = String(item.sku || "").trim().toUpperCase();
  const qty = String(item.qty || "").trim();
  if (item.nhItems) {
    return `${sku} - ${qty} - ${CLEARANCE_ORDER_EMAIL_TAG}`;
  }
  return `${sku} - ${qty}`;
}

function buildCsv(items: OrderLine[]) {
  const rows = [["SKU", "Qty", "Tag"]];

  for (const item of items) {
    const sku = String(item.sku || "").trim().toUpperCase();
    const qty = String(item.qty || "").trim();
    const tag = item.nhItems ? CLEARANCE_ORDER_EMAIL_TAG : "";
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
    const orderEmailRaw = String(body?.orderEmail || "").trim();
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
        nhItems: Boolean(item?.nhItems),
      }))
      .filter((item: OrderLine) => item.sku && item.qty);

    if (cleanedItems.length === 0) {
      return NextResponse.json(
        { error: "No valid items in order." },
        { status: 400 }
      );
    }

    const catalogProducts = await getMergedCatalogProducts();
    const catalogBySku = new Map(
      catalogProducts.map((p) => [String(p.sku || "").trim().toUpperCase(), p])
    );
    const notOrderable = cleanedItems
      .map((item) => {
        const product = catalogBySku.get(item.sku);
        if (product && isOrderableCatalogStatus(product.status)) return null;
        return {
          sku: item.sku,
          status: product
            ? String(product.status || "").trim().toUpperCase() || "UNAVAILABLE"
            : "NOT FOUND",
        };
      })
      .filter(Boolean) as Array<{ sku: string; status: string }>;
    if (notOrderable.length > 0) {
      const skus = notOrderable.map((i) => i.sku).join(", ");
      return NextResponse.json(
        {
          error: `These items are not available to order (only NORMAL, NORMAL NOBR, TBD, READYTOORDER): ${skus}`,
          code: "UNAVAILABLE_ITEMS",
          unavailableItems: notOrderable,
        },
        { status: 400 }
      );
    }

    const customer = await getCustomerByAccount(accountNo);
    const orderEmail = resolveCustomerOrderEmail(customer?.email || orderEmailRaw);
    if (!isValidOrderEmail(orderEmail)) {
      return NextResponse.json({ error: "Invalid order email address." }, { status: 400 });
    }

    const finalOrderRef =
      orderRef ||
      `${accountNo}-${new Date().toISOString().slice(5, 10).replace("-", "")}`;

    const csv = buildCsv(cleanedItems);
    const clearanceLineCount = cleanedItems.filter((item) => item.nhItems).length;

    const today = new Date().toISOString().slice(0, 10);
    const filename = `${accountNo}_order_${today}.csv`;

    const order = {
      accountNo,
      storeName,
      phone,
      note,
      orderEmail,
      orderRef: finalOrderRef,
      items: cleanedItems,
      createdAt: new Date().toISOString(),
    };

    try {
      await upsertCustomerContact(accountNo, { phone });
    } catch {
      // Order still sends if profile save fails (e.g. missing customer record).
    }

    await resend.emails.send({
      from: process.env.ORDER_FROM_EMAIL || "orders@rhorder.online",
      to: orderEmail,
      subject: `New Order - ${accountNo} - ${storeName} - ${finalOrderRef}`,
      text: [
        `New order received.`,
        ``,
        `Account: ${accountNo}`,
        `Store: ${storeName}`,
        `Order email: ${orderEmail}`,
        `Phone: ${phone || "-"}`,
        `Note: ${note || "-"}`,
        `Ref: ${finalOrderRef}`,
        `Items: ${cleanedItems.length}`,
        ...(clearanceLineCount > 0
          ? [`Clearance (${CLEARANCE_ORDER_EMAIL_TAG}): ${clearanceLineCount}`, ``]
          : []),
        ...cleanedItems.map((item) => formatOrderLine(item)),
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
    const nhSoldQtyItems = cleanedItems
      .filter((item) => item.nhItems)
      .map((item) => ({
        sku: item.sku,
        qty: Number(item.qty) || 0,
      }));

    await prependOrderHistory(order);
    await mergeRecentItems(accountNo, cleanedItems);
    await incrementPromotionSold(soldQtyItems);
    await incrementClearanceSold(nhSoldQtyItems);

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