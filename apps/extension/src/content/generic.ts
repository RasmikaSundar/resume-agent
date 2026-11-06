import {
  buildExtractResult,
  companyFromUrl,
  queryDescription,
  queryText,
} from "./extract.js";

function extractGenericJob() {
  const title = queryText([
    "h1[data-automation-id='jobPostingHeader']",
    "h1.job-title",
    "h1",
  ]);

  const company = queryText([
    "[data-company]",
    ".company-name",
    "meta[property='og:site_name']",
  ]);

  const description = queryDescription([
    "[data-automation-id='jobPostingDescription']",
    ".job-description",
    "article",
    "main",
  ]);

  const url = window.location.href;

  return buildExtractResult({
    title: title || document.title.split("|")[0]?.trim() || "Role",
    company: company || companyFromUrl(url) || "Company",
    url,
    description,
  });
}

const result = extractGenericJob();
chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: result });
