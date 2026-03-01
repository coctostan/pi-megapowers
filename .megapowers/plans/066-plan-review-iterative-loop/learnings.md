# Learnings — 066-plan-review-iterative-loop

- **gray-matter does throw on malformed YAML** — the try/catch pattern in `parseFrontmatterEntity` is necessary and tested. Without it, a corrupt frontmatter file would crash the caller rather than return a structured error. Don't assume parsing libraries behave gracefully on bad input.

- **Discriminated union return types beat exceptions for I/O functions** — `ParseResult<T>` with `{ success: true, data, content } | { success: false, errors }` forces callers to handle both cases at the type level. `listPlanTasks` returning `EntityDoc<T>[] | { error: string }` is the same pattern applied to the store layer. TypeScript narrows both correctly.

- **Zero-pad width should be chosen for the expected cardinality upfront** — `padStart(2, "0")` handles IDs 1–99 but silently drops padding for 100+. Since file sort order affects read order (though not final sort), this matters. Fixing it after files exist on disk requires migration. Two digits was spec-compliant but three digits would have been safer future-proofing.

- **Silently skipping unparseable files is a subtle footgun** — `listPlanTasks` uses `if (!result.success) continue` for files with parse errors. This is consistent with the read functions (which return null on corruption) but means a corrupted task vanishes silently from the list. Consider returning `{ error }` for parse failures too, to match the duplicate-ID error path.

- **The `EntityDoc<T>` wrapper keeps data and markdown body together** — separating the parsed schema data from the markdown content string in a single struct makes roundtripping clean. The store functions accept and return `EntityDoc<T>` uniformly, which prevents callers from accidentally discarding the body text.

- **Strictly additive infrastructure ships faster and with less risk** — zero existing files were touched. All 22 acceptance criteria were satisfied with three new source files and three new test files. A purely additive PR has no merge conflicts and no regression surface outside the new code.

- **`matter.stringify` prepends a newline to the content section** — roundtrip tests must use `trimStart()` or explicitly account for the leading newline gray-matter adds between the closing `---` delimiter and the body. This is a gray-matter quirk worth documenting at the call site.
