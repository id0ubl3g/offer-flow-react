import { Tag, X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { MAX_TAGS, MAX_TAG_LENGTH, normalizeTag } from "../utils/tags";

export function TagList({ tags, empty }: { tags: string[]; empty?: string }) {
  if (!tags.length) {
    return empty ? <span className="small muted">{empty}</span> : null;
  }

  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <span key={tag} className="tag">
          <Tag size={11} />
          {tag}
        </span>
      ))}
    </div>
  );
}

export function TagInput({ id, value, onChange, suggestions = [], placeholder = "Digite e aperte Enter", autoFocus }: { id?: string; value: string[]; onChange: (tags: string[]) => void; suggestions?: string[]; placeholder?: string; autoFocus?: boolean }) {
  const listId = useId();
  const [draft, setDraft] = useState("");
  const full = value.length >= MAX_TAGS;
  const available = suggestions.filter((tag) => !value.includes(tag));

  function add(raw: string) {
    const tag = normalizeTag(raw);

    if (tag && !value.includes(tag) && !full) {
      onChange([...value, tag]);
    }

    setDraft("");
  }

  function remove(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  }

  return (
    <div className="tag-input-wrap">
      <div className="tag-input" onClick={(event) => (event.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
        {value.map((tag) => (
          <span key={tag} className="tag tag-removable">
            {tag}
            <button type="button" aria-label={`Remover ${tag}`} onClick={() => remove(tag)}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          list={listId}
          value={draft}
          maxLength={MAX_TAG_LENGTH}
          disabled={full}
          autoFocus={autoFocus}
          placeholder={full ? `Máximo de ${MAX_TAGS} etiquetas` : value.length ? "" : placeholder}
          onChange={(event) => {
            const next = event.target.value;

            if (available.includes(next)) {
              add(next);
            } else {
              setDraft(next);
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
        />
      </div>
      <datalist id={listId}>
        {available.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      {available.length > 0 && !full && (
        <div className="chips">
          {available.slice(0, 12).map((tag) => (
            <button key={tag} type="button" className="chip chip-tag" onClick={() => add(tag)}>
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
