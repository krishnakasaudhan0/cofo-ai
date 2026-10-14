export function chunkText(text, max = 24000) {
  const out = [];
  let cur = "";
  for (const para of text.split(/\n\n+/)) {
    if (cur.length + para.length > max && cur) {
      out.push(cur);
      cur = "";
    }
    cur += para + "\n\n";
  }
  if (cur.trim()) out.push(cur);
  return out;
}
