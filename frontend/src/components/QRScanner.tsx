import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function QRScanner({ onScan }: { onScan: (value: string) => void }) {
  const id = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const scanner = new Html5Qrcode(id.current);
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decoded) => onScan(decoded),
      () => {}
    ).catch(console.error);

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onScan]);

  return <div id={id.current} className="scanner" />;
}
