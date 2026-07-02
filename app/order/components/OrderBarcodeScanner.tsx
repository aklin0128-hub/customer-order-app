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
  const startingRef = useRef(false);
  onScanRef.current = onScan;

  const refreshTorchAvailability = useCallback(() => {
    const scanner = scannerRef.current;
    if (!scanner) {
      setTorchAvailable(false);
      return;
    }
    try {
      setTorchAvailable(scanner.getRunningTrackCameraCapabilities().torchFeature().isSupported());
    } catch {
      setTorchAvailable(false);
    }
  }, []);

  const turnOffTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
      if (torch.value()) {
        await torch.apply(false);
      }
    } catch {
      // Torch may be unavailable after pause.
    }
    setTorchOn(false);
  }, []);

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
    return () => {
      const scanner = scannerRef.current;
      if (!scanner) return;
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {});
      scannerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncScanner = async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } = await import(
        "html5-qrcode"
      );
      if (!mounted) return;

      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          useBarCodeDetectorIfSupported: true,
        });
        scannerRef.current = scanner;
      }

      const state = scanner.getState();

      if (!open) {
        if (state === Html5QrcodeScannerState.SCANNING) {
          await turnOffTorch();
          scanner.pause(true);
        }
        return;
      }

      setError(null);

      if (state === Html5QrcodeScannerState.PAUSED) {
        scanner.resume();
        refreshTorchAvailability();
        return;
      }

      if (state === Html5QrcodeScannerState.SCANNING || startingRef.current) {
        return;
      }

      startingRef.current = true;
      try {
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

        refreshTorchAvailability();
      } catch (err) {
        if (!mounted) return;
        console.error(err);
        setError(labels.cameraError);
      } finally {
        startingRef.current = false;
      }
    };

    void syncScanner();
  }, [open, readerId, labels.cameraError, refreshTorchAvailability, turnOffTorch]);

  return (
    <div
      className={`order-barcode-scanner${open ? "" : " is-hidden"}`}
      role="dialog"
      aria-modal={open}
      aria-hidden={!open}
      aria-label={labels.title}
    >
      <button
        type="button"
        className="order-barcode-scanner-backdrop"
        onClick={onClose}
        aria-label={labels.close}
        tabIndex={open ? 0 : -1}
      />
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
                tabIndex={open ? 0 : -1}
              >
                {torchOn ? "🔦" : "💡"}
              </button>
            ) : null}
            <button
              type="button"
              className="order-barcode-scanner-close"
              onClick={onClose}
              aria-label={labels.close}
              tabIndex={open ? 0 : -1}
            >
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
