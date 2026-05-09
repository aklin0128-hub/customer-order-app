import fs from "fs";
import path from "path";

// 👉 修改这个路径（你的 customers.ts）
import { customers } from "../data/customers";

const outputPath = path.join(process.cwd(), "data/customers.csv");

// CSV header
const header = ["accountNo", "storeName", "password", "active"];

// 转换函数
function toCSV(data: any[]) {
  const rows = data.map((c) => [
    c.accountNo,
    `"${c.storeName || ""}"`,
    c.password || "",
    c.active ? "TRUE" : "FALSE",
  ]);

  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

// 写文件
const csv = toCSV(customers);

fs.writeFileSync(outputPath, csv, "utf-8");

console.log("✅ customers.csv 已生成:");
console.log(outputPath);