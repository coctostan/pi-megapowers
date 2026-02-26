// extensions/megapowers/ui-checklist.ts
//
// Reusable checklist widget using ctx.ui.custom().
// Adapted from the pi questionnaire extension pattern.

import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";

export interface ChecklistItem {
  key: string;
  label: string;
  checked: boolean;
}

/**
 * Show an interactive checklist using ctx.ui.custom().
 *
 * Returns the keys of all checked items when submitted.
 * Returns null if the user dismisses with Escape.
 *
 * Navigation:  ↑↓ to move cursor
 * Toggle:      Space or Enter (on a non-Submit row) to toggle
 * Submit:      Enter on the Submit row
 * Cancel:      Escape
 */
export async function showChecklistUI(
  ctx: { hasUI: boolean; ui: { custom: <T>(fn: any) => Promise<T> } },
  items: ChecklistItem[],
  title: string,
): Promise<string[] | null> {
  if (!ctx.hasUI) return null;

  return ctx.ui.custom<string[] | null>((tui: any, theme: any, _kb: any, done: (v: string[] | null) => void) => {
    const checked = new Set(items.filter((i) => i.checked).map((i) => i.key));
    let cursor = 0;
    let cachedLines: string[] | undefined;

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function handleInput(data: string) {
      if (matchesKey(data, Key.up)) {
        cursor = Math.max(0, cursor - 1);
        refresh();
        return;
      }
      if (matchesKey(data, Key.down)) {
        cursor = Math.min(items.length, cursor + 1); // items.length = Submit row index
        refresh();
        return;
      }
      if (matchesKey(data, Key.escape)) {
        done(null);
        return;
      }
      if (matchesKey(data, Key.enter)) {
        if (cursor === items.length) {
          // Submit row selected
          done(Array.from(checked));
        } else {
          // Toggle current item
          const item = items[cursor];
          if (checked.has(item.key)) {
            checked.delete(item.key);
          } else {
            checked.add(item.key);
          }
          refresh();
        }
        return;
      }
      if (matchesKey(data, Key.space)) {
        if (cursor < items.length) {
          const item = items[cursor];
          if (checked.has(item.key)) {
            checked.delete(item.key);
          } else {
            checked.add(item.key);
          }
          refresh();
        }
        return;
      }
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;
      const lines: string[] = [];
      const add = (s: string) => lines.push(truncateToWidth(s, width));

      add(theme.fg("accent", "─".repeat(width)));
      add(theme.fg("text", ` ${title}`));
      lines.push("");

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const isSelected = i === cursor;
        const isChecked = checked.has(item.key);
        const prefix = isSelected ? theme.fg("accent", "> ") : "  ";
        const box = isChecked ? theme.fg("success", "☑") : theme.fg("muted", "☐");
        const color = isSelected ? "accent" : "text";
        add(`${prefix}${box} ${theme.fg(color, item.label)}`);
      }

      lines.push("");
      const isSubmitSelected = cursor === items.length;
      const submitPrefix = isSubmitSelected ? theme.fg("accent", "> ") : "  ";
      add(`${submitPrefix}${theme.fg(isSubmitSelected ? "success" : "muted", "Submit")}`);

      lines.push("");
      add(theme.fg("dim", " ↑↓ navigate • Space toggle • Enter confirm • Esc cancel"));
      add(theme.fg("accent", "─".repeat(width)));

      cachedLines = lines;
      return lines;
    }

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };
  });
}
