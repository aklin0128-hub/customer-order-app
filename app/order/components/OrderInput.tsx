"use client";

export function OrderInput({
  label,
  value,
  onChange,
  placeholder,
  inputRef,
  onEnter,
  type = "text",
  inputMode,
  fullWidth = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onEnter?: () => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  /** Fill grid column; label and input align left (customer info row). */
  fullWidth?: boolean;
}) {
  return (
    <div style={fullWidth ? { minWidth: 0 } : undefined}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 700,
          color: "#374151",
          marginBottom: 6,
          textAlign: fullWidth ? "left" : "center",
        }}
      >
        {label}
      </label>
      <div style={{ display: "flex", justifyContent: fullWidth ? "stretch" : "center" }}>
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
          type={type}
          inputMode={inputMode}
          autoComplete={type === "email" ? "email" : undefined}
          style={{
            width: fullWidth ? "100%" : "70%",
            minWidth: fullWidth ? 0 : 220,
            maxWidth: fullWidth ? "none" : 320,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            fontSize: 15,
            background: "#ffffff",
            outline: "none",
            boxSizing: "border-box",
            textAlign: fullWidth ? "left" : "center",
          }}
        />
      </div>
    </div>
  );
}
