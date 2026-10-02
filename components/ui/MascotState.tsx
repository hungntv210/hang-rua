import Image from "next/image";

export type MascotKind = "loading" | "empty" | "error";

/** Mỗi trạng thái một dáng: chờ = lắc nhẹ, trống = cúi nhìn xuống, lỗi = nghiêng. */
const POSE_CLASS: Record<MascotKind, string> = {
  loading: "animate-wobble",
  empty: "origin-bottom scale-110 translate-y-1",
  error: "rotate-12",
};

interface Props {
  kind: MascotKind;
  title: string;
  children?: React.ReactNode;
  /** Xếp ngang, mascot nhỏ — dùng trong thông báo và dòng "đang tải". */
  inline?: boolean;
}

/**
 * Trạng thái loading/trống/lỗi dùng chung, nhân vật là mascot hiện có của site.
 * `role="alert"` cho lỗi (đọc ngay), `role="status"` cho phần còn lại.
 */
export function MascotState({ kind, title, children, inline = false }: Props) {
  const px = inline ? 56 : 112;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex items-center gap-4 ${inline ? "" : "flex-col text-center"}`}
    >
      <span
        style={{ width: px, height: px }}
        className="inline-block shrink-0 overflow-hidden rounded-full border-2 border-ink bg-sky shadow-pop-sm"
      >
        <Image
          src="/brand/kame-mascot.webp"
          alt=""
          width={px * 2}
          height={px * 2}
          className={`h-full w-full object-cover ${POSE_CLASS[kind]}`}
        />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg font-extrabold leading-tight text-ink">{title}</p>
        {children ? <div className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</div> : null}
      </div>
    </div>
  );
}
