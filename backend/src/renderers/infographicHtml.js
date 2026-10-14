export function infographicHtml(c) {
  const [a = "#6366f1", b = "#3b82f6", d = "#f8fafc"] = c.palette || [];
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(c.headline || "Infographic")}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background: ${d ?? "#fff"}; color: #0f172a; padding: 20px; }
    .w { max-width: 760px; margin: auto; padding: 40px; background: #ffffff; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    h1 { color: ${a}; font-size: 36px; margin: 0 0 6px; letter-spacing: -0.5px; }
    p.sub { font-size: 18px; color: #64748b; margin-top: 0; margin-bottom: 28px; }
    .s { background: #f8fafc; border-left: 8px solid ${b}; border-radius: 12px; padding: 18px 24px; margin: 16px 0; display: flex; gap: 20px; align-items: center; }
    .st { font-size: 32px; font-weight: 800; color: ${a}; min-width: 130px; }
    .content-block { flex: 1; }
    .content-heading { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .content-text { font-size: 14px; color: #475569; line-height: 1.5; }
    .key-message { margin-top: 32px; padding: 20px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; font-size: 16px; color: #1e1b4b; text-align: center; font-weight: 600; }
  </style>
</head>
<body>
  <div class="w">
    <h1>${esc(c.headline || "")}</h1>
    <p class="sub">${esc(c.subheadline || "")}</p>
    ${(c.sections || [])
      .map(
        (s) => `
      <div class="s">
        <div class="st">${esc(s.icon || "📊")} ${esc(s.stat || "")}</div>
        <div class="content-block">
          <div class="content-heading">${esc(s.heading || "")}</div>
          <div class="content-text">${esc(s.text || "")}</div>
        </div>
      </div>`
      )
      .join("")}
    <div class="key-message">📌 ${esc(c.keyMessage || "")}</div>
  </div>
</body>
</html>`;
}

const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
