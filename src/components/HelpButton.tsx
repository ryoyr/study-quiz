import { useEffect, useId, useRef, useState } from "react";
import AppIcon from "./AppIcon";

type Props = {
  title: string;
  children: string;
  className?: string;
};

export default function HelpButton({ title, children, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutside);
    };
  }, [open]);

  return (
    <span ref={containerRef} className={`help-control ${className}`.trim()}>
      <button
        type="button"
        className="help-button"
        aria-label={`${title}の説明`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <AppIcon name="help" />
      </button>
      {open && (
        <span id={id} className="help-popover" role="dialog" aria-label={`${title}の説明`}>
          <span className="help-popover-heading">
            <strong>{title}</strong>
            <button type="button" aria-label="説明を閉じる" onClick={() => setOpen(false)}><AppIcon name="close" /></button>
          </span>
          <span>{children}</span>
        </span>
      )}
    </span>
  );
}

