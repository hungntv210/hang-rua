"use client";

import { Component, type ReactNode } from "react";

import { Notice } from "@/components/Notice";

interface Props {
  children: ReactNode;
  /** Đổi giá trị này (file mới) thì khung thử hiển thị lại. */
  resetKey: unknown;
}

/**
 * Bắt lỗi khi vẽ kết quả. Không có nó thì một trường thiếu (kết quả từ bộ đọc cũ,
 * dữ liệu lạ) làm trắng cả trang mà không một dòng giải thích.
 */
export class ResultBoundary extends Component<Props, { error: Error | null; key: unknown }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: { error: Error | null; key: unknown }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Notice tone="error" title="Không hiển thị được kết quả">
        Đã đọc xong file nhưng giao diện gặp lỗi khi vẽ: <code className="font-mono">{this.state.error.message}</code>
        . Nhấn Ctrl+Shift+R để tải lại sạch rồi thả file lại; nếu vẫn lỗi, hãy chép nguyên dòng trên gửi cho tôi.
      </Notice>
    );
  }
}
