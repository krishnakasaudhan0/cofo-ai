import React, { useState, useRef } from 'react';
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
  Languages
} from 'lucide-react';
import './index.css';

const API_INGEST_URL = 'http://localhost:3000/api/v1/ingest';

const OUTPUT_OPTIONS = [
  {
    id: 'linkedin',
    title: 'LinkedIn Post',
    description: 'Professional post with engaging hook, structured bullets, and relevant hashtags.',
    icon: Share2,
    badge: 'Social'
  },
  {
    id: 'twitter',
    title: 'Twitter / X Thread',
    description: 'Bite-sized, punchy tweet sequence optimized for virality and high readability.',
    icon: MessageSquare,
    badge: 'Social'
  },
  {
    id: 'video',
    title: 'Video Package',
    description: 'Full script, scene storyboard, voiceover narration, subtitles, and visual cues.',
    icon: Video,
    badge: 'Multimedia'
  },
  {
    id: 'presentation',
    title: 'Presentation (PPT)',
    description: 'Slide deck outlines, key takeaways per slide, and complete speaker notes.',
    icon: Presentation,
    badge: 'Deck'
  },
  {
    id: 'advisory',
    title: 'Advisory Note',
    description: 'Structured formal advisory with risk severity, analysis, and tactical recommendations.',
    icon: ShieldAlert,
    badge: 'Advisory'
  },
  {
    id: 'infographic',
    title: 'Infographic Spec',
    description: 'Visual layout specs, key stats callouts, modular sections, and design directives.',
    icon: ChartPie,
    badge: 'Visual'
  },
  {
    id: 'summary',
    title: 'Executive Summary',
    description: 'High-level synthesis delivering core insights and business impact for leadership.',
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
  'Executive Brief (Concise)',
  'Standard & Balanced',
  'Comprehensive & In-Depth'
];

const OBJECTIVE_OPTIONS = [
  'Inform & Educate',
  'Drive Immediate Action',
  'Risk Mitigation & Advisory',
  'Brand Awareness & Thought Leadership'
];

const LANGUAGE_OPTIONS = [
  'English (US)',
  'English (UK)',
  'International English'
];

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [urlsInput, setUrlsInput] = useState('');
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canonicalIr, setCanonicalIr] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('structured'); // 'structured' | 'json'

  // Generation Parameters & Output Deliverables State
  const [selectedOutputs, setSelectedOutputs] = useState(['linkedin', 'summary']);
  const [tone, setTone] = useState('Professional & Formal');
  const [audience, setAudience] = useState('Executives & C-Suite');
  const [detailLevel, setDetailLevel] = useState('Standard & Balanced');
  const [objective, setObjective] = useState('Inform & Educate');
  const [language, setLanguage] = useState('English (US)');

  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles) => {
    const supportedExts = ['.pdf', '.docx', '.doc', '.txt', '.md'];
    const validFiles = [];
    const invalidFiles = [];

    newFiles.forEach((file) => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (supportedExts.includes(ext)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      alert(`Unsupported files skipped: ${invalidFiles.join(', ')}\nSupported formats: PDF, DOCX, DOC, TXT, MD`);
    }

    if (validFiles.length > 0) {
      setFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name + f.size));
        const filteredNew = validFiles.filter((f) => !existingNames.has(f.name + f.size));
        return [...prev, ...filteredNew];
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleOutput = (id) => {
    setSelectedOutputs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllOutputs = () => {
    setSelectedOutputs(OUTPUT_OPTIONS.map((o) => o.id));
  };

  const clearAllOutputs = () => {
    setSelectedOutputs([]);
  };

  const handleIngest = async () => {
    if (!prompt.trim() && !urlsInput.trim() && files.length === 0) {
      alert('Please provide at least a prompt, a URL, or a file to ingest.');
      return;
    }

    setLoading(true);
    setError(null);
    setCanonicalIr(null);

    try {
      const formData = new FormData();

      if (prompt.trim()) {
        formData.append('raw_text', prompt.trim());
      }

      if (urlsInput.trim()) {
        formData.append('urls', urlsInput.trim());
      }

      files.forEach((file) => {
        formData.append('files', file);
      });

      const parametersPayload = {
        tone,
        target_audience: audience,
        level_of_detail: detailLevel,
        communication_objective: objective,
        language
      };

      formData.append(
        'metadata',
        JSON.stringify({
          client: 'cofo-web-frontend',
          ingested_at: new Date().toISOString(),
          target_outputs: selectedOutputs,
          parameters: parametersPayload
        })
      );

      formData.append('target_outputs', JSON.stringify(selectedOutputs));
      formData.append('parameters', JSON.stringify(parametersPayload));

      const response = await fetch(API_INGEST_URL, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Ingestion failed on backend');
      }

      setCanonicalIr(result.data);
      setActiveTab('structured');
    } catch (err) {
      console.error('Ingestion error:', err);
      setError(err.message || 'Failed to connect to ingestion server.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (!canonicalIr) return;
    navigator.clipboard.writeText(JSON.stringify(canonicalIr, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCanonicalIr(null);
    setError(null);
    setPrompt('');
    setUrlsInput('');
    clearAllFiles();
  };

  return (
    <div className="container">
      <header className="header">
        <h1>CoFo Ingestion Engine</h1>
        <p>
          Transform source text, web articles, and documents into customized deliverables with tailored tone, audience segmentation, and formatting.
        </p>
      </header>

      <main>
        {/* 1. Prompt / Raw Text */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="form-label" htmlFor="prompt-input">
            Source Prompt / Raw Text
          </label>
          <textarea
            id="prompt-input"
            className="input-textarea"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your source text, report, or prompt with links (e.g. 'Analyze https://en.wikipedia.org/wiki/Artificial_intelligence and draft communications')..."
          />
          <div className="form-helper">
            URLs entered here are automatically extracted and crawled by the ingestion pipeline.
          </div>
        </div>

        {/* 2. Additional URLs (Optional) */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="form-label" htmlFor="urls-input">
            Additional URLs to Crawl (Optional)
          </label>
          <input
            id="urls-input"
            type="text"
            className="input-text"
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            placeholder="https://example.com/docs, https://news.ycombinator.com"
          />
          <div className="form-helper">
            Comma-separated URLs to fetch and normalize into clean markdown source text.
          </div>
        </div>

        {/* 3. Document Upload (PDF, DOCX, DOC, TXT, MD) */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="form-label">Attached Source Documents</label>
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
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            <Upload className="upload-icon" />
            <div className="upload-text">Drag & drop files or click to browse</div>
            <div className="upload-hint">Supported formats: PDF, DOCX, DOC, TXT, MD (up to 25MB each)</div>
          </div>

          {files.length > 0 && (
            <div className="files-list">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.4rem',
                  fontSize: '0.88rem',
                  color: 'var(--text-muted)'
                }}
              >
                <span>{files.length} file{files.length > 1 ? 's' : ''} ready for ingestion</span>
                <button
                  type="button"
                  onClick={clearAllFiles}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 size={14} /> Clear all
                </button>
              </div>

              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="file-chip">
                  <div className="file-chip-left">
                    <FileText size={18} color="var(--primary)" />
                    <div>
                      <div className="file-chip-name">{file.name}</div>
                      <div className="file-chip-size">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {file.name.split('.').pop()?.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="file-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    title="Remove file"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PRIMARY COMPILE BUTTON */}
        <button
          className="generate-btn"
          disabled={loading || (!prompt.trim() && !urlsInput.trim() && files.length === 0)}
          onClick={handleIngest}
        >
          {loading ? (
            <>
              <RefreshCw className="animate-spin" size={20} />
              Compiling Canonical IR...
            </>
          ) : (
            <>
              <Layers size={20} />
              Compile Canonical IR
            </>
          )}
        </button>

        {/* ======================================================== */}
        {/* OUTPUT DELIVERABLES & GENERATION PARAMETERS (BELOW COMPILE) */}
        {/* ======================================================== */}
        <section className="config-panel">
          <div className="config-panel-header">
            <div>
              <div className="config-title">
                <SlidersHorizontal size={20} color="var(--primary)" />
                Output Options & Generation Parameters
              </div>
              <div className="config-subtitle">
                Select one or more desired output deliverables and fine-tune operator segments (tone, audience, level of detail).
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="ir-badge badge-source">
                {selectedOutputs.length} Output{selectedOutputs.length === 1 ? '' : 's'} Selected
              </span>
              <span
                className="ir-badge"
                style={{
                  background: 'rgba(139, 92, 246, 0.15)',
                  color: '#c084fc',
                  border: '1px solid rgba(139, 92, 246, 0.3)'
                }}
              >
                {tone}
              </span>
            </div>
          </div>

          {/* 1. Output Deliverables Selection (Multi-select) */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}
            >
              <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={16} color="var(--primary)" />
                Desired Output Formats (Multi-Select)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={selectAllOutputs}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Select All
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>•</span>
                <button
                  type="button"
                  onClick={clearAllOutputs}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="output-formats-grid">
              {OUTPUT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedOutputs.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className={`output-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleOutput(opt.id)}
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
          </div>

          {/* 2. Generation Parameters: Tone, Audience, Detail, Objective, Language */}
          <div>
            <label className="form-label" style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Target size={16} color="var(--primary)" />
              Tone & Audience Segmentation Parameters
            </label>

            <div className="params-grid">
              {/* Tone of Voice */}
              <div className="param-group">
                <span className="param-label">
                  <Sparkles size={14} color="#a78bfa" /> Tone of Voice
                </span>
                <select
                  className="param-select"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="param-quick-pills">
                  {['Professional', 'Analytical', 'Conversational', 'Urgent'].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      className={`param-pill ${tone.includes(quick) ? 'active' : ''}`}
                      onClick={() => {
                        const found = TONE_OPTIONS.find((t) => t.includes(quick));
                        if (found) setTone(found);
                      }}
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Audience Segment */}
              <div className="param-group">
                <span className="param-label">
                  <Users size={14} color="#38bdf8" /> Target Audience
                </span>
                <select
                  className="param-select"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                >
                  {AUDIENCE_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <div className="param-quick-pills">
                  {['Executives', 'Technical', 'General Public', 'Investors'].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      className={`param-pill ${audience.includes(quick) ? 'active' : ''}`}
                      onClick={() => {
                        const found = AUDIENCE_OPTIONS.find((a) => a.includes(quick));
                        if (found) setAudience(found);
                      }}
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </div>

              {/* Level of Detail */}
              <div className="param-group">
                <span className="param-label">
                  <BookOpen size={14} color="#34d399" /> Level of Detail
                </span>
                <select
                  className="param-select"
                  value={detailLevel}
                  onChange={(e) => setDetailLevel(e.target.value)}
                >
                  {DETAIL_LEVELS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Communication Objective */}
              <div className="param-group">
                <span className="param-label">
                  <Target size={14} color="#f59e0b" /> Objective
                </span>
                <select
                  className="param-select"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                >
                  {OBJECTIVE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div className="param-group">
                <span className="param-label">
                  <Languages size={14} color="#ec4899" /> Output Language
                </span>
                <select
                  className="param-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Action Button below parameters */}
          <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="generate-btn"
              style={{ width: 'auto', padding: '0.85rem 1.75rem', fontSize: '1rem' }}
              disabled={loading || (!prompt.trim() && !urlsInput.trim() && files.length === 0)}
              onClick={handleIngest}
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  Compiling...
                </>
              ) : (
                <>
                  <Layers size={18} />
                  Compile Canonical IR with Parameters
                </>
              )}
            </button>
          </div>
        </section>

        {/* Error Alert */}
        {error && (
          <div className="error-banner">
            <AlertCircle size={20} />
            <div>
              <strong>Ingestion Error: </strong>
              {error}
            </div>
          </div>
        )}

        {/* CANONICAL IR DISPLAY SECTION */}
        {canonicalIr && (
          <div className="ir-container">
            <div className="ir-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                  <h2 style={{ fontSize: '1.45rem', fontWeight: 700 }}>Canonical Intermediate Representation</h2>
                  <span className="ir-badge badge-compiled">
                    <CheckCircle2 size={13} /> {canonicalIr.status || 'compiled'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Normalized data model with operator configuration ready for synthesis
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.3rem', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '10px' }}>
                  <button
                    className={`tab-btn ${activeTab === 'structured' ? 'active' : ''}`}
                    onClick={() => setActiveTab('structured')}
                  >
                    Structured View
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
                    onClick={() => setActiveTab('json')}
                  >
                    <Code size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                    Raw JSON
                  </button>
                </div>

                <button className="action-btn" onClick={handleCopyJson} title="Copy Canonical IR JSON">
                  {copied ? (
                    <>
                      <Check size={16} color="#34d399" />
                      <span style={{ color: '#34d399' }}>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copy IR</span>
                    </>
                  )}
                </button>

                <button className="action-btn" onClick={handleReset} title="Reset">
                  <RefreshCw size={15} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Metrics Overview */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Session ID</div>
                <div className="metric-value" style={{ fontSize: '0.95rem' }}>
                  {canonicalIr.session_id}
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">IR Version</div>
                <div className="metric-value">v{canonicalIr.ir_version}</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Total Sources</div>
                <div className="metric-value">{canonicalIr.total_sources || canonicalIr.sources?.length || 0}</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Target Outputs</div>
                <div className="metric-value" style={{ fontSize: '1rem', color: '#38bdf8' }}>
                  {canonicalIr.target_outputs?.length || selectedOutputs.length} format{(canonicalIr.target_outputs?.length || selectedOutputs.length) === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            {/* Configured Parameters Badge & Summary in IR */}
            {(canonicalIr.target_outputs?.length > 0 || canonicalIr.parameters) && (
              <div
                style={{
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem'
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    marginBottom: '0.6rem',
                    color: '#c084fc',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <SlidersHorizontal size={16} /> Configured Deliverables & Parameters
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Target Outputs:</span>
                  {(canonicalIr.target_outputs || selectedOutputs).map((out) => (
                    <span key={out} className="ir-badge badge-source" style={{ textTransform: 'capitalize' }}>
                      {out}
                    </span>
                  ))}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Tone:</span>
                  <span className="ir-badge badge-compiled">
                    {canonicalIr.parameters?.tone || tone}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Audience:</span>
                  <span
                    className="ir-badge"
                    style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.25)'
                    }}
                  >
                    {canonicalIr.parameters?.target_audience || audience}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Detail:</span>
                  <span
                    className="ir-badge"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--card-border)'
                    }}
                  >
                    {canonicalIr.parameters?.level_of_detail || detailLevel}
                  </span>
                </div>
              </div>
            )}

            {/* View Modes */}
            {activeTab === 'structured' ? (
              <div>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={18} color="var(--primary)" />
                  Ingested Sources ({canonicalIr.sources?.length || 0})
                </h3>

                {(!canonicalIr.sources || canonicalIr.sources.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No sources were compiled into this IR.
                  </div>
                )}

                {canonicalIr.sources?.map((source, idx) => (
                  <div key={idx} className="source-card">
                    <div className="source-header">
                      <div className="source-title">
                        {source.source_type === 'raw_text' && <FileText size={18} color="#c084fc" />}
                        {source.source_type === 'web_page' && <Globe size={18} color="#38bdf8" />}
                        {source.source_type === 'document' && <FileText size={18} color="#34d399" />}
                        <span>
                          {source.title || (source.source_type === 'raw_text' ? 'Cleaned Prompt & Input Text' : source.origin)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="ir-badge badge-source">{source.source_type}</span>
                        {source.status === 'success' && (
                          <span className="ir-badge badge-compiled">
                            <CheckCircle2 size={12} /> Success
                          </span>
                        )}
                        {source.status === 'failed' && (
                          <span className="ir-badge badge-failed">
                            <AlertCircle size={12} /> Failed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="source-meta-row">
                      {source.origin && <span><strong>Origin:</strong> {source.origin}</span>}
                      {source.sanitized_url && <span><strong>URL:</strong> {source.sanitized_url}</span>}
                      {source.tokens !== undefined && <span><strong>Tokens:</strong> ~{source.tokens}</span>}
                      {source.mime_type && <span><strong>Mime:</strong> {source.mime_type}</span>}
                      {source.size_bytes && <span><strong>Size:</strong> {(source.size_bytes / 1024).toFixed(1)} KB</span>}
                    </div>

                    {source.error ? (
                      <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderRadius: '8px', fontSize: '0.88rem' }}>
                        <strong>Error:</strong> {source.error}
                      </div>
                    ) : (
                      <div className="content-preview">
                        {source.content || <em style={{ color: 'var(--text-muted)' }}>[No text content]</em>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <pre className="json-block">{JSON.stringify(canonicalIr, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}