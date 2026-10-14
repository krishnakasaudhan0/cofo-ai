export function advisoryToHtml(content) {
  const severityColors = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#3b82f6"
  };
  const color = severityColors[content.severity?.toLowerCase()] || "#6366f1";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(content.title || "Security & Operational Advisory")}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: auto; }
    .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .badge { display: inline-block; padding: 4px 14px; background: ${color}; color: #fff; font-weight: 700; border-radius: 9999px; text-transform: uppercase; font-size: 12px; letter-spacing: 0.8px; }
    .id-tag { color: #64748b; font-family: monospace; font-size: 14px; font-weight: 600; }
    h1 { margin-top: 8px; font-size: 28px; color: #0f172a; letter-spacing: -0.5px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
    h2 { font-size: 18px; color: #1e293b; margin-top: 24px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px; }
    p, li { line-height: 1.6; font-size: 15px; color: #334155; }
    .rec-item { margin-bottom: 12px; padding: 12px 16px; background: #f8fafc; border-left: 4px solid #6366f1; border-radius: 6px; }
    .rec-priority { font-weight: 700; text-transform: uppercase; font-size: 11px; color: #4338ca; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="header-bar">
    <span class="badge">${esc(content.severity || "INFO")}</span>
    <span class="id-tag">${esc(content.advisoryId || "ADV-2026-001")}</span>
  </div>
  <h1>${esc(content.title || "")}</h1>
  <div class="meta">CoFo Strategic Advisory & Risk Intelligence Engine</div>
  
  <h2>Executive Summary</h2>
  <p>${esc(content.summary || "")}</p>

  <h2>Background & Context</h2>
  <p>${esc(content.background || "")}</p>

  <h2>Affected Scope & Systems</h2>
  <ul>
    ${(content.affected || []).map((a) => `<li>${esc(a)}</li>`).join("")}
  </ul>

  <h2>Impact Assessment</h2>
  <p>${esc(content.impact || "")}</p>

  <h2>Recommended Tactical Actions</h2>
  ${(content.recommendedActions || [])
    .map(
      (r) => `
    <div class="rec-item">
      <div class="rec-priority">${esc(r.priority || "ACTION")}</div>
      <div>${esc(r.step || "")}</div>
    </div>
  `
    )
    .join("")}
</body>
</html>`;
}

const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
