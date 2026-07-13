import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  lines: string[];
  open: boolean;
  onClose: () => void;
};

export function TerminalModal({ title, lines, open, onClose }: Props) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="terminal-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="terminal-light" />
            <strong>{title}</strong>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <pre ref={ref}>{lines.join("\n") || "Waiting for output..."}</pre>
      </section>
    </div>
  );
}
