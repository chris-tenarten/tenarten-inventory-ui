"use client";

import { type CSSProperties, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  reconstructJobUpdateMentionText,
  retainCanonicalMentions,
  tokenizeJobUpdateMentionText,
} from "../job-update-mention-tokenization";
import type { JobUpdateCollaborator } from "../types";

export type SelectedMention = Pick<JobUpdateCollaborator, "userId" | "displayName">;

const EDITOR_TEXT_METRICS: CSSProperties = {
  boxSizing: "border-box",
  fontFamily: "inherit",
  fontFeatureSettings: '"kern" 0, "liga" 0',
  fontKerning: "none",
  fontSize: "0.875rem",
  fontStyle: "normal",
  fontVariantLigatures: "none",
  fontWeight: 400,
  letterSpacing: "normal",
  lineHeight: "1.5rem",
  overflowWrap: "break-word",
  padding: "0.5rem 0.75rem",
  tabSize: 4,
  textAlign: "start",
  textIndent: 0,
  textTransform: "none",
  whiteSpace: "pre-wrap",
  wordSpacing: "normal",
};

function getCaretOffset(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.anchorNode || !editor.contains(selection.anchorNode)) return 0;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.setEnd(selection.anchorNode, selection.anchorOffset);
  return range.toString().length;
}

function setCaretOffset(editor: HTMLElement, requestedOffset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const targetOffset = Math.max(0, Math.min(requestedOffset, editor.textContent?.length ?? 0));
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let traversed = 0;
  let node = walker.nextNode();
  const range = document.createRange();

  while (node) {
    const length = node.textContent?.length ?? 0;
    if (traversed + length >= targetOffset) {
      range.setStart(node, targetOffset - traversed);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    traversed += length;
    node = walker.nextNode();
  }

  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function renderControlledValue(
  editor: HTMLElement,
  value: string,
  mentions: SelectedMention[],
) {
  const segments = tokenizeJobUpdateMentionText(value, mentions);
  if (reconstructJobUpdateMentionText(segments) !== value) {
    throw new Error("Job Update mention rendering must reproduce the controlled value exactly.");
  }
  const fragment = document.createDocumentFragment();
  for (const segment of segments) {
    if (segment.userId) {
      const mention = document.createElement("span");
      mention.dataset.canonicalMentionUserId = segment.userId;
      mention.className = "text-blue-700";
      mention.textContent = segment.text;
      fragment.append(mention);
    } else {
      fragment.append(document.createTextNode(segment.text));
    }
  }
  editor.replaceChildren(fragment);
}

function insertTextAtSelection(editor: HTMLElement, text: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getCaretMenuPosition(editor: HTMLElement) {
  const selection = window.getSelection();
  const editorRect = editor.getBoundingClientRect();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) {
    return { left: 0, top: editor.offsetHeight };
  }
  const caretRect = selection.getRangeAt(0).getBoundingClientRect();
  return {
    left: Math.min(Math.max(0, caretRect.left - editorRect.left), Math.max(0, editor.clientWidth - 256)),
    top: Math.max(0, caretRect.bottom - editorRect.top + editor.scrollTop),
  };
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
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
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

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const wasFocused = document.activeElement === editor;
    const caret = pendingCaretRef.current ?? (wasFocused ? getCaretOffset(editor) : null);
    renderControlledValue(editor, value, mentions);
    editor.dataset.empty = value ? "false" : "true";
    if (caret !== null) {
      editor.focus();
      setCaretOffset(editor, caret);
    }
    pendingCaretRef.current = null;
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
    if (editorRef.current) setMenuPosition(getCaretMenuPosition(editorRef.current));
  }

  function commitEditorValue(editor: HTMLDivElement) {
    const nextValue = editor.textContent ?? "";
    const caret = getCaretOffset(editor);
    pendingCaretRef.current = caret;
    onChange(nextValue, retainCanonicalMentions(nextValue, mentions));
    updateMentionQuery(nextValue, caret);
  }

  function selectMention(user: JobUpdateCollaborator) {
    if (mentionStart === null) return;
    const editor = editorRef.current;
    const caret = editor ? getCaretOffset(editor) : value.length;
    const token = `@${user.displayName}`;
    const nextValue = `${value.slice(0, mentionStart)}${token} ${value.slice(caret)}`;
    pendingCaretRef.current = mentionStart + token.length + 1;
    onChange(nextValue, [...mentions, { userId: user.userId, displayName: user.displayName }]);
    setMentionStart(null);
    setQuery("");
    setActiveIndex(0);
  }

  return (
    <div className="relative">
      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-disabled={disabled || undefined}
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck
        data-job-update-mention-editor
        data-placeholder={placeholder ?? ""}
        data-empty={value ? "false" : "true"}
        style={{ ...EDITOR_TEXT_METRICS, minHeight: `calc(${rows} * 1.5rem + 1rem + 2px)` }}
        onBlur={() => window.setTimeout(() => setMentionStart(null), 120)}
        onInput={(event) => commitEditorValue(event.currentTarget)}
        onClick={(event) => {
          const caret = getCaretOffset(event.currentTarget);
          updateMentionQuery(event.currentTarget.textContent ?? "", caret);
        }}
        onPaste={(event) => {
          event.preventDefault();
          insertTextAtSelection(event.currentTarget, event.clipboardData.getData("text/plain"));
          commitEditorValue(event.currentTarget);
        }}
        onKeyUp={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) return;
          const caret = getCaretOffset(event.currentTarget);
          updateMentionQuery(event.currentTarget.textContent ?? "", caret);
        }}
        onKeyDown={(event) => {
          if (mentionStart !== null && options.length > 0) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              setActiveIndex((current) => (current + direction + options.length) % options.length);
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              selectMention(options[activeIndex] ?? options[0]);
              return;
            }
          }
          if (event.key === "Escape" && mentionStart !== null) {
            event.preventDefault();
            setMentionStart(null);
            setQuery("");
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            insertTextAtSelection(event.currentTarget, "\n");
            commitEditorValue(event.currentTarget);
          }
        }}
        className="w-full resize-y overflow-auto border border-slate-300 bg-white text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
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
    </div>
  );
}
