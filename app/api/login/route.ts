import { NextResponse } from "next/server";
import { resolveCustomerOrderEmail } from "@/lib/customerOrderEmail";
import { getCustomerByAccount, normalizeAccountNo } from "@/lib/customers";
import { loadCustomers } from "@/lib/loadCustomers";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const accountNo = normalizeAccountNo(body?.accountNo || "");
    const password = String(body?.password || "").trim();

    if (!accountNo || !password) {
      return NextResponse.json(
        { error: "Missing account number or password." },
        { status: 400 }
      );
    }

    const customer = await getCustomerByAccount(accountNo);

    if (customer) {
      if (!customer.active) {
        return NextResponse.json({ error: "Account inactive." }, { status: 401 });
      }

      if (String(customer.password || "").trim() !== password) {
        return NextResponse.json(
          { error: "Invalid account number or password." },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        customer: {
          accountNo,
          storeName: customer.storeName || "",
          orderEmail: resolveCustomerOrderEmail(customer.email),
          phone: customer.phone || "",
        },
      });
    }

    const csvCustomer = loadCustomers().find(
      (c) =>
        c.active &&
        normalizeAccountNo(c.accountNo) === accountNo &&
        String(c.password || "").trim() === password
    );

    if (!csvCustomer) {
      return NextResponse.json(
        { error: "Invalid account number or password." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: {
        accountNo: csvCustomer.accountNo,
        storeName: csvCustomer.storeName,
        orderEmail: resolveCustomerOrderEmail(),
        phone: "",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Login failed." },
      { status: 500 }
    );
  }
}