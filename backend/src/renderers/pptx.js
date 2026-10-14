import pptxgen from "pptxgenjs";

export async function renderPptx(c, outPath) {
  const p = new pptxgen();
  p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in

  const t = p.addSlide();
  t.background = { color: "0F172A" };
  t.addText(c.deckTitle || "Presentation", { x: 0.8, y: 2.6, w: 11.7, h: 1.6, fontSize: 40, bold: true, color: "FFFFFF" });

  for (const s of (c.slides || [])) {
    const sl = p.addSlide();
    sl.addText(s.title || "Slide", { x: 0.6, y: 0.4, w: 12, h: 0.9, fontSize: 30, bold: true, color: "0F172A" });
    sl.addText(
      (s.bullets || []).map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      { x: 0.6, y: 1.5, w: 7.6, h: 5, fontSize: 20, valign: "top" }
    );
    sl.addText(`Visual: ${s.visualHint || ""}`, {
      x: 8.6, y: 1.5, w: 4.2, h: 2.2, fontSize: 14, italic: true, color: "555555",
      fill: { color: "F1F5F9" }, valign: "middle", align: "center",
    });
    sl.addNotes(s.speakerNotes || "");
  }
  await p.writeFile({ fileName: outPath });
}
