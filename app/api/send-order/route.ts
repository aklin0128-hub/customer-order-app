import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prependOrderHistory } from "@/lib/orderHistory";
import { incrementClearanceSold } from "@/lib/clearance";
import { incrementNdhSold } from "@/lib/ndh";
import { incrementPromotionSold } from "@/lib/promotions";
import { isValidOrderEmail, resolveCustomerOrderEmail } from "@/lib/customerOrderEmail";
import { getCustomerByAccount, upsertCustomerContact } from "@/lib/customers";
import { mergeRecentItems } from "@/lib/recentItems";
import { getMergedCatalogProducts } from "@/lib/catalogMerge";
import { isOrderableCatalogStatus } from "@/lib/orderableCatalog";
import {
  buildOrderEmail,
  splitOrderLinesForEmail,
  type OrderEmailLine,
} from "@/lib/orderSubmitEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

type OrderLine = OrderEmailLine;

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
      .map((item: any) => {
        const ndh = Boolean(item?.ndh);
        return {
          sku: String(item?.sku || "").trim().toUpperCase(),
          qty: String(item?.qty || "").trim(),
          ndh,
          nhItems: Boolean(item?.nhItems) && !ndh,
          expiryDate: ndh ? String(item?.expiryDate || "").trim() || undefined : undefined,
        };
      })
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
        if (item.ndh) return null;
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
          error: `These items are not available to order (only NORMAL / NORMAL_* / TBD): ${skus}`,
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

    const { catalog: catalogItems, ndh: ndhItems } = splitOrderLinesForEmail(cleanedItems);
    const companionSplit = catalogItems.length > 0 && ndhItems.length > 0;
    const from = process.env.ORDER_FROM_EMAIL || "orders@rhorder.online";

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

    const sendBatch = async (kind: "catalog" | "ndh", batch: OrderLine[]) => {
      if (!batch.length) return;
      const email = buildOrderEmail({
        kind,
        accountNo,
        storeName,
        phone,
        note,
        orderEmail,
        orderRef: finalOrderRef,
        items: batch,
        companionSplit,
      });
      await resend.emails.send({
        from,
        to: orderEmail,
        subject: email.subject,
        text: email.text,
        attachments: [
          {
            filename: email.filename,
            content: Buffer.from(email.csv).toString("base64"),
          },
        ],
      });
    };

    await sendBatch("catalog", catalogItems);
    await sendBatch("ndh", ndhItems);

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
    const ndhSoldQtyItems = cleanedItems
      .filter((item) => item.ndh)
      .map((item) => ({
        sku: item.sku,
        qty: Number(item.qty) || 0,
        expiryDate: item.expiryDate,
      }));

    await prependOrderHistory(order);
    await mergeRecentItems(accountNo, cleanedItems);
    await incrementPromotionSold(soldQtyItems);
    await incrementClearanceSold([
      ...nhSoldQtyItems,
      ...ndhSoldQtyItems.map((item) => ({ sku: item.sku, qty: item.qty })),
    ]);
    await incrementNdhSold(ndhSoldQtyItems);

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
