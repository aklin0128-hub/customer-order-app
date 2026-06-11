"use client";

type Props = {
  count: number;
  label: string;
  hidden?: boolean;
  onClick: () => void;
};

export function OrderFloatingCartFab({ count, label, hidden, onClick }: Props) {
  return (
    <button
      type="button"
      className={`order-floating-cart-fab${hidden ? " is-hidden" : ""}`}
      onClick={onClick}
      aria-label={count > 0 ? `${label} (${count})` : label}
    >
      <span className="order-floating-cart-fab-ring" aria-hidden>
        <svg className="order-floating-cart-fab-icon" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 6.5h14.2l-1.4 8.2a1.6 1.6 0 0 1-1.58 1.3H8.2a1.6 1.6 0 0 1-1.58-1.3L4.8 4.5H3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.5" cy="19.5" r="1.5" fill="currentColor" />
          <circle cx="17" cy="19.5" r="1.5" fill="currentColor" />
        </svg>
      </span>
      {count > 0 ? (
        <span className="order-floating-cart-fab-badge">{count > 99 ? "99+" : count}</span>
      ) : null}
    </button>
  );
}
