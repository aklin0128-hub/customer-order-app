"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

export type OrderBarcodeScannerLabels = {
  title: string;
  hint: string;
  close: string;
  cameraError: string;
  torchOn: string;
  torchOff: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  labels: OrderBarcodeScannerLabels;
};

const SCAN_COOLDOWN_MS = 800;

const cameraConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 },
  focusMode: { ideal: "continuous" },
} as MediaTrackConstraints;

function scanRegionSize(viewfinderWidth: number, viewfinderHeight: number) {
  return {
    width: Math.min(Math.round(viewfinderWidth * 0.96), 480),
    height: Math.min(Math.round(viewfinderHeight * 0.5), 220),
  };
}

export function OrderBarcodeScanner({ open, onClose, onScan, labels }: Props) {
  const readerId = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  onScanRef.current = onScan;

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
      const next = !torchOn;
      await torch.apply(next);
      setTorchOn(next);
    } catch (err) {
      console.error(err);
    }
  }, [torchOn]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setTorchOn(false);
      setTorchAvailable(false);
      scannerRef.current = null;
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
          useBarCodeDetectorIfSupported: true,
        });
        scannerRef.current = scanner;

        await scanner.start(
          cameraConstraints,
          {
            fps: 18,
            qrbox: scanRegionSize,
            aspectRatio: 1.777778,
            videoConstraints: cameraConstraints,
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

        if (!mounted) return;

        try {
          await scanner.applyVideoConstraints({
            focusMode: "continuous",
            advanced: [{ focusMode: "continuous" }],
          } as unknown as MediaTrackConstraints);
        } catch {
          // Some browsers reject advanced focus hints — camera still works.
        }

        try {
          setTorchAvailable(scanner.getRunningTrackCameraCapabilities().torchFeature().isSupported());
        } catch {
          setTorchAvailable(false);
        }
      } catch (err) {
        if (!mounted) return;
        console.error(err);
        setError(labels.cameraError);
      }
    })();

    return () => {
      mounted = false;
      scannerRef.current = null;
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
          <div className="order-barcode-scanner-actions">
            {torchAvailable ? (
              <button
                type="button"
                className={`order-barcode-scanner-torch${torchOn ? " is-on" : ""}`}
                onClick={() => void toggleTorch()}
                aria-label={torchOn ? labels.torchOff : labels.torchOn}
                aria-pressed={torchOn}
              >
                {torchOn ? "🔦" : "💡"}
              </button>
            ) : null}
            <button type="button" className="order-barcode-scanner-close" onClick={onClose} aria-label={labels.close}>
              ×
            </button>
          </div>
        </div>
        <p className="order-barcode-scanner-hint">{labels.hint}</p>
        {error ? <p className="order-barcode-scanner-error">{error}</p> : null}
        <div id={readerId} className="order-barcode-scanner-view" />
      </div>
    </div>
  );
}
