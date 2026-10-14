export const pick = (ir, keys) => Object.fromEntries(keys.map((k) => [k, ir[k]]));

export const paramsBlock = (p = {}) => `<params>
audience: ${p.audience || "general public"}
tone: ${p.tone || "professional"}
language: ${p.language || "English"}
detail_level: ${p.detailLevel || "standard"}
objective: ${p.objective || "inform"}
style: ${p.style || "clear and concise"}
</params>`;

export const BASE_SYSTEM = `You write communication deliverables from a canonical IR.
Rules:
- Use ONLY information in <ir>. Do not add facts, numbers, names or dates that are not in it.
- If constraints.sensitiveClaims lists a claim, attribute it ("reportedly", "according to the source") or omit it.
- Write in the requested language, tone and for the requested audience. Honour the communication objective.
- Respect <operator_context> if present.`;
