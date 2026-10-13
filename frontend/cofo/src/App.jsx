import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Video,
  Presentation,
  Lightbulb,
  Image as ImageIcon,
  CheckCircle2,
  X
} from 'lucide-react';

import * as pdfjsLib from 'pdfjs-dist';
import './index.css';

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const outputOptions = [
  { id: 'linkedin', title: 'LinkedIn Post', icon: FileText },
  { id: 'video', title: 'Video Package', icon: Video },
  { id: 'ppt', title: 'PPT Presentation', icon: Presentation },
  { id: 'advisory', title: 'Advisory Note', icon: Lightbulb },
  { id: 'infographic', title: 'Infographic', icon: ImageIcon },
];

function App() {
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState([]);

  // NEW: store generated result
  const [generatedContent, setGeneratedContent] = useState(null);

  // NEW: loading state
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];

      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
      } else {
        alert('Please upload a PDF file.');
      }
    }
  };

  const handleChange = (e) => {
    e.preventDefault();

    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
      } else {
        alert('Please upload a PDF file.');
      }
    }
  };

  const clearFile = () => {
    setFile(null);
    setGeneratedContent(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ------------------------------------------
  // PDF -> TEXT
  // ------------------------------------------
  const extractPdfText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer
    }).promise;

    let fullText = '';

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber);

      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => item.str)
        .join(' ');

      fullText += `\n\n--- Page ${pageNumber} ---\n\n`;
      fullText += pageText;
    }

    return fullText.trim();
  };

  // ------------------------------------------
  // GENERATE
  // ------------------------------------------
  const handleGenerate = async () => {

    if (!file) {
      alert("Please upload a PDF.");
      return;
    }

    if (selectedOutput.length === 0) {
      alert("Please select at least one output format.");
      return;
    }

    try {

      setLoading(true);
      setGeneratedContent(null);

      console.log("Extracting PDF text...");

      // 1. PDF -> TEXT
      const pdfText = await extractPdfText(file);

      console.log("PDF text:", pdfText);

      // 2. Create payload
      const payload = {
        pdfText: pdfText,
        prompt: prompt,
        selectedOutput: selectedOutput
      };

      console.log("Sending payload:", payload);

      // 3. Send to backend
      const response = await fetch(
        "http://localhost:3000/api/generate",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        }
      );

      // 4. Convert response to JSON
      const data = await response.json();

      console.log("Backend response:", data);

      if (!response.ok) {
        throw new Error(
          data.error || "Generation failed"
        );
      }

      // 5. Store generated content
      setGeneratedContent(data);

    } catch (error) {

      console.error(
        "Error generating:",
        error
      );

      alert(
        error.message ||
        "Something went wrong while generating content."
      );

    } finally {

      setLoading(false);

    }
  };

  return (
    <div className="container">

      <header className="header">

        <h1>
          Transform Your Documents
        </h1>

        <p>
          Upload a PDF and turn it into engaging content instantly
        </p>

      </header>

      <main>

        {/* -------------------------------- */}
        {/* PDF UPLOAD */}
        {/* -------------------------------- */}

        {!file ? (

          <div
            className={`upload-section ${dragActive ? 'drag-active' : ''
              }`}

            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}

            onClick={() =>
              fileInputRef.current?.click()
            }
          >

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleChange}
              style={{ display: 'none' }}
            />

            <Upload className="upload-icon" />

            <div className="upload-text">
              Click or drag your PDF here
            </div>

            <div className="upload-hint">
              Maximum file size 50MB
            </div>

          </div>

        ) : (

          <div className="upload-section file-info">

            <CheckCircle2
              style={{ color: '#10b981' }}
              size={32}
            />

            <div
              style={{
                flex: 1,
                textAlign: 'left'
              }}
            >

              <div
                style={{
                  fontWeight: 600,
                  fontSize: '1.1rem'
                }}
              >
                {file.name}
              </div>

              <div
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem'
                }}
              >
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>

            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}

              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px'
              }}
            >

              <X size={24} />

            </button>

          </div>
        )}

        {/* -------------------------------- */}
        {/* PROMPT */}
        {/* -------------------------------- */}

        <div
          style={{
            marginTop: '2rem',
            marginBottom: '1rem',
            fontWeight: 600,
            fontSize: '1.2rem'
          }}
        >
          Enter your prompt
        </div>

        <textarea
          value={prompt}

          onChange={(e) =>
            setPrompt(e.target.value)
          }

          placeholder="Tell the AI what you want to generate..."

          rows={5}

          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #ddd',
            resize: 'vertical',
            fontSize: '1rem'
          }}
        />

        {/* -------------------------------- */}
        {/* OUTPUT OPTIONS */}
        {/* -------------------------------- */}

        <div
          style={{
            marginBottom: '1rem',
            fontWeight: 600,
            fontSize: '1.2rem',
            marginTop: '2rem'
          }}
        >
          Select Output Format
        </div>

        <div className="options-grid">

          {outputOptions.map((option) => {

            const Icon = option.icon;

            return (

              <div
                key={option.id}

                className={`option-card ${selectedOutput.includes(option.id)
                    ? 'selected'
                    : ''
                  }`}

                onClick={() =>
                  setSelectedOutput(prev =>
                    prev.includes(option.id)

                      ? prev.filter(
                        id => id !== option.id
                      )

                      : [
                        ...prev,
                        option.id
                      ]
                  )
                }
              >

                <Icon className="option-icon" />

                <div className="option-title">
                  {option.title}
                </div>

              </div>

            );

          })}

        </div>

        {/* -------------------------------- */}
        {/* GENERATE BUTTON */}
        {/* -------------------------------- */}

        <button
          className="generate-btn"

          disabled={
            !file ||
            selectedOutput.length === 0 ||
            loading
          }

          onClick={handleGenerate}
        >

          {loading
            ? "Generating..."
            : "Generate Magic"
          }

        </button>


        {/* ================================= */}
        {/* GENERATED OUTPUT */}
        {/* ================================= */}

        {generatedContent && (

          <div
            style={{
              marginTop: '3rem',
              padding: '2rem',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: 'black'
            }}
          >

            <h2>
              Generated Content
            </h2>


            {/* ----------------------------- */}
            {/* LINKEDIN */}
            {/* ----------------------------- */}

            {generatedContent.linkedinPost && (

              <div
                style={{
                  marginTop: '2rem'
                }}
              >

                <h3>
                  LinkedIn Post
                </h3>

                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    padding: '1rem',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #ddd'
                  }}
                >
                  {generatedContent.linkedinPost}
                </div>

              </div>

            )}


            {/* ----------------------------- */}
            {/* VIDEO */}
            {/* ----------------------------- */}

            {generatedContent.video?.timeline?.length > 0 && (

              <div
                style={{
                  marginTop: '2rem'
                }}
              >

                <h3>
                  Video Package
                </h3>

                {generatedContent.video.timeline.map(
                  (scene, index) => (

                    <div
                      key={index}

                      style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'white',
                        borderRadius: '8px',
                        border: '1px solid #ddd'
                      }}
                    >

                      <h4>
                        Scene {index + 1}: {scene.scene}
                      </h4>

                      <p>
                        <strong>
                          Visual:
                        </strong>{' '}
                        {scene.visualScript}
                      </p>

                      <p>
                        <strong>
                          Voiceover:
                        </strong>{' '}
                        {scene.voiceover}
                      </p>

                      <p>
                        <strong>
                          Music:
                        </strong>{' '}
                        {scene.musicCues}
                      </p>

                    </div>

                  )
                )}

              </div>

            )}


            {/* ----------------------------- */}
            {/* PPT */}
            {/* ----------------------------- */}

            {generatedContent.ppt?.slides?.length > 0 && (

              <div
                style={{
                  marginTop: '2rem'
                }}
              >

                <h3>
                  PPT Presentation
                </h3>

                {generatedContent.ppt.slides.map(
                  (slide, index) => (

                    <div
                      key={index}

                      style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'white',
                        borderRadius: '8px',
                        border: '1px solid #ddd'
                      }}
                    >

                      <h4>
                        {slide.slide}
                      </h4>

                      <p>
                        {slide.content}
                      </p>

                      <p>
                        <strong>
                          Image:
                        </strong>{' '}
                        {slide.imageDescription}
                      </p>

                    </div>

                  )
                )}

              </div>

            )}


            {/* ----------------------------- */}
            {/* ADVISORY NOTE */}
            {/* ----------------------------- */}

            {generatedContent.advisoryNote && (

              <div
                style={{
                  marginTop: '2rem'
                }}
              >

                <h3>
                  Advisory Note
                </h3>

                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    padding: '1rem',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #ddd'
                  }}
                >
                  {generatedContent.advisoryNote}
                </div>

              </div>

            )}


            {/* ----------------------------- */}
            {/* INFOGRAPHIC */}
            {/* ----------------------------- */}

            {generatedContent.infographic && (

              <div
                style={{
                  marginTop: '2rem'
                }}
              >

                <h3>
                  Infographic
                </h3>

                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    padding: '1rem',
                    background: 'white',
                    borderRadius: '8px',
                    color: "black",
                    border: '1px solid #ddd'
                  }}
                >
                  {generatedContent.infographic}
                </div>

              </div>

            )}

          </div>

        )}

      </main>

    </div>
  );
}

export default App;