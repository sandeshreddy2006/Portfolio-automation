"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import styles from "../studio.module.css";

const marker = "• ";
const prefix = /^(\s*)•[ \t]*/;

export default function BulletField({ label, value, onChange, rows, maxLength = 4000, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; rows: number; maxLength?: number; placeholder?: string;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<[number, number]>(null);

  useLayoutEffect(() => {
    if (!pendingSelection.current) return;
    input.current?.focus();
    input.current?.setSelectionRange(...pendingSelection.current);
    pendingSelection.current = null;
  }, [value]);

  function update(next: string, start: number, end = start) {
    if (next.length > maxLength || next === value) return;
    pendingSelection.current = [start, end];
    onChange(next);
  }

  function toggleBullet() {
    const field = input.current;
    if (!field) return;
    const { selectionStart, selectionEnd } = field;
    const start = selectionStart === 0 ? 0 : value.lastIndexOf("\n", selectionStart - 1) + 1;
    const searchFrom = selectionEnd > selectionStart && value[selectionEnd - 1] === "\n" ? selectionEnd - 1 : selectionEnd;
    const lineEnd = value.indexOf("\n", searchFrom);
    const end = lineEnd === -1 ? value.length : lineEnd;
    const lines = value.slice(start, end).split("\n");
    const remove = lines.every((line) => prefix.test(line));
    const formatted = lines.map((line) => remove ? line.replace(prefix, "$1") : prefix.test(line) ? line : marker + line).join("\n");
    const next = value.slice(0, start) + formatted + value.slice(end);
    if (selectionStart === selectionEnd) {
      update(next, Math.max(start, selectionStart + formatted.length - lines[0].length));
    } else {
      update(next, start, start + formatted.length);
    }
  }

  function continueBullet(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey) return;
    const { selectionStart, selectionEnd } = event.currentTarget;
    if (selectionStart !== selectionEnd) return;
    const start = selectionStart === 0 ? 0 : value.lastIndexOf("\n", selectionStart - 1) + 1;
    if (!prefix.test(value.slice(start, selectionStart))) return;
    const endOfLine = selectionStart === value.length || value[selectionStart] === "\n";
    if (endOfLine && !value.slice(start, selectionStart).replace(prefix, "").trim()) {
      event.preventDefault();
      update(value.slice(0, start) + value.slice(selectionEnd), start);
      return;
    }
    if (value.length + marker.length + 1 > maxLength) return;
    event.preventDefault();
    update(value.slice(0, selectionStart) + "\n" + marker + value.slice(selectionEnd), selectionStart + marker.length + 1);
  }

  return (
    <div className={styles.bulletField}>
      <label>{label}
        <textarea ref={input} rows={rows} maxLength={maxLength} placeholder={placeholder} value={value}
          onChange={(event) => onChange(event.target.value)} onKeyDown={continueBullet} />
      </label>
      <button type="button" aria-label={`Toggle bullets in ${label.toLowerCase()}`} onMouseDown={(event) => event.preventDefault()} onClick={toggleBullet}>
        <span aria-hidden="true">•</span> Bullet
      </button>
    </div>
  );
}
