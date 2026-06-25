import * as XLSX from "xlsx";

import {
  averageGpPercent,
  padEmptyWeekdays,
  type WeeklySalesReportResult,
} from "@/lib/weeklySalesReport";

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return Math.round(value * 100) / 100;
}

function cell(value: string | number | null | undefined) {
  if (value == null) return "";
  return value;
}

/** Build S70-style weekly sales report workbook (sheet name S70). */
export function weeklySalesReportToXlsxBuffer(report: WeeklySalesReportResult): Buffer {
  const { meta } = report;
  const rows = padEmptyWeekdays(report.rows);
  const avgGp = meta.averageGpPercent ?? averageGpPercent(rows);
  const grid: (string | number)[][] = [];

  grid.push(["WEEKLY SALES REPORT", "", "DATE:", meta.reportDate, "", ""]);
  grid.push(["REGION:", meta.regionCode, "", "SID:", meta.sid, ""]);
  grid.push([]);

  grid.push([
    "방문 지역\nVISIT AREA",
    "",
    "전체 시장 상황 및 특이 사항\nMARKET OVERVIEW & KEY ISSUES",
    "",
    "",
    "",
  ]);
  grid.push([meta.visitArea, "", meta.marketOverview, "", "", ""]);

  grid.push([
    "방문 일정\nWORKING SCHEDULE",
    "CID",
    "Sales ($)",
    "GP (%)",
    "거래처별 동향\nCUSTOMER/MARKET INSIGHTS",
    "특이 사항\nNOTES",
  ]);

  let lastDay = "";
  for (const row of rows) {
    const dayLabel = row.weekday !== lastDay ? row.weekday : "";
    if (row.cid) lastDay = row.weekday;
    grid.push([
      dayLabel,
      row.cid,
      money(row.sales),
      row.gpPercent == null ? "" : row.gpPercent,
      row.insights,
      row.notes,
    ]);
  }

  grid.push(["", "TOTAL", money(meta.totalSales), avgGp == null ? "" : avgGp, "", ""]);
  grid.push([]);

  grid.push(["제품 관련 정보\nPRODUCT UPDATE", "", "", "", "", ""]);
  grid.push([meta.productUpdate, "", "", "", "", ""]);
  grid.push([]);

  grid.push(["경쟁사 정보\nCOMPETITOR INSIGHT", "", "", "", "", ""]);
  grid.push([meta.competitorInsight, "", "", "", "", ""]);
  grid.push([]);

  grid.push(["기타 건의 사항\nSUGGESTIONS", "", "", "", "", ""]);
  grid.push([meta.suggestions, "", "", "", "", ""]);

  const sheet = XLSX.utils.aoa_to_sheet(grid);

  const dataEndRow = grid.findIndex((row) => row[1] === "TOTAL");
  const bottomStart = grid.findIndex((row) => row[0] === "제품 관련 정보\nPRODUCT UPDATE");

  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
    { s: { r: 3, c: 2 }, e: { r: 3, c: 5 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
    { s: { r: 4, c: 2 }, e: { r: 4, c: 5 } },
  ];

  if (dataEndRow >= 0) {
    sheet["!merges"].push({ s: { r: dataEndRow, c: 0 }, e: { r: dataEndRow, c: 0 } });
  }

  if (bottomStart >= 0) {
    sheet["!merges"].push(
      { s: { r: bottomStart, c: 0 }, e: { r: bottomStart, c: 5 } },
      { s: { r: bottomStart + 1, c: 0 }, e: { r: bottomStart + 1, c: 5 } },
      { s: { r: bottomStart + 3, c: 0 }, e: { r: bottomStart + 3, c: 5 } },
      { s: { r: bottomStart + 4, c: 0 }, e: { r: bottomStart + 4, c: 5 } },
      { s: { r: bottomStart + 6, c: 0 }, e: { r: bottomStart + 6, c: 5 } },
      { s: { r: bottomStart + 7, c: 0 }, e: { r: bottomStart + 7, c: 5 } }
    );
  }

  sheet["!cols"] = [
    { wch: 16 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 48 },
    { wch: 22 },
  ];

  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < 6; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const v = grid[r]?.[c];
      if (v === "" || v == null) {
        sheet[addr] = { t: "s", v: "" };
        continue;
      }
      if (typeof v === "number") {
        sheet[addr] = { t: "n", v };
      } else {
        sheet[addr] = { t: "s", v: cell(v) };
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "S70");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
