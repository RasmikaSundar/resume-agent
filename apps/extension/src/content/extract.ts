import type { JobExtractResult } from "@resume-agent/shared";

const MIN_DESCRIPTION_CHARS = 200;

export function normalizeDescription(text: string, maxLen = 12000): string {
  return text.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export function buildExtractResult(
  partial: Omit<JobExtractResult, "confidence">,
): JobExtractResult {
  const description = normalizeDescription(partial.description);
  const high =
    description.length >= MIN_DESCRIPTION_CHARS &&
    Boolean(partial.title?.trim()) &&
    Boolean(partial.company?.trim());

  return {
    ...partial,
    description,
    confidence: high ? "high" : "low",
  };
}

export function queryText(selectors: string[]): string {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }
  return "";
}

export function queryDescription(selectors: string[]): string {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      return normalizeDescription(el.textContent);
    }
  }
  return normalizeDescription(document.body?.innerText ?? "");
}

const HOST_BRAND_OVERRIDES: Record<string, string> = {
  "cursor.com": "Cursor",
};

const GENERIC_SUBDOMAINS = new Set(["www", "jobs", "careers", "apply"]);

function titleCaseBrand(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function brandFromHostname(hostname: string): string {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  if (HOST_BRAND_OVERRIDES[host]) return HOST_BRAND_OVERRIDES[host];

  const parts = host.split(".");
  if (parts.length >= 3 && GENERIC_SUBDOMAINS.has(parts[0])) {
    return titleCaseBrand(parts[1]);
  }
  if (parts.length >= 2) {
    const label = parts[parts.length - 2];
    if (label && !GENERIC_SUBDOMAINS.has(label)) {
      return titleCaseBrand(label);
    }
  }
  return titleCaseBrand(parts[0] ?? "");
}

/** Infer employer name from the posting URL when the page has no company field. */
export function companyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "jobs.lever.co") {
      const slug = parsed.pathname.split("/").filter(Boolean)[0];
      return slug ? titleCaseBrand(slug) : "";
    }

    if (host.endsWith("greenhouse.io")) {
      const slug = parsed.pathname.split("/").filter(Boolean)[0];
      return slug ? titleCaseBrand(slug) : "";
    }

    return brandFromHostname(host);
  } catch {
    return "";
  }
}
