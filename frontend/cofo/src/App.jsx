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
  Code
} from 'lucide-react';
import './index.css';

const API_INGEST_URL = 'http://localhost:3000/api/v1/ingest';

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

      formData.append(
        'metadata',
        JSON.stringify({
          client: 'cofo-web-frontend',
          ingested_at: new Date().toISOString()
        })
      );

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
          Transform raw text, web URLs, and multi-format documents into a structured Canonical Intermediate Representation (IR).
        </p>
      </header>

      <main>
        {/* 1. Prompt / Raw Text */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="form-label" htmlFor="prompt-input">
            Prompt / Raw Text Input
          </label>
          <textarea
            id="prompt-input"
            className="input-textarea"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your prompt, question, or text with links (e.g. 'Summarize https://en.wikipedia.org/wiki/Artificial_intelligence and generate insights')..."
          />
          <div className="form-helper">
            Any URLs detected in this prompt are automatically parsed, sanitized, and ingested into the IR.
          </div>
        </div>

        {/* 2. Additional URLs (Optional) */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="form-label" htmlFor="urls-input">
            Additional URLs (Optional)
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
            Comma-separated URLs to crawl and normalize into structured markdown source items.
          </div>
        </div>

        {/* 3. Document Upload (PDF, DOCX, DOC, TXT, MD) */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="form-label">Attached Documents</label>
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

        {/* Action Button */}
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
                  Normalized data model ready for downstream pipeline synthesis
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
                <div className="metric-label">Ingested At</div>
                <div className="metric-value" style={{ fontSize: '0.9rem' }}>
                  {new Date(canonicalIr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>

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