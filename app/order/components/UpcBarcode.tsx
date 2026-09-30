"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

import { barcodeFormatForUpc } from "@/lib/catalogUpc";

export function UpcBarcode({
  value,
  className = "catalog-qty-card-upc",
}: {
  value: string;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const digits = String(value || "").replace(/\D/g, "");

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !digits) return;

    const render = (format: string) => {
      JsBarcode(svg, digits, {
        format,
        displayValue: true,
        fontSize: 10,
        textMargin: 1,
        height: 32,
        width: 1.15,
        margin: 0,
        background: "transparent",
        lineColor: "#111827",
      });
    };

    try {
      render(barcodeFormatForUpc(digits));
    } catch {
      try {
        render("CODE128");
      } catch {
        svg.replaceChildren();
      }
    }
  }, [digits]);

  if (!digits) return null;

  return (
    <div className={`${className}-wrap`}>
      <svg ref={svgRef} className={className} role="img" aria-label={`UPC ${digits}`} />
    </div>
  );
}
