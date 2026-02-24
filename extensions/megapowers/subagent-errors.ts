export interface MessageLine {
  type: "error" | "info" | "text";
  text: string;
}

export function detectRepeatedErrors(
  lines: MessageLine[],
  threshold: number = 3,
): string[] {
  const errorCounts = new Map<string, number>();

  for (const line of lines) {
    if (line.type !== "error") continue;
    const normalized = line.text.trim();
    if (!normalized) continue;
    errorCounts.set(normalized, (errorCounts.get(normalized) ?? 0) + 1);
  }

  const repeated: string[] = [];
  for (const [msg, count] of errorCounts) {
    if (count >= threshold) repeated.push(msg);
  }

  return repeated;
}
