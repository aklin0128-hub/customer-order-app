import fs from "fs";
import path from "path";

export function loadCustomers() {
  const filePath = path.join(process.cwd(), "data/customers.csv");

  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, "utf-8");

  const lines = raw.split("\n").filter(Boolean);

  const [header, ...rows] = lines;

  return rows.map((row) => {
    const [accountNo, storeName, password, active] = row.split(",");

    return {
      accountNo: accountNo.trim(),
      storeName: storeName.replace(/"/g, "").trim(),
      password: password.trim(),
      active: active.trim().toUpperCase() === "TRUE",
    };
  });
}