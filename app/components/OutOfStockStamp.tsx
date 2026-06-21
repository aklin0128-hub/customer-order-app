const STAMP_SRC = "/out-of-stock-stamp.png";

export function OutOfStockStamp({ className = "" }: { className?: string }) {
  return (
    <div className={`out-of-stock-stamp-overlay${className ? ` ${className}` : ""}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={STAMP_SRC} alt="" draggable={false} />
    </div>
  );
}
