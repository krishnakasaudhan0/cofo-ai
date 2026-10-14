import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Check,
  Layers,
  RefreshCw,
  Trash2,
  Code,
  Share2,
  MessageSquare,
  Video,
  Presentation,
  ShieldAlert,
  ChartPie,
  Briefcase,
  Sparkles,
  SlidersHorizontal,
  Target,
  Users,
  BookOpen,
  Languages,
  Download,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  RotateCcw,
  AlertTriangle,
  Lightbulb,
  Send
} from 'lucide-react';
import { useJob } from './hooks/useJob.js';
import './index.css';

const API_BASE = 'http://localhost:3000';

const OUTPUT_OPTIONS = [
  {
    id: 'linkedin',
    title: 'LinkedIn Post',
    description: 'Hook, structured insights, key bullet points, and optimized hashtags.',
    icon: Share2,
    badge: 'Social'
  },
  {
    id: 'twitter',
    title: 'Twitter / X Thread',
    description: 'Thread sequence strictly bounded to 280 chars per tweet with numbering.',
    icon: MessageSquare,
    badge: 'Social'
  },
  {
    id: 'presentation',
    title: 'Presentation (PPTX)',
    description: 'Slide deck titles, bullet points, visual directives, and speaker notes.',
    icon: Presentation,
    badge: 'Deck'
  },
  {
    id: 'video',
    title: 'Video Package',
    description: 'Full narration script, storyboard shot composition, and SRT subtitle file.',
    icon: Video,
    badge: 'Video'
  },
  {
    id: 'advisory',
    title: 'Advisory Note',
    description: 'Technical threat/operational advisory with severity ratings and tactical steps.',
    icon: ShieldAlert,
    badge: 'Advisory'
  },
  {
    id: 'infographic',
    title: 'Infographic Spec',
    description: 'Modular sections, stat hero callouts, layout schema, and HTML preview.',
    icon: ChartPie,
    badge: 'Visual'
  },
  {
    id: 'executive_summary',
    title: 'Executive Summary',
    description: 'Bottom-line synthesis, core findings, key risks, decisions, and next steps.',
    icon: Briefcase,
    badge: 'Executive'
  }
];

const TONE_OPTIONS = [
  'Professional & Formal',
  'Analytical & Objective',
  'Engaging & Conversational',
  'Urgent & Action-Oriented',
  'Inspirational & Visionary',
  'Technical & Academic'
];

const AUDIENCE_OPTIONS = [
  'Executives & C-Suite',
  'Technical & Engineering Teams',
  'Industry Peers & Practitioners',
  'General Public & Consumers',
  'Investors & Board Members',
  'Domain Specialists & Analysts'
];

const DETAIL_LEVELS = [
  { id: 'brief', label: 'Brief (Concise)' },
  { id: 'standard', label: 'Standard & Balanced' },
  { id: 'detailed', label: 'Detailed & In-Depth' }
];

export default function App() {
  // Layer 1 Input State
  const [prompt, setPrompt] = useState('');
  const [urlsInput, setUrlsInput] = useState('');
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState(null);

  // Layer 2 Project & IR State
  const [projectId, setProjectId] = useState(null);
  const [projectStatus, setProjectStatus] = useState(null);
  const [canonicalIr, setCanonicalIr] = useState(null);
  const [droppedFacts, setDroppedFacts] = useState([]);
  const [irViewTab, setIrViewTab] = useState('summary'); // 'summary' | 'facts' | 'entities' | 'json'
  const [showFactsDrawer, setShowFactsDrawer] = useState(false);

  // Generation Configuration State
  const [selectedOutputs, setSelectedOutputs] = useState(['linkedin', 'executive_summary', 'twitter']);
  const [tone, setTone] = useState('Professional & Formal');
  const [audience, setAudience] = useState('Executives & C-Suite');
  const [detailLevel, setDetailLevel] = useState('standard');
  const [objective, setObjective] = useState('inform');
  const [language, setLanguage] = useState('English');
  const [styleDesc, setStyleDesc] = useState('clear and concise');

  // Job Runner & Live Stream State
  const [jobId, setJobId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const job = useJob(jobId);
  const [activeOutputTab, setActiveOutputTab] = useState('linkedin');
  const [copiedId, setCopiedId] = useState(null);

  // Regeneration Feedback State
  const [feedbackText, setFeedbackText] = useState({});
  const [regeneratingId, setRegeneratingId] = useState(null);

  // Telemetry Metrics State
  const [telemetry, setTelemetry] = useState(null);

  const fileInputRef = useRef(null);

  // Load telemetry metrics
  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/metrics`);
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, []);

  // Poll project until analysis is completed
  useEffect(() => {
    if (!projectId || projectStatus === 'ready' || projectStatus === 'failed') return;

    const pollProject = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`);
        const data = await res.json();
        if (data.status === 'ready' && data.ir) {
          setProjectStatus('ready');
          setCanonicalIr(data.ir.data);
          setDroppedFacts(data.ir.droppedFacts || []);
          setIngesting(false);
          fetchMetrics();
        } else if (data.status === 'failed') {
          setProjectStatus('failed');
          setError(data.error || 'Project analysis failed');
          setIngesting(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    const interval = setInterval(pollProject, 2000);
    pollProject();
    return () => clearInterval(interval);
  }, [projectId, projectStatus]);

  // Sync active output tab when job completes items
  useEffect(() => {
    if (job?.outputs?.length > 0 && !selectedOutputs.includes(activeOutputTab)) {
      setActiveOutputTab(job.outputs[0].type);
    }
  }, [job, selectedOutputs, activeOutputTab]);

  // Handle Drag & Drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = (newFiles) => {
    const supported = ['.pdf', '.docx', '.doc', '.txt', '.md'];
    const valid = newFiles.filter((f) => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      return supported.includes(ext);
    });
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...valid.filter((f) => !names.has(f.name + f.size))];
    });
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));
  const clearAllFiles = () => setFiles([]);

  const toggleOutputSelection = (id) => {
    setSelectedOutputs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Step 1: Ingest & Compile Canonical IR (Layer 1 -> Layer 2)
  const handleIngestAndAnalyze = async () => {
    if (!prompt.trim() && !urlsInput.trim() && files.length === 0) {
      alert('Please provide at least a source prompt, URL, or document.');
      return;
    }

    setIngesting(true);
    setError(null);
    setCanonicalIr(null);
    setJobId(null);

    try {
      // 1. Gather Layer 1 bundle through Ingestion API
      const formData = new FormData();
      if (prompt.trim()) formData.append('raw_text', prompt.trim());
      if (urlsInput.trim()) formData.append('urls', urlsInput.trim());
      files.forEach((file) => formData.append('files', file));
      formData.append('metadata', JSON.stringify({ client: 'cofo-web-dashboard', timestamp: new Date().toISOString() }));

      const ingestRes = await fetch(`${API_BASE}/api/v1/ingest`, {
        method: 'POST',
        body: formData,
      });

      const ingestData = await ingestRes.json();
      if (!ingestRes.ok || !ingestData.success) {
        throw new Error(ingestData.error || 'Ingestion failed');
      }

      const sourceBundle = ingestData.data;

      // 2. Post SourceBundle to POST /api/projects for Canonical IR compiling
      const projectRes = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceBundle),
      });

      const projectData = await projectRes.json();
      if (!projectRes.ok) {
        throw new Error(projectData.error || 'Failed to initialize project');
      }

      setProjectId(projectData.projectId);
      if (projectData.cached && projectData.ir) {
        setProjectStatus('ready');
        setCanonicalIr(projectData.ir);
        setIngesting(false);
      } else {
        setProjectStatus('analyzing');
      }
    } catch (err) {
      console.error('Pipeline error:', err);
      setError(err.message || 'Execution error');
      setIngesting(false);
    }
  };

  // Step 2: Trigger Generation Job (Canonical IR -> N Parallel Deliverables)
  const handleGenerateDeliverables = async () => {
    if (!projectId) return;
    if (selectedOutputs.length === 0) {
      alert('Please select at least one output format to generate.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const payload = {
        types: selectedOutputs,
        params: {
          audience,
          tone,
          language,
          detailLevel,
          objective,
          style: styleDesc,
        },
      };

      const res = await fetch(`${API_BASE}/api/projects/${projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start generation job');

      setJobId(data.jobId);
      setActiveOutputTab(selectedOutputs[0]);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Step 3: Regenerate with Revision Feedback
  const handleRegenerate = async (outputId, canned = '') => {
    const feedback = canned || feedbackText[outputId];
    if (!feedback?.trim()) {
      alert('Please enter feedback to guide the revision.');
      return;
    }

    setRegeneratingId(outputId);
    try {
      const res = await fetch(`${API_BASE}/api/outputs/${outputId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Regeneration failed');

      setJobId(data.jobId);
      setFeedbackText((prev) => ({ ...prev, [outputId]: '' }));
    } catch (err) {
      alert(`Regeneration error: ${err.message}`);
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleCopyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Find active output row
  const activeOutput = job?.outputs?.find((o) => o.type === activeOutputTab);

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span className="ir-badge badge-source" style={{ fontSize: '0.78rem' }}>
            <Cpu size={12} /> Gemini Powered
          </span>
          <span className="ir-badge badge-compiled" style={{ fontSize: '0.78rem' }}>
            <Database size={12} /> Neon PostgreSQL
          </span>
        </div>
        <h1>CoFo Content Engine</h1>
        <p>
          Automated multi-source content transformation into tailored communication artefacts with verified factual provenance.
        </p>
      </header>

      {/* Telemetry Metrics Bar */}
      {telemetry && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.85rem 1.25rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--card-border)',
            borderRadius: '12px',
            marginBottom: '2rem',
            fontSize: '0.85rem',
            color: 'var(--text-muted)'
          }}
        >
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            <span><strong>Total LLM Operations:</strong> {telemetry.totalCalls || 0}</span>
            <span><strong>Avg Latency:</strong> {(telemetry.avgLatencyMs / 1000).toFixed(1)}s</span>
            <span><strong>Tokens Processed:</strong> ~{((telemetry.totalInTokens + telemetry.totalOutTokens) / 1000).toFixed(1)}k</span>
          </div>
          <div style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> Neon PostgreSQL Active
          </div>
        </div>
      )}

      <main>
        {/* ======================================================== */}
        {/* SECTION 1: INGESTION PIPELINE (LAYER 1 SOURCE BUNDLE) */}
        {/* ======================================================== */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="form-label" htmlFor="prompt-input">
            1. Source Text & Instructions (Operator Note)
          </label>
          <textarea
            id="prompt-input"
            className="input-textarea"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type or paste your prompt, context, or text with links (e.g. 'Summarize https://en.wikipedia.org/wiki/Artificial_intelligence and create a briefing')..."
          />
          <div className="form-helper">
            Role isolation: User input is tagged as OPERATOR_NOTE, while source articles provide the factual MATERIAL.
          </div>
        </div>

        {/* URLs Input */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="form-label" htmlFor="urls-input">
            2. Web Articles & URLs to Ingest
          </label>
          <input
            id="urls-input"
            type="text"
            className="input-text"
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            placeholder="https://example.com/article, https://news.site/report"
          />
          <div className="form-helper">
            Protected crawler fetches, cleans markdown noise, and normalizes into structured source items.
          </div>
        </div>

        {/* File Uploads */}
        <div style={{ marginBottom: '2rem' }}>
          <label className="form-label">3. Attached Documents (PDF, DOCX, TXT, MD)</label>
          <div
            className={`upload-section ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.md"
              onChange={(e) => e.target.files?.length && addFiles(Array.from(e.target.files))}
              style={{ display: 'none' }}
            />
            <Upload className="upload-icon" />
            <div className="upload-text">Drag & drop files or click to upload</div>
            <div className="upload-hint">Supported formats: PDF, DOCX, TXT, MD (up to 25MB)</div>
          </div>

          {files.length > 0 && (
            <div className="files-list">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>{files.length} document{files.length > 1 ? 's' : ''} attached</span>
                <button type="button" onClick={clearAllFiles} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Trash2 size={13} /> Clear
                </button>
              </div>
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="file-chip">
                  <div className="file-chip-left">
                    <FileText size={16} color="var(--primary)" />
                    <div>
                      <div className="file-chip-name">{file.name}</div>
                      <div className="file-chip-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  </div>
                  <button type="button" className="file-remove-btn" onClick={() => removeFile(idx)}>
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COMPILE CANONICAL IR BUTTON */}
        <button
          className="generate-btn"
          disabled={ingesting || (!prompt.trim() && !urlsInput.trim() && files.length === 0)}
          onClick={handleIngestAndAnalyze}
        >
          {ingesting ? (
            <>
              <RefreshCw className="animate-spin" size={20} />
              Ingesting & Compiling Canonical IR with Gemini...
            </>
          ) : (
            <>
              <Layers size={20} />
              Ingest & Compile Canonical IR (Layer 2)
            </>
          )}
        </button>

        {/* Error Alert */}
        {error && (
          <div className="error-banner">
            <AlertCircle size={20} />
            <div>
              <strong>Error: </strong>{error}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SECTION 2: CANONICAL IR VIEWER & PROVENANCE LAYER */}
        {/* ======================================================== */}
        {canonicalIr && (
          <div className="ir-container">
            <div className="ir-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Canonical Intermediate Representation</h2>
                  <span className="ir-badge badge-compiled">
                    <CheckCircle2 size={13} /> Verified (Layer 2)
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {canonicalIr.meta?.title || 'Compiled Data Model'} • {canonicalIr.meta?.documentType || 'document'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.3rem', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '10px' }}>
                  <button className={`tab-btn ${irViewTab === 'summary' ? 'active' : ''}`} onClick={() => setIrViewTab('summary')}>
                    Overview
                  </button>
                  <button className={`tab-btn ${irViewTab === 'facts' ? 'active' : ''}`} onClick={() => setIrViewTab('facts')}>
                    Facts ({canonicalIr.facts?.length || 0})
                  </button>
                  <button className={`tab-btn ${irViewTab === 'json' ? 'active' : ''}`} onClick={() => setIrViewTab('json')}>
                    <Code size={13} style={{ marginRight: '3px' }} /> JSON
                  </button>
                </div>

                <button className="action-btn" onClick={() => setShowFactsDrawer(!showFactsDrawer)}>
                  <BookOpen size={14} /> Provenance Drawer
                </button>
              </div>
            </div>

            {/* IR Metrics Cards */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Document Type</div>
                <div className="metric-value" style={{ textTransform: 'capitalize' }}>
                  {canonicalIr.meta?.documentType || 'General'}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Verified Facts</div>
                <div className="metric-value" style={{ color: '#34d399' }}>
                  {canonicalIr.facts?.length || 0} claims
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Urgency & Intent</div>
                <div className="metric-value" style={{ textTransform: 'capitalize', color: '#c084fc' }}>
                  {canonicalIr.intent?.urgency || 'Normal'} • {canonicalIr.intent?.primaryPurpose || 'Inform'}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Hallucinations Dropped</div>
                <div className="metric-value" style={{ color: droppedFacts.length > 0 ? '#f87171' : '#94a3b8' }}>
                  {droppedFacts.length} dropped
                </div>
              </div>
            </div>

            {/* IR Tab Content */}
            {irViewTab === 'summary' && (
              <div>
                <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#38bdf8', marginBottom: '0.4rem' }}>
                    Executive One-Liner
                  </div>
                  <div style={{ fontSize: '1rem', color: '#f1f5f9' }}>
                    {canonicalIr.summary?.oneLine}
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '0.6rem', color: 'var(--text-main)' }}>Key Points</h4>
                  {(canonicalIr.keyPoints || []).map((kp) => (
                    <div key={kp.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.92rem', color: '#cbd5e1' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>•</span>
                      <span>{kp.text}</span>
                    </div>
                  ))}
                </div>

                {canonicalIr.risks?.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.95rem', color: '#f87171', marginBottom: '0.5rem' }}>Identified Risks</h4>
                    {canonicalIr.risks.map((r, i) => (
                      <div key={i} style={{ fontSize: '0.88rem', color: '#fca5a5', marginBottom: '0.3rem' }}>
                        [{r.severity.toUpperCase()}] {r.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {irViewTab === 'facts' && (
              <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '0.8rem' }}>Atomic Facts with Verbatim Provenance</h4>
                {(canonicalIr.facts || []).map((f) => (
                  <div key={f.id} className="fact-row">
                    <span className="fact-id">{f.id}</span>
                    <div className="fact-content">
                      <div style={{ color: '#f1f5f9' }}>{f.claim}</div>
                      <div className="fact-span">Source Span: "{f.sourceSpan}" ({f.sourceId})</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {irViewTab === 'json' && (
              <pre className="json-block">{JSON.stringify(canonicalIr, null, 2)}</pre>
            )}

            {/* Collapsible Facts Provenance Drawer */}
            {showFactsDrawer && (
              <div className="facts-drawer-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#38bdf8' }}>
                    Factual Provenance Ledger
                  </h3>
                  <button onClick={() => setShowFactsDrawer(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Every claim in the Canonical IR is verified against the source text. Non-matching claims are dropped automatically by code.
                </p>
                {(canonicalIr.facts || []).map((fact) => (
                  <div key={fact.id} className="fact-row">
                    <span className="fact-id">{fact.id}</span>
                    <div className="fact-content">
                      <div style={{ color: '#f8fafc', fontWeight: 500 }}>{fact.claim}</div>
                      <div className="fact-span">"{fact.sourceSpan}" — Source {fact.sourceId}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* SECTION 3: OUTPUT PICKER & GENERATION PARAMETERS */}
        {/* ======================================================== */}
        {canonicalIr && (
          <section className="config-panel" style={{ marginTop: '2.5rem' }}>
            <div className="config-panel-header">
              <div>
                <div className="config-title">
                  <SlidersHorizontal size={20} color="var(--primary)" />
                  Select Deliverables & Configure Parameters
                </div>
                <div className="config-subtitle">
                  Select one or more communication artefacts to generate in parallel from the verified Canonical IR.
                </div>
              </div>
              <span className="ir-badge badge-source">
                {selectedOutputs.length} Selected
              </span>
            </div>

            {/* Deliverable Checkbox Cards */}
            <div className="output-formats-grid">
              {OUTPUT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedOutputs.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className={`output-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleOutputSelection(opt.id)}
                  >
                    <div className="output-card-top">
                      <div className="output-card-icon">
                        <Icon size={18} />
                      </div>
                      <div className="output-card-checkbox">
                        {isSelected && <Check size={12} />}
                      </div>
                    </div>
                    <div>
                      <div className="output-card-title">{opt.title}</div>
                      <div className="output-card-desc">{opt.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Generator Parameters Form */}
            <div className="params-grid" style={{ marginTop: '1.5rem' }}>
              <div className="param-group">
                <span className="param-label"><Sparkles size={14} color="#a78bfa" /> Tone of Voice</span>
                <select className="param-select" value={tone} onChange={(e) => setTone(e.target.value)}>
                  {TONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="param-group">
                <span className="param-label"><Users size={14} color="#38bdf8" /> Target Audience</span>
                <select className="param-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="param-group">
                <span className="param-label"><BookOpen size={14} color="#34d399" /> Detail Level</span>
                <select className="param-select" value={detailLevel} onChange={(e) => setDetailLevel(e.target.value)}>
                  {DETAIL_LEVELS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>

              <div className="param-group">
                <span className="param-label"><Target size={14} color="#f59e0b" /> Objective</span>
                <select className="param-select" value={objective} onChange={(e) => setObjective(e.target.value)}>
                  <option value="inform">Inform & Educate</option>
                  <option value="persuade">Persuade & Engage</option>
                  <option value="warn">Warn & Mitigate Risk</option>
                  <option value="instruct">Instruct & Guide</option>
                </select>
              </div>
            </div>

            {/* GENERATE DELIVERABLES BUTTON */}
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="generate-btn"
                style={{ width: 'auto', padding: '0.9rem 2rem' }}
                disabled={generating || selectedOutputs.length === 0}
                onClick={handleGenerateDeliverables}
              >
                {generating ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    Starting Parallel Generation...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate {selectedOutputs.length} Deliverable{selectedOutputs.length > 1 ? 's' : ''} in Parallel
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* SECTION 4: OUTPUT TABS, ARTEFACT RENDERS & AUDIT CHECKS */}
        {/* ======================================================== */}
        {job && (
          <section className="output-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={20} color="var(--primary)" /> Generated Deliverables
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Job Status: <strong style={{ color: job.status === 'done' ? '#34d399' : '#38bdf8' }}>{job.status.toUpperCase()}</strong>
                </span>
              </div>
            </div>

            {/* Deliverable Tabs Nav */}
            <div className="output-tabs-bar">
              {OUTPUT_OPTIONS.filter((o) => selectedOutputs.includes(o.id)).map((opt) => {
                const outRow = job.outputs?.find((o) => o.type === opt.id);
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    className={`output-tab-btn ${activeOutputTab === opt.id ? 'active' : ''}`}
                    onClick={() => setActiveOutputTab(opt.id)}
                  >
                    <Icon size={16} />
                    <span>{opt.title}</span>
                    {outRow?.status === 'running' && <RefreshCw size={12} className="animate-spin" color="#38bdf8" />}
                    {outRow?.status === 'done' && <CheckCircle2 size={13} color="#34d399" />}
                    {outRow?.status === 'failed' && <AlertCircle size={13} color="#f87171" />}
                  </button>
                );
              })}
            </div>

            {/* Active Deliverable Content */}
            {activeOutput ? (
              <div className="deliverable-card">
                <div className="deliverable-header">
                  <div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                      {OUTPUT_OPTIONS.find((o) => o.id === activeOutput.type)?.title}
                    </h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Version {activeOutput.version || 1} • Status: {activeOutput.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    {activeOutput.fileUrl && (
                      <a
                        href={`${API_BASE}/storage/outputs/${activeOutput.fileUrl}`}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="action-btn"
                        style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                      >
                        <Download size={14} /> Download File ({activeOutput.fileUrl.split('.').pop().toUpperCase()})
                      </a>
                    )}

                    {activeOutput.content && (
                      <button
                        className="action-btn"
                        onClick={() =>
                          handleCopyText(
                            activeOutput.content.fullText ||
                              JSON.stringify(activeOutput.content, null, 2),
                            activeOutput.id
                          )
                        }
                      >
                        {copiedId === activeOutput.id ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                        <span>{copiedId === activeOutput.id ? 'Copied!' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Faithfulness Warning Banner if any ungrounded claims */}
                {activeOutput.warnings && activeOutput.warnings.length > 0 && (
                  <div className="faithfulness-warning-box">
                    <div className="faithfulness-warning-title">
                      <AlertTriangle size={16} /> Faithfulness Audit: {activeOutput.warnings.length} claim(s) require verification
                    </div>
                    {activeOutput.warnings.map((w, i) => (
                      <li key={i} className="faithfulness-item">
                        "{w.quote}" — {w.reason}
                      </li>
                    ))}
                  </div>
                )}

                {/* State: Pending / Running */}
                {activeOutput.status === 'running' && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <RefreshCw className="animate-spin" size={28} style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--primary)' }} />
                    Generating deliverable with Gemini and verifying schema...
                  </div>
                )}

                {/* State: Failed */}
                {activeOutput.status === 'failed' && (
                  <div style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderRadius: '10px' }}>
                    <strong>Generation Error:</strong> {activeOutput.error || 'Failed to complete output.'}
                  </div>
                )}

                {/* State: Done (Render Specific Format) */}
                {activeOutput.status === 'done' && activeOutput.content && (
                  <div>
                    {/* 1. LinkedIn */}
                    {activeOutput.type === 'linkedin' && (
                      <div>
                        <div className="deliverable-text-box">
                          {activeOutput.content.fullText || `${activeOutput.content.hook}\n\n${activeOutput.content.body}\n\n${activeOutput.content.cta}`}
                        </div>
                        {activeOutput.content.hashtags && (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {activeOutput.content.hashtags.map((h, i) => (
                              <span key={i} className="ir-badge badge-source">{h}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Twitter / X Thread */}
                    {activeOutput.type === 'twitter' && (
                      <div>
                        {(activeOutput.content.tweets || []).map((t, idx) => (
                          <div key={idx} className="tweet-item">
                            <div>{t.text}</div>
                            <div className="tweet-meta">
                              <span>Tweet {idx + 1} of {activeOutput.content.tweets.length}</span>
                              <span>{t.text.length} / 280 chars</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3. Presentation (PPTX) */}
                    {activeOutput.type === 'presentation' && (
                      <div>
                        <div style={{ marginBottom: '1.25rem', fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>
                          Deck: {activeOutput.content.deckTitle}
                        </div>
                        <div className="slides-grid">
                          {(activeOutput.content.slides || []).map((s, idx) => (
                            <div key={idx} className="slide-card-preview">
                              <div>
                                <div className="slide-number">Slide {idx + 1}</div>
                                <div className="slide-title">{s.title}</div>
                                {(s.bullets || []).map((b, bi) => (
                                  <div key={bi} className="slide-bullet">{b}</div>
                                ))}
                              </div>
                              <div>
                                {s.visualHint && (
                                  <div style={{ fontSize: '0.8rem', color: '#c084fc', marginTop: '0.75rem' }}>
                                    🎨 Visual: {s.visualHint}
                                  </div>
                                )}
                                {s.speakerNotes && (
                                  <div className="slide-notes-hint">
                                    Notes: {s.speakerNotes}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Video Package */}
                    {activeOutput.type === 'video' && (
                      <div>
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                            Video Package: {activeOutput.content.title}
                          </span>
                          <span className="ir-badge badge-source">
                            Duration: ~{activeOutput.content.totalDurationSec || 60}s
                          </span>
                        </div>

                        <table className="storyboard-table">
                          <thead>
                            <tr>
                              <th style={{ width: '80px' }}>Scene</th>
                              <th style={{ width: '100px' }}>Duration</th>
                              <th>Storyboard & Visuals</th>
                              <th>Narration Script</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(activeOutput.content.scenes || []).map((sc) => (
                              <tr key={sc.n || Math.random()}>
                                <td style={{ fontWeight: 600, color: '#c084fc' }}>Scene {sc.n}</td>
                                <td>{sc.durationSec}s</td>
                                <td>
                                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{sc.storyboard}</div>
                                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Visual: {sc.visual}</div>
                                </td>
                                <td>{sc.narration}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 5. Infographic */}
                    {activeOutput.type === 'infographic' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                          <div>
                            <h4 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '4px' }}>
                              {activeOutput.content.headline}
                            </h4>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                              {activeOutput.content.subheadline}
                            </div>
                          </div>
                          {activeOutput.content.palette && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {activeOutput.content.palette.map((hex, i) => (
                                <div
                                  key={i}
                                  title={hex}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    background: hex,
                                    border: '1px solid rgba(255,255,255,0.2)'
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                          {(activeOutput.content.sections || []).map((sec, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.2rem' }}>
                              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.4rem' }}>
                                {sec.icon} {sec.stat}
                              </div>
                              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>{sec.heading}</div>
                              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{sec.text}</div>
                            </div>
                          ))}
                        </div>

                        {activeOutput.fileUrl && (
                          <div style={{ marginTop: '1.5rem' }}>
                            <a
                              href={`${API_BASE}/storage/outputs/${activeOutput.fileUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="action-btn"
                            >
                              <ExternalLink size={14} /> Open Full Rendered Infographic HTML
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 6. Advisory Note */}
                    {activeOutput.type === 'advisory' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <span className="ir-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
                            {activeOutput.content.severity?.toUpperCase() || 'HIGH'} SEVERITY
                          </span>
                          <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                            {activeOutput.content.advisoryId}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>{activeOutput.content.title}</h4>
                        <div className="deliverable-text-box">
                          <strong>Executive Summary:</strong>
                          <p style={{ marginTop: '0.4rem', marginBottom: '1rem' }}>{activeOutput.content.summary}</p>
                          <strong>Background & Impact:</strong>
                          <p style={{ marginTop: '0.4rem' }}>{activeOutput.content.impact}</p>
                        </div>
                        <div style={{ marginTop: '1rem' }}>
                          <h5 style={{ fontSize: '0.95rem', marginBottom: '0.6rem', color: '#38bdf8' }}>Tactical Action Checklist</h5>
                          {(activeOutput.content.recommendedActions || []).map((ra, i) => (
                            <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                              <span className="ir-badge badge-source" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                {ra.priority}
                              </span>
                              <span>{ra.step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 7. Executive Summary */}
                    {activeOutput.type === 'executive_summary' && (
                      <div>
                        <div className="exec-bottom-line">
                          <strong>BOTTOM LINE: </strong>
                          {activeOutput.content.bottomLine}
                        </div>
                        <h4 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>{activeOutput.content.headline}</h4>
                        <div style={{ marginBottom: '1.25rem' }}>
                          <h5 style={{ fontSize: '0.95rem', color: '#38bdf8', marginBottom: '0.5rem' }}>Core Findings</h5>
                          {(activeOutput.content.keyFindings || []).map((kf, i) => (
                            <div key={i} style={{ marginBottom: '0.4rem', fontSize: '0.92rem', paddingLeft: '1rem', position: 'relative' }}>
                              <span style={{ position: 'absolute', left: 0, color: '#38bdf8' }}>•</span> {kf}
                            </div>
                          ))}
                        </div>
                        {(activeOutput.content.decisionsNeeded?.length > 0 || activeOutput.content.nextSteps?.length > 0) && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                              <h5 style={{ color: '#fbbf24', marginBottom: '0.5rem' }}>Decisions Needed</h5>
                              {(activeOutput.content.decisionsNeeded || []).map((d, i) => (
                                <div key={i} style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}>• {d}</div>
                              ))}
                            </div>
                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                              <h5 style={{ color: '#34d399', marginBottom: '0.5rem' }}>Next Steps</h5>
                              {(activeOutput.content.nextSteps || []).map((ns, i) => (
                                <div key={i} style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}>• {ns}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* REGENERATE WITH FEEDBACK (SECTION 11) */}
                    <div className="revision-container">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#c084fc', marginBottom: '0.4rem' }}>
                        <RotateCcw size={14} /> Regenerate with Operator Feedback
                      </div>
                      <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <input
                          type="text"
                          className="input-text"
                          style={{ padding: '0.6rem 0.9rem', fontSize: '0.88rem' }}
                          placeholder="e.g. 'Make it more punchy', 'Focus on immediate business risks', 'Shorten by 30%'"
                          value={feedbackText[activeOutput.id] || ''}
                          onChange={(e) =>
                            setFeedbackText((prev) => ({
                              ...prev,
                              [activeOutput.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          className="action-btn"
                          disabled={regeneratingId === activeOutput.id}
                          onClick={() => handleRegenerate(activeOutput.id)}
                          style={{ background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)', flexShrink: 0 }}
                        >
                          {regeneratingId === activeOutput.id ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                          <span>Revise</span>
                        </button>
                      </div>

                      {/* Quick Chips */}
                      <div className="quick-chips-row">
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Quick revisions:</span>
                        {['Make it shorter', 'More formal tone', 'Focus on risk & urgency', 'Add executive takeaway'].map((qc) => (
                          <button
                            key={qc}
                            type="button"
                            className="quick-chip"
                            onClick={() => handleRegenerate(activeOutput.id, qc)}
                          >
                            + {qc}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Select a deliverable tab above to inspect output.
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}