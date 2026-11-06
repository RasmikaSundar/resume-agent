import {
  buildExtractResult,
  queryDescription,
  queryText,
} from "./extract.js";

function extractLinkedInJob() {
  const title = queryText([
    ".job-details-jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title",
    "h1.t-24",
    "h1",
  ]);

  const company = queryText([
    ".job-details-jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__primary-description a",
  ]);

  const description = queryDescription([
    "#job-details",
    ".jobs-description__content",
    ".jobs-box__html-content",
    ".jobs-description-content__text",
  ]);

  return buildExtractResult({
    title: title || "Unknown role",
    company: company || "Unknown company",
    url: window.location.href,
    description,
  });
}

const result = extractLinkedInJob();
chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: result });
