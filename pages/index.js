import { useState, useRef } from 'react';
import Head from 'next/head';

export default function Home() {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef(null);

  function handleFiles(newFiles) {
    const arr = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    setFiles(prev => [...prev, ...arr]);
    setRecords([]);
    setStatus('');
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    setFiles([]);
    setRecords([]);
    setStatus('');
    fileInputRef.current.value = '';
  }

  async function parseAll() {
    if (!files.length) return;
    setLoading(true);
    setIsError(false);
    setRecords([]);
    setProgress({ current: 0, total: files.length });

    const allRecords = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setStatus(`Parsing image ${i + 1} of ${files.length}: ${file.name}...`);
      setProgress({ current: i + 1, total: files.length });

      try {
        const base64 = await toBase64(file);
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType: file.type || 'image/jpeg' }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');
        if (data.records?.length) {
          data.records.forEach(r => r._source = file.name);
          allRecords.push(...data.records);
        }
      } catch (err) {
        console.error(`Error on ${file.name}:`, err.message);
      }
    }

    if (!allRecords.length) {
      setStatus('No records found in any of the images.');
      setIsError(true);
    } else {
      setRecords(allRecords);
      setStatus(`✓ Parsed ${allRecords.length} total record(s) from ${files.length} image(s).`);
    }

    setLoading(false);
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function downloadCSV() {
    if (!records.length) return;
    const headers = ['#', 'Source File', 'Engine No.', 'Make/Type', 'Series', 'Owner', 'Address', 'Plate No.', 'OR No.', 'CR No.'];
    const rows = records.map((r, i) => [
      i + 1, r._source || '', r.engine_no, r.make_type, r.series,
      r.owner, r.address, r.plate_no, r.or_no, r.cr_no,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LTO_MV_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <>
      <Head>
        <title>LTO MV Report Parser</title>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700;900&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        :root {
          --bg: #0a0e14; --surface: #111827; --border: #1f2d3d;
          --accent: #00d4ff; --accent2: #ff6b35; --text: #e2e8f0;
          --muted: #64748b; --green: #00ff88; --red: #ff4444;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: var(--bg); color: var(--text); font-family: 'Barlow', sans-serif; min-height: 100vh; }
        body::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 999;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.015) 2px, rgba(0,212,255,0.015) 4px);
        }
      `}</style>

      <header style={{ borderBottom: '1px solid var(--border)', padding: '20px 40px', display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(0,212,255,0.03)' }}>
        <div style={{ width: 40, height: 40, border: '2px solid var(--accent)', display: 'grid', placeItems: 'center', fontFamily: "'Share Tech Mono'", fontSize: 11, color: 'var(--accent)', letterSpacing: 1 }}>LTO</div>
        <h1 style={{ fontFamily: "'Barlow Condensed'", fontSize: 22, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' }}>
          MV <span style={{ color: 'var(--accent)' }}>Report</span> Parser
        </h1>
        <div style={{ marginLeft: 'auto', fontFamily: "'Share Tech Mono'", fontSize: 10, color: 'var(--accent)', border: '1px solid var(--accent)', padding: '3px 8px', letterSpacing: 2 }}>
          AI-POWERED · SECURE
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

        {/* Drop Zone */}
        <div
          onClick={() => fileInputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          style={{ border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 4, padding: '48px 40px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(0,212,255,0.05)' : 'var(--surface)', marginBottom: 24, transition: 'all 0.2s', position: 'relative' }}
        >
          <div style={{ position: 'absolute', top: 8, left: 8, width: 12, height: 12, borderTop: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' }} />
          <div style={{ position: 'absolute', top: 8, right: 8, width: 12, height: 12, borderTop: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' }} />
          <div style={{ position: 'absolute', bottom: 8, left: 8, width: 12, height: 12, borderBottom: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' }} />
          <div style={{ position: 'absolute', bottom: 8, right: 8, width: 12, height: 12, borderBottom: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' }} />
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h2 style={{ fontFamily: "'Barlow Condensed'", fontSize: 22, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Upload LTO Screenshots</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, fontFamily: "'Share Tech Mono'" }}>
            Drop multiple images here or click to browse · JPG, PNG, WEBP · Multiple files supported
          </p>
        </div>

        {/* File Queue */}
        {files.length > 0 && (
          <div style={{ marginBottom: 24, border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ background: 'rgba(0,212,255,0.06)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 11, color: 'var(--accent)', letterSpacing: 2 }}>QUEUE [{files.length} FILE{files.length > 1 ? 'S' : ''}]</span>
              <button onClick={clearAll} style={{ background: 'none', border: '1px solid var(--muted)', color: 'var(--muted)', padding: '3px 10px', cursor: 'pointer', fontFamily: "'Share Tech Mono'", fontSize: 11 }}>✕ CLEAR ALL</button>
            </div>
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: i < files.length - 1 ? '1px solid rgba(31,45,61,0.5)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 12 }}>{i + 1}. {f.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 11, color: 'var(--muted)' }}>{(f.size / 1024).toFixed(1)} KB</span>
                  <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Parse Button */}
        {files.length > 0 && (
          <button onClick={parseAll} disabled={loading} style={{ display: 'block', width: '100%', padding: 18, background: loading ? 'var(--border)' : 'var(--accent)', color: loading ? 'var(--muted)' : '#000', border: 'none', fontFamily: "'Barlow Condensed'", fontSize: 20, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 24, transition: 'all 0.2s' }}>
            {loading ? `⟳ PARSING ${progress.current}/${progress.total}...` : `⚡ PARSE ${files.length} IMAGE${files.length > 1 ? 'S' : ''}`}
          </button>
        )}

        {/* Progress Bar */}
        {loading && progress.total > 1 && (
          <div style={{ marginBottom: 24, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
          </div>
        )}

        {/* Status */}
        {status && (
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 13, color: isError ? 'var(--red)' : 'var(--accent)', marginBottom: 24, padding: '12px 16px', borderLeft: `3px solid ${isError ? 'var(--red)' : 'var(--accent)'}`, background: isError ? 'rgba(255,68,68,0.05)' : 'rgba(0,212,255,0.05)' }}>
            {'> '}{status}
          </div>
        )}

        {/* Results Table */}
        {records.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Barlow Condensed'", fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
                Parsed Records <span style={{ color: 'var(--accent)', fontFamily: "'Share Tech Mono'", fontSize: 14, marginLeft: 8 }}>[{records.length}]</span>
              </h3>
              <button onClick={downloadCSV} style={{ background: 'var(--green)', color: '#000', border: 'none', padding: '10px 24px', fontFamily: "'Barlow Condensed'", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}>
                ⬇ Download CSV
              </button>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: 'rgba(0,212,255,0.08)' }}>
                  <tr>
                    {['#', 'Source', 'Engine No.', 'Make/Type', 'Series', 'Owner', 'Address', 'Plate No.', 'OR No.', 'CR No.'].map(h => (
                      <th key={h} style={{ fontFamily: "'Share Tech Mono'", fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--accent)', padding: '12px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(31,45,61,0.5)', fontFamily: "'Share Tech Mono'", fontSize: 12, color: 'var(--accent)' }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(31,45,61,0.5)', fontFamily: "'Share Tech Mono'", fontSize: 10, color: 'var(--muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row._source}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(31,45,61,0.5)', fontFamily: "'Share Tech Mono'", fontSize: 12, color: 'var(--accent)' }}>{row.engine_no || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(31,45,61,0.5)' }}>{row.make_type || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(31,45,61,0.5)' }}>{row.series || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(31,45,61,0.5)', fontWeight: 600 }}>{row.owner || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(31,45,61,0.5)', fontSize: 11, color: 'var(--muted)' }}>{row.address || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(31,45,61,0.5)', fontFamily: "'Share Tech Mono'", fontSize: 12, color: 'var(--accent2)', fontWeight: 700 }}>{row.plate_no || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(31,45,61,0.5)', fontFamily: "'Share Tech Mono'", fontSize: 11 }}>{row.or_no || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(31,45,61,0.5)', fontFamily: "'Share Tech Mono'", fontSize: 11 }}>{row.cr_no || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer style={{ textAlign: 'center', padding: 32, fontFamily: "'Share Tech Mono'", fontSize: 11, color: 'var(--muted)', borderTop: '1px solid var(--border)', marginTop: 60 }}>
        LTO MV REPORT PARSER · SECURE · API KEY NEVER LEAVES SERVER
      </footer>
    </>
  );
}
