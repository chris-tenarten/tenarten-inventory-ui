"use client";

import { useMemo, useRef, useState } from "react";
import type { JobUpdateCollaborator } from "../types";

export type SelectedMention = Pick<JobUpdateCollaborator, "userId" | "displayName">;

function getCaretMenuPosition(textarea: HTMLTextAreaElement, caret: number) {
  const mirror = document.createElement("div");
  const style = window.getComputedStyle(textarea);
  for (const property of [
    "fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  ]) mirror.style.setProperty(property, style.getPropertyValue(property));
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.textContent = textarea.value.slice(0, caret);
  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(caret, caret + 1) || "\u200b";
  mirror.append(marker);
  document.body.append(mirror);
  const position = {
    left: Math.min(marker.offsetLeft, Math.max(0, textarea.clientWidth - 256)),
    top: marker.offsetTop + Number.parseFloat(style.lineHeight || "24"),
  };
  mirror.remove();
  return position;
}

export default function JobUpdateMentionTextarea({
  id,
  value,
  mentions,
  collaborators,
  disabled,
  rows = 4,
  placeholder,
  onChange,
}: {
  id?: string;
  value: string;
  mentions: SelectedMention[];
  collaborators: JobUpdateCollaborator[];
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  onChange(value: string, mentions: SelectedMention[]): void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });

  const options = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return collaborators
      .filter((user) => !mentions.some((mention) => mention.userId === user.userId))
      .filter((user) => !normalized || user.displayName.toLocaleLowerCase().includes(normalized))
      .slice(0, 8);
  }, [collaborators, mentions, query]);

  const highlightedValue = useMemo(() => {
    if (mentions.length === 0) return value;
    const names = [...mentions].sort((a, b) => b.displayName.length - a.displayName.length);
    const tokens = names.map((mention) => `@${mention.displayName}`);
    const parts: Array<{ text: string; mention: boolean }> = [];
    let cursor = 0;
    while (cursor < value.length) {
      const match = tokens
        .map((token) => ({ token, index: value.indexOf(token, cursor) }))
        .filter((candidate) => candidate.index >= 0)
        .sort((a, b) => a.index - b.index || b.token.length - a.token.length)[0];
      if (!match) { parts.push({ text: value.slice(cursor), mention: false }); break; }
      if (match.index > cursor) parts.push({ text: value.slice(cursor, match.index), mention: false });
      parts.push({ text: match.token, mention: true });
      cursor = match.index + match.token.length;
    }
    return parts.map((part, index) => <span key={`${index}-${part.text}`} className={part.mention ? "font-medium text-blue-700" : "text-slate-900"}>{part.text}</span>);
  }, [mentions, value]);

  function updateMentionQuery(nextValue: string, caret: number) {
    const beforeCaret = nextValue.slice(0, caret);
    const match = beforeCaret.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match || collaborators.length === 0) {
      setMentionStart(null);
      setQuery("");
      return;
    }
    setMentionStart(caret - match[1].length - 1);
    setQuery(match[1]);
    setActiveIndex(0);
    if (textareaRef.current) setMenuPosition(getCaretMenuPosition(textareaRef.current, caret));
  }

  function handleChange(nextValue: string, caret: number) {
    const retained = mentions.filter((mention) => nextValue.includes(`@${mention.displayName}`));
    onChange(nextValue, retained);
    updateMentionQuery(nextValue, caret);
  }

  function selectMention(user: JobUpdateCollaborator) {
    if (mentionStart === null) return;
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? value.length;
    const token = `@${user.displayName}`;
    const nextValue = `${value.slice(0, mentionStart)}${token} ${value.slice(caret)}`;
    onChange(nextValue, [...mentions, { userId: user.userId, displayName: user.displayName }]);
    setMentionStart(null);
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => {
      const nextCaret = mentionStart + token.length + 1;
      textarea?.focus();
      textarea?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  return (
    <div className="relative">
      {mentions.length > 0 ? <div
        ref={highlightRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border border-transparent px-3 py-2 text-sm font-normal leading-6"
      >{highlightedValue}</div> : null}
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        onBlur={() => window.setTimeout(() => setMentionStart(null), 120)}
        onChange={(event) => handleChange(event.target.value, event.target.selectionStart)}
        onClick={(event) => updateMentionQuery(event.currentTarget.value, event.currentTarget.selectionStart)}
        onScroll={(event) => {
          if (highlightRef.current) {
            highlightRef.current.scrollTop = event.currentTarget.scrollTop;
            highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }
        }}
        onKeyUp={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) return;
          updateMentionQuery(event.currentTarget.value, event.currentTarget.selectionStart);
        }}
        onKeyDown={(event) => {
          if (mentionStart === null || options.length === 0) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((current) => (current + direction + options.length) % options.length);
          } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            selectMention(options[activeIndex] ?? options[0]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setMentionStart(null);
            setQuery("");
          }
        }}
        className={`relative w-full resize-y border border-slate-300 px-3 py-2 text-sm font-normal leading-6 outline-none placeholder:text-slate-500 focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 ${mentions.length > 0 ? "bg-transparent text-transparent caret-slate-900" : "bg-white text-slate-900"}`}
      />
      {mentionStart !== null && options.length > 0 ? (
        <div role="listbox" aria-label="Mention a TenOps user" style={menuPosition} className="absolute z-20 mt-1 max-h-48 w-64 overflow-y-auto border border-slate-300 bg-white p-1 shadow-lg">
          {options.map((user, index) => (
            <button
              key={user.userId}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectMention(user)}
              className={`block min-h-9 w-full px-2 py-1.5 text-left text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-none ${index === activeIndex ? "bg-blue-50 text-blue-900" : ""}`}
            >
              {user.displayName}
            </button>
          ))}
        </div>
      ) : null}
      {collaborators.length === 0 ? null : (
        <div className="mt-1 text-[11px] text-slate-500">Type @ to mention an active TenOps user.</div>
      )}
    </div>
  );
}
