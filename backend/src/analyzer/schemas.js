import { z } from "zod";

export const SourceBundle = z.object({
  ir_version: z.string().optional(),
  session_id: z.string().optional().default(() => `sess_${Date.now()}`),
  sources: z.array(z.object({
    source_type: z.enum(["raw_text", "web_page", "document", "pdf", "docx", "image", "video_transcript"]),
    origin: z.string(),
    title: z.string().optional(),
    content: z.string().min(1),
  })).min(1).max(10),
});

export const Fact = z.object({
  id: z.string().describe("f1, f2, ..."),
  claim: z.string().describe("One atomic, self-contained statement"),
  type: z.preprocess((val) => {
    if (typeof val === 'string') {
      const v = val.toLowerCase();
      const match = ["stat", "event", "quote", "definition", "claim"].find(t => v.includes(t));
      if (match) return match;
      return "claim";
    }
    return "claim";
  }, z.enum(["stat", "event", "quote", "definition", "claim"])),
  sourceId: z.string().describe("The S# of the source it came from"),
  sourceSpan: z.string().describe("VERBATIM snippet (<=200 chars) copied from the source that supports the claim"),
});

export const IR = z.object({
  meta: z.object({
    title: z.string().default("Untitled Document"),
    domain: z.string().default("general"),
    documentType: z.preprocess((val) => {
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        const match = ["news", "report", "advisory", "policy", "research", "announcement", "incident", "prompt", "other"].find(t => v.includes(t));
        if (match) return match;
        return "other";
      }
      return "other";
    }, z.enum(["news", "report", "advisory", "policy", "research", "announcement", "incident", "prompt", "other"])),
    language: z.string().default("English"),
    publishedDate: z.string().nullable().optional(),
  }),
  operatorContext: z.string().describe("What the operator note says, restated. Empty string if none.").default(""),
  summary: z.object({
    oneLine: z.string().default(""),
    short: z.string().describe("2-3 sentences").default(""),
    detailed: z.string().describe("1-2 paragraphs").default(""),
  }),
  intent: z.object({
    primaryPurpose: z.preprocess((val) => {
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        if (v.includes('warn')) return 'warn';
        if (v.includes('persuade')) return 'persuade';
        if (v.includes('instruct')) return 'instruct';
        if (v.includes('report')) return 'report';
        if (v.includes('announce')) return 'announce';
        return 'inform';
      }
      return 'inform';
    }, z.enum(["inform", "warn", "persuade", "instruct", "report", "announce"])),
    implicitAudience: z.preprocess((val) => {
      if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
      if (Array.isArray(val)) return val;
      return [];
    }, z.array(z.string())),
    urgency: z.preprocess((val) => {
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        if (v.includes('crit')) return 'critical';
        if (v.includes('high')) return 'high';
        if (v.includes('low')) return 'low';
        return 'medium';
      }
      return 'medium';
    }, z.enum(["low", "medium", "high", "critical"])),
    tone: z.string().describe("tone of the original source").default("neutral"),
  }),
  keyPoints: z.array(z.object({
    id: z.string().default("k1"),
    text: z.string().default(""),
    importance: z.preprocess((val) => {
      if (typeof val === 'number') return Math.max(1, Math.min(5, Math.round(val)));
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        if (v.includes('high') || v.includes('critical')) return 5;
        if (v.includes('med')) return 3;
        if (v.includes('low')) return 1;
        const num = parseInt(v, 10);
        if (!isNaN(num)) return Math.max(1, Math.min(5, num));
      }
      return 3;
    }, z.number().int().min(1).max(5)),
    factIds: z.preprocess((val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [val];
      return [];
    }, z.array(z.string())),
  })).min(1).max(12),
  facts: z.array(Fact).max(60).default([]),
  entities: z.array(z.object({
    name: z.string(),
    type: z.preprocess((val) => {
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        const match = ["org", "person", "product", "location", "date", "cve", "law", "other"].find(t => v.includes(t));
        if (match) return match;
        return "other";
      }
      return "other";
    }, z.enum(["org", "person", "product", "location", "date", "cve", "law", "other"])),
    role: z.string().describe("why it matters here").default("context"),
  })).default([]),
  timeline: z.array(z.object({ 
    date: z.string().default(""), 
    event: z.string().default(""), 
    factId: z.string().optional() 
  })).default([]),
  numbers: z.array(z.object({ 
    label: z.string().default(""), 
    value: z.string().default(""), 
    unit: z.string().default(""), 
    context: z.string().default(""), 
    factId: z.string().optional() 
  })).default([]),
  risks: z.array(z.object({ 
    description: z.string().default(""), 
    severity: z.preprocess((val) => {
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        if (v.includes('crit')) return 'critical';
        if (v.includes('high')) return 'high';
        if (v.includes('low')) return 'low';
        return 'medium';
      }
      return 'medium';
    }, z.enum(["low", "medium", "high", "critical"])), 
    affected: z.preprocess((val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [val];
      return [];
    }, z.array(z.string())) 
  })).default([]),
  recommendations: z.array(z.object({ 
    action: z.string().default(""), 
    priority: z.preprocess((val) => {
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        if (v.includes('high') || v.includes('crit')) return 'high';
        if (v.includes('low')) return 'low';
        return 'medium';
      }
      return 'medium';
    }, z.enum(["low", "medium", "high"])), 
    audience: z.string().default("operators") 
  })).default([]),
  visualCandidates: z.array(z.object({
    kind: z.preprocess((val) => {
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        const match = ["bar_chart", "line_chart", "map", "process_flow", "comparison", "timeline", "hierarchy", "icon_stat"].find(t => v.includes(t));
        if (match) return match;
        return "icon_stat";
      }
      return "icon_stat";
    }, z.enum(["bar_chart", "line_chart", "map", "process_flow", "comparison", "timeline", "hierarchy", "icon_stat"])),
    description: z.string().default(""),
    dataFactIds: z.preprocess((val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [val];
      return [];
    }, z.array(z.string())),
  })).max(8).default([]),
  constraints: z.object({
    sensitiveClaims: z.preprocess((val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [val];
      return [];
    }, z.array(z.string())).default([]),
    missingInfo: z.preprocess((val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [val];
      return [];
    }, z.array(z.string())).default([]),
  }).default({ sensitiveClaims: [], missingInfo: [] }),
});
