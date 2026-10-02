import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

export type ButtonVariant = "royal" | "salmon" | "ghost";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  royal: "bg-royal text-ice",
  salmon: "bg-salmon text-ink",
  ghost: "bg-white text-ink",
};

/**
 * Lớp của nút pop-art: viền đen, bóng cứng; nhấn thì dịch xuống-phải đúng bằng
 * độ lệch bóng nên bóng "biến mất" như nút thật bị ấn xuống.
 * Xuất riêng để gắn lên `next/link` mà không phải bọc thêm phần tử.
 */
export function buttonClass(variant: ButtonVariant = "royal"): string {
  return `focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border-2 border-ink px-5 py-2 font-display text-sm font-extrabold shadow-pop transition-transform duration-150 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-pop-press disabled:translate-x-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${VARIANT_CLASS[variant]}`;
}

type ButtonProps =
  | ({ as?: "button"; variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ as: "a"; variant?: ButtonVariant } & AnchorHTMLAttributes<HTMLAnchorElement>);

export function Button(props: ButtonProps) {
  if (props.as === "a") {
    const { as: _as, variant, className = "", ...rest } = props;
    return <a {...rest} className={`${buttonClass(variant)} ${className}`} />;
  }
  const { as: _as, variant, className = "", type = "button", ...rest } = props;
  return <button {...rest} type={type} className={`${buttonClass(variant)} ${className}`} />;
}
