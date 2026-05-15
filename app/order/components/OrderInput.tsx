"use client";

export function OrderInput({
  label,
  value,
  onChange,
  placeholder,
  inputRef,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onEnter?: () => void;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, textAlign: "center" }}>
        {label}
      </label>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
          placeholder={placeholder}
          style={{
            width: "70%",
            minWidth: 220,
            maxWidth: 320,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            fontSize: 15,
            background: "#ffffff",
            outline: "none",
            boxSizing: "border-box",
            textAlign: "center",
          }}
        />
      </div>
    </div>
  );
}
