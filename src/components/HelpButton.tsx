import { useId, useState } from "react";

type Props = {
  title: string;
  children: string;
  className?: string;
};

export default function HelpButton({ title, children, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={`help-control ${className}`.trim()}>
      <button
        type="button"
        className="help-button"
        aria-label={`${title}の説明`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open && (
        <span id={id} className="help-popover" role="status">
          <strong>{title}</strong>
          <span>{children}</span>
          <button type="button" onClick={() => setOpen(false)}>閉じる</button>
        </span>
      )}
    </span>
  );
}
