import { useRef, type ReactNode } from "react";
import { PLACEHOLDERS } from "../utils/format";

export function MessageTemplateField({ id, label, value, onChange, action, rows = 7 }: { id: string; label: string; value: string; onChange: (value: string) => void; action?: ReactNode; rows?: number }) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  function insertPlaceholder(key: string) {
    const element = textarea.current;
    const token = `{${key}}`;

    if (!element) {
      onChange(value + token);
      return;
    }

    const start = element.selectionStart;
    const end = element.selectionEnd;

    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="field">
      <div className="row between">
        <label className="label" htmlFor={id}>{label}</label>
        {action}
      </div>
      <textarea id={id} ref={textarea} className="textarea" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} maxLength={4000} />
      <div className="chips">
        {PLACEHOLDERS.map((key) => (
          <button key={key} type="button" className="chip" onClick={() => insertPlaceholder(key)}>
            {`{${key}}`}
          </button>
        ))}
      </div>
      <span className="hint">Use *negrito*, _itálico_ e ~riscado~ como no WhatsApp.</span>
    </div>
  );
}
