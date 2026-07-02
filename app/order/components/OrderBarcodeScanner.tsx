"use client";

import { useEffect, useId, useRef, useState } from "react";

export type OrderBarcodeScannerLabels = {
  title: string;
  hint: string;
  close: string;
  cameraError: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  labels: OrderBarcodeScannerLabels;
};

const SCAN_COOLDOWN_MS = 2000;

export function OrderBarcodeScanner({ open, onClose, onScan, labels }: Props) {
  const readerId = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) {
      setError(null);
      return;
    }

    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let mounted = true;

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!mounted) return;

        const formats = [
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
        ];

        scanner = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: formats,
        });

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.min(viewfinderWidth * 0.85, 320);
              const height = Math.min(viewfinderHeight * 0.35, 160);
              return { width, height };
            },
            disableFlip: true,
          },
          (decodedText) => {
            const code = decodedText.trim();
            if (!code) return;
            const now = Date.now();
            const last = lastScanRef.current;
            if (last && last.code === code && now - last.at < SCAN_COOLDOWN_MS) return;
            lastScanRef.current = { code, at: now };
            onScanRef.current(code);
          },
          () => {}
        );
      } catch (err) {
        if (!mounted) return;
        console.error(err);
        setError(labels.cameraError);
      }
    })();

    return () => {
      mounted = false;
      if (!scanner) return;
      scanner
        .stop()
        .then(() => scanner?.clear())
        .catch(() => {});
    };
  }, [open, readerId, labels.cameraError]);

  if (!open) return null;

  return (
    <div className="order-barcode-scanner" role="dialog" aria-modal="true" aria-label={labels.title}>
      <button type="button" className="order-barcode-scanner-backdrop" onClick={onClose} aria-label={labels.close} />
      <div className="order-barcode-scanner-panel">
        <div className="order-barcode-scanner-header">
          <h2 className="order-barcode-scanner-title">{labels.title}</h2>
          <button type="button" className="order-barcode-scanner-close" onClick={onClose} aria-label={labels.close}>
            ×
          </button>
        </div>
        <p className="order-barcode-scanner-hint">{labels.hint}</p>
        {error ? <p className="order-barcode-scanner-error">{error}</p> : null}
        <div id={readerId} className="order-barcode-scanner-view" />
      </div>
    </div>
  );
}
