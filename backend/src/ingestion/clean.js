export function cleanMarkdown(t = "") {
  return t
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "") // linked images [![alt](img)](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")              // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")           // [text](url) → text
    .replace(/\[\d+\]|\[citation needed\]/gi, "")      // wiki footnote markers
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
