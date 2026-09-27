import { QRCodeCanvas } from "qrcode.react";

export function QRCodeCard({ value }: { value: string }) {
  return (
    <div className="qr-card">
      <QRCodeCanvas value={value} size={180} />
      <code>{value}</code>
    </div>
  );
}
