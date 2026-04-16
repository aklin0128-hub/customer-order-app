import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type OrderItem = {
  sku: string;
  brand?: string;
  name?: string;
  pack?: string;
  status?: string;
  qty: number;
};

function buildCsv(items: OrderItem[]) {
  const headers = ["SKU", "Brand", "Description", "Pack", "Status", "Qty"];

  const escape = (value: string | number | undefined) => {
    const s = String(value ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  return [
    headers.join(","),
    ...items.map((item) =>
      [
        item.sku,
        item.brand,
        item.name,
        item.pack,
        item.status,
        item.qty,
      ]
        .map(escape)
        .join(",")
    ),
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      accountNo,
      storeName,
      notes,
      items,
    }: {
      accountNo?: string;
      storeName?: string;
      notes?: string;
      items?: OrderItem[];
    } = body || {};

    if (!accountNo?.trim()) {
      return NextResponse.json(
        { error: "Missing account number." },
        { status: 400 }
      );
    }

    if (!storeName?.trim()) {
      return NextResponse.json(
        { error: "Missing store name." },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No order items provided." },
        { status: 400 }
      );
    }

    const csvContent = buildCsv(items);

    const lines = items.map((item, index) => {
      return `${index + 1}. ${item.sku}${item.brand ? ` | ${item.brand}` : ""}
${item.name || ""}
${item.pack || "-"}${item.status ? ` | ${item.status}` : ""}
Qty: ${item.qty}`;
    });

    const emailText = `
New customer order submitted.

Account Number: ${accountNo}
Store Name: ${storeName}
Notes: ${notes || "-"}

Items:
${lines.join("\n\n")}
    `.trim();

    const filename = `${accountNo}_order_${new Date()
  .toISOString()
  .slice(0, 10)}.csv`;

const { data, error } = await resend.emails.send({
  from: process.env.ORDER_FROM_EMAIL || "orders@rhorder.online",
  to: ["ak.lin0128@gmail.com"],
  subject: `New Order - ${accountNo} - ${storeName}`,
  text: emailText,
  attachments: [
    {
      filename,
      content: Buffer.from(csvContent).toString("base64"),
    },
  ],
});

    console.log("RESEND data:", data);
    console.log("RESEND error:", error);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to send email." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("ROUTE ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}