/** Parse "Do not add" bullets from fit-report markdown. */
export function parseDoNotAddTerms(fitReportMarkdown: string): string[] {
  const lines = fitReportMarkdown.split("\n");
  let inSection = false;
  const terms: string[] = [];

  for (const line of lines) {
    const heading = line.trim().toLowerCase();
    if (/^#+\s/.test(line) && heading.includes("do not add")) {
      inSection = true;
      continue;
    }
    if (inSection && /^#+\s/.test(line)) {
      break;
    }
    if (!inSection) continue;
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet?.[1]) {
      const term = bullet[1].trim();
      if (term.length > 2) terms.push(term);
    }
  }

  return terms;
}

export function findHonestyWarnings(
  tailoredResume: string,
  doNotAddTerms: string[],
): string[] {
  const lower = tailoredResume.toLowerCase();
  const warnings: string[] = [];

  for (const term of doNotAddTerms) {
    const needle = term.toLowerCase().trim();
    if (needle.length < 3) continue;
    const tokens = needle.split(/\s+/).filter((w) => w.length >= 5);
    const matched =
      lower.includes(needle) ||
      tokens.some((word) => lower.includes(word));
    if (matched) {
      warnings.push(
        `Tailored resume may include a "do not add" term: ${term}`,
      );
    }
  }

  return warnings;
}
