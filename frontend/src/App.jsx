import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const MAX_BYTES = 4 * 1024 * 1024;

const SAMPLE_JD = `Software Engineer (1-3 years)

We build web applications for enterprise customers. You will design and ship features across the stack and work closely with product and design.

Responsibilities:
- Build responsive interfaces with React, JavaScript and TypeScript.
- Develop REST APIs using Python (FastAPI) or Node.js.
- Design SQL schemas and optimize queries in PostgreSQL or MySQL.
- Implement authentication (JWT) and role-based access control.
- Write unit and integration tests, and take part in code reviews.
- Work with Git, Docker and CI/CD pipelines; deploy to AWS or similar.

Required: 1-3 years of professional experience, strong fundamentals in data structures and OOP, Git, REST APIs, SQL.
Preferred: Docker, cloud (AWS/Azure/GCP), Redis, microservices, experience integrating AI APIs.`;

function verdictFor(score) {
  if (score >= 85) return "Excellent fit";
  if (score >= 70) return "Strong fit";
  if (score >= 50) return "Partial fit";
  return "Weak fit";
}

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readError(res) {
  try {
    const data = await res.json();
    return typeof data.detail === "string" ? data.detail : "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

function useCountUp(target) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }
    let raf;
    const start = performance.now();
    const duration = 1000;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect x="4" y="2" width="18" height="22" rx="4" fill="currentColor" />
      <path d="M8.5 9h9M8.5 13h9M8.5 17h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Report({ data }) {
  const r = data.result || {};
  const score = Math.max(0, Math.min(100, Number(r.match_score) || 0));
  const shown = useCountUp(score);
  const [done, setDone] = useState({});
  const [copied, setCopied] = useState(false);

  const matched = r.matched_skills || [];
  const missing = r.missing_skills || [];
  const strengths = r.strengths || [];
  const suggestions = r.suggestions || [];

  async function copyReport() {
    const text = [
      `Resume: ${data.filename}`,
      `Match score: ${score}/100 (${verdictFor(score)})`,
      "",
      r.summary || "",
      "",
      `Matched skills: ${matched.join(", ") || "none"}`,
      `Missing skills: ${missing.join(", ") || "none"}`,
      "",
      "Suggestions:",
      ...suggestions.map((s, i) => `${i + 1}. ${s}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard can be blocked; ignore */
    }
  }

  return (
    <div className="report">
      <div className="report-actions">
        <button type="button" className="btn btn-quiet" onClick={copyReport}>
          {copied ? "Copied" : "Copy report"}
        </button>
      </div>

      <section className="panel score-card" aria-label="Match score">
        <div className="score-top">
          <span className="score-num">{shown}</span>
          <span className="score-of">out of 100</span>
          <span className="verdict">{verdictFor(score)}</span>
        </div>
        <p className="file-ref">{data.filename}</p>

        <div role="img" aria-label={`Score ${score} out of 100: ${verdictFor(score)}`}>
          <div className="meter-track">
            <div className="seg s1" />
            <div className="seg s2" />
            <div className="seg s3" />
            <div className="seg s4" />
            <div className="pin" style={{ left: `${shown}%` }} />
          </div>
          <div className="meter-labels">
            <span className="s1">Weak</span>
            <span className="s2">Partial</span>
            <span className="s3">Strong</span>
            <span className="s4">Excellent</span>
          </div>
        </div>

        <p className="summary">{r.summary}</p>
      </section>

      <div className="skills">
        <section className="panel">
          <div className="panel-head">
            <h2>Skills you show</h2>
            <span className="count">{matched.length}</span>
          </div>
          {matched.length ? (
            <ul className="skill-list">
              {matched.map((s, i) => (
                <li key={i}>
                  <span className="mark good" aria-hidden="true">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <div className="none">No matching skills found.</div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Skills to add</h2>
            <span className="count">{missing.length}</span>
          </div>
          {missing.length ? (
            <ul className="skill-list">
              {missing.map((s, i) => (
                <li key={i}>
                  <span className="mark gap" aria-hidden="true">–</span>
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <div className="none">No gaps found for this job.</div>
          )}
        </section>
      </div>

      {strengths.length > 0 && (
        <section className="panel">
          <h2>What works</h2>
          <ul className="plain-list">
            {strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="panel">
          <h2>Edits to make before you apply</h2>
          <p className="todo-hint">Tick each one off as you update your resume.</p>
          <ul className="todo">
            {suggestions.map((s, i) => (
              <li key={i}>
                <label className={done[i] ? "done" : ""}>
                  <input
                    type="checkbox"
                    checked={!!done[i]}
                    onChange={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                  />
                  <span>{s}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Loading() {
  return (
    <section className="panel" aria-busy="true" aria-live="polite">
      <p className="loading-note">Analyzing your resume. This can take up to 30 seconds.</p>
      <div className="sk sk-big" />
      <div className="sk sk-line" />
      <div className="sk sk-line" />
      <div className="sk sk-line short" />
    </section>
  );
}

function Empty() {
  return (
    <section className="panel empty">
      <h2>Your report will appear here</h2>
      <p>Add a resume and a job description, then select Analyze resume. You will get:</p>
      <ul>
        <li>
          <strong>A match score</strong>
          <span>Placed on a four-band scale from weak to excellent fit.</span>
        </li>
        <li>
          <strong>Skills you show and skills to add</strong>
          <span>Compared directly with what the job asks for.</span>
        </li>
        <li>
          <strong>Edits to make before you apply</strong>
          <span>Specific changes you can tick off as you go.</span>
        </li>
      </ul>
    </section>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  async function loadHistory() {
    try {
      const res = await fetch(`${API}/history`);
      if (res.ok) setHistory(await res.json());
    } catch {
      /* history is optional */
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  function pickFile(f) {
    setError("");
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("That file is not a PDF. Export your resume as a PDF and try again.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("That PDF is over 4 MB. Use a smaller file.");
      return;
    }
    setFile(f);
  }

  function removeFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleAnalyze() {
    setError("");
    if (!file) return setError("Add your resume as a PDF first.");
    if (jd.trim().length < 30) return setError("Paste a longer job description (at least 30 characters).");

    const form = new FormData();
    form.append("resume", file);
    form.append("job_description", jd);

    setLoading(true);
    try {
      const res = await fetch(`${API}/analyze`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await readError(res));
      setData(await res.json());
      loadHistory();
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Can't reach the server. Start the backend and try again."
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }

  async function openHistory(id) {
    setError("");
    try {
      const res = await fetch(`${API}/history/${id}`);
      if (!res.ok) throw new Error(await readError(res));
      const item = await res.json();
      setData({ id: item.id, filename: item.filename, result: item.result });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo />
          Resume Analyzer
        </div>
      </header>

      <section className="hero">
        <h1>See how your resume reads against a job post.</h1>
        <p>
          Upload a PDF, paste the job description, and get a match score, the skills you are
          missing, and the edits to make before you apply.
        </p>
      </section>

      <div className="workspace">
        <div className="side">
          <section className="panel">
            <h2>Your details</h2>

            <div className="field">
              <div className="field-label">
                Resume <span>PDF, up to 4 MB</span>
              </div>
              {file ? (
                <div className="file-row">
                  <div className="file-meta">
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{formatSize(file.size)}</div>
                  </div>
                  <button type="button" className="link-btn" onClick={removeFile}>
                    Remove
                  </button>
                </div>
              ) : (
                <label
                  className={`drop ${dragging ? "is-dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    pickFile(e.dataTransfer.files[0]);
                  }}
                >
                  <input
                    ref={inputRef}
                    className="sr-only"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => pickFile(e.target.files[0])}
                  />
                  <strong>Drop your resume here</strong>
                  <span>or click to choose a file</span>
                </label>
              )}
            </div>

            <div className="field">
              <div className="field-label">
                <label htmlFor="jd">Job description</label>
                <span>{jd.trim().length} characters</span>
              </div>
              <textarea
                id="jd"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the full job post here."
              />
              <button type="button" className="link-btn" onClick={() => setJd(SAMPLE_JD)}>
                Use a sample job description
              </button>
            </div>

            <button type="button" className="btn" onClick={handleAnalyze} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze resume"}
            </button>

            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}

            <p className="notice">
              Your resume text is sent to Google's Gemini API for analysis. Remove anything
              sensitive before you upload.
            </p>
          </section>

          <section className="panel">
            <h2>Recent analyses</h2>
            {history.length === 0 ? (
              <div className="none" style={{ color: "var(--ink-soft)" }}>
                Your past results will be listed here.
              </div>
            ) : (
              <div className="hist">
                {history.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className="hist-item"
                    aria-current={data?.id === h.id}
                    onClick={() => openHistory(h.id)}
                  >
                    <span className="hist-score">{h.match_score ?? "-"}</span>
                    <span className="hist-meta">
                      <div className="hist-name">{h.filename}</div>
                      <div className="hist-date">{h.created_at?.slice(0, 10)}</div>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <main>
          {loading ? <Loading /> : data ? <Report key={data.id} data={data} /> : <Empty />}
        </main>
      </div>
    </div>
  );
}