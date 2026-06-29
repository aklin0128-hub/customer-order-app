import { getComingSoonBadgeLabel, type ComingSoonBadgeLang } from "@/lib/comingSoonBadge";

const STAMP_SRC = "/coming-soon-stamp.png";

export function ComingSoonStamp({
  className = "",
  lang = "en",
}: {
  className?: string;
  lang?: ComingSoonBadgeLang;
}) {
  const label = getComingSoonBadgeLabel(lang);

  return (
    <div
      className={`coming-soon-stamp-overlay${className ? ` ${className}` : ""}`}
      aria-label={label}
      role="img"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={STAMP_SRC} alt="" draggable={false} />
    </div>
  );
}
