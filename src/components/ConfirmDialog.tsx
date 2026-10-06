import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "キャンセル",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCancelRef.current = onCancel;
    busyRef.current = busy;
  }, [busy, onCancel]);

  useLayoutEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const stopPropagation = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && event.target === dialogRef.current) {
      event.preventDefault();
    }
  };

  return createPortal(
    <div
      className="confirm-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className={`confirm-dialog${danger ? " is-danger" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        onKeyDown={stopPropagation}
      >
        <p className="eyebrow">CONFIRM ACTION</p>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId} className="confirm-dialog-description">
          {description}
        </p>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelButtonRef}
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={danger ? "confirm-danger-button" : "primary-button"}
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "処理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

