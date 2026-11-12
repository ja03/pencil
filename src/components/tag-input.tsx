"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { useSearchTagsQuery } from "@/client/posts-api";
import { MAX_TAGS, normalizeTag } from "@/contracts/tags";

const label = "label-mono text-[10px] tracking-[0.1em] text-mut";

/** How long typing must pause before asking the server for suggestions. */
const DEBOUNCE_MS = 150;

type Option = { name: string; postCount: number | null };

/**
 * The editor's tag field: chips for the post's tags, and a combobox that
 * suggests existing tags as the author types. Enter or a comma adds the
 * highlighted suggestion (or the typed tag), Backspace in an empty field
 * removes the last tag. Tags are normalized the same way the server does it.
 */
export function TagInput({
  tags,
  onChange,
  errors,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  errors?: string[];
}) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const full = tags.length >= MAX_TAGS;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const open = focused && !dismissed && !full;
  const { data } = useSearchTagsQuery(query.trim(), { skip: !open });

  const typed = text.trim() === "" ? null : normalizeTag(text);
  const suggestions: Option[] = (data?.tags ?? []).filter((t) => !tags.includes(t.name));
  const options: Option[] =
    typed && !tags.includes(typed) && !suggestions.some((s) => s.name === typed)
      ? [...suggestions, { name: typed, postCount: null }]
      : suggestions;
  const showList = open && options.length > 0;
  const activeIndex = Math.min(active, options.length - 1);

  /**
   * Adds the tags in `raw` and leaves `rest` in the field. Adds nothing, and
   * says why, when one isn't a valid tag or they'd go past the limit.
   */
  function commit(raw: string[], rest = ""): boolean {
    const next = [...tags];
    for (const item of raw) {
      if (item.trim() === "") continue;
      const name = normalizeTag(item);
      if (!name) {
        setHint(`“${item.trim()}” isn't a valid tag. Use letters, numbers and hyphens.`);
        return false;
      }
      if (!next.includes(name)) next.push(name);
    }
    setActive(0);
    if (next.length > MAX_TAGS) {
      setHint(`A post can have up to ${MAX_TAGS} tags.`);
      return false;
    }
    setHint(null);
    setText(rest);
    if (next.length !== tags.length) onChange(next);
    return true;
  }

  const add = (name: string) => commit([name]);
  const addTyped = () => commit([text]);

  /** Typing, or pasting "a, b, c": everything before the last comma becomes tags. */
  function onType(value: string) {
    setDismissed(false);
    if (value.includes(",")) {
      const parts = value.split(",");
      const rest = parts.pop()!;
      if (commit(parts, rest)) return;
    } else {
      setHint(null);
      setActive(0);
    }
    setText(value);
  }

  function remove(name: string) {
    onChange(tags.filter((t) => t !== name));
    setHint(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (options.length === 0) return;
        event.preventDefault();
        setDismissed(false);
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((activeIndex + step + options.length) % options.length);
        return;
      }
      case "Enter":
      case ",": {
        // Enter must never submit or save anything else from here.
        event.preventDefault();
        if (showList && event.key === "Enter") add(options[activeIndex].name);
        else addTyped();
        return;
      }
      case "Escape":
        if (showList) {
          event.preventDefault();
          setDismissed(true);
        }
        return;
      case "Backspace":
        if (text === "" && tags.length > 0) remove(tags[tags.length - 1]);
        return;
    }
  }

  const message = errors?.[0] ?? hint;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className={label}>
        Tags <span className="tracking-normal normal-case">· up to {MAX_TAGS}</span>
      </label>
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-xl border bg-surf p-2 focus-within:ring-2 focus-within:ring-acc/40 ${message ? "border-err-ink" : "border-line focus-within:border-acc"}`}
      >
        <ul aria-label="Tags on this post" className="contents">
          {tags.map((tag) => (
            <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-soft py-1.5 pr-1.5 pl-2.5 text-[13px]">
              #{tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => remove(tag)}
                className="flex size-6 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-mut hover:bg-line hover:text-ink"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <input
          id={inputId}
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            addTyped();
          }}
          placeholder={full ? `That's ${MAX_TAGS} tags` : tags.length === 0 ? "Add a tag, like writing" : "Add another"}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList ? `${listId}-${activeIndex}` : undefined}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? errorId : undefined}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-8 min-w-[120px] flex-1 border-none bg-transparent text-sm text-ink outline-none placeholder:text-mut"
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label="Existing tags"
        hidden={!showList}
        className="motion-popup absolute top-full left-0 z-20 mt-1 flex w-[min(280px,100%)] flex-col rounded-[14px] border border-line bg-surf p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
      >
        {options.map((option, i) => (
          <div
            key={option.name}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === activeIndex}
            // Keep focus in the input so the list stays open.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => add(option.name)}
            onMouseEnter={() => setActive(i)}
            className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 text-sm ${i === activeIndex ? "bg-soft" : ""}`}
          >
            {option.postCount === null ? (
              <span className="text-mut">
                Create “<span className="text-ink">{option.name}</span>”
              </span>
            ) : (
              <>
                <span className="truncate">#{option.name}</span>
                <span className="flex-none text-xs text-mut">
                  {option.postCount} {option.postCount === 1 ? "post" : "posts"}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-3 text-xs">
        <span id={errorId} role={message ? "alert" : undefined} className="text-err-ink">
          {message}
        </span>
        <span className="flex-none text-mut" aria-hidden="true">
          {tags.length} / {MAX_TAGS}
        </span>
      </div>
    </div>
  );
}
