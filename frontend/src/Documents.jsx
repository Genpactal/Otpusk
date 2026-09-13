import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, FileText, FolderOpen, Search } from 'lucide-react';
import { api } from './api.js';
import './documents.css';

export function Documents({ userId, Modal }) {
  const [documents, setDocuments] = useState([]);
  const [folder, setFolder] = useState('All documents');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api('/documents', userId).then(data => { if (active) setDocuments(data); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; generation.current++; };
  }, [userId, retry]);
  const folders = ['All documents', ...new Set(documents.map(document => document.folder))];
  const visible = documents.filter(document => (folder === 'All documents' || document.folder === folder) && `${document.title} ${document.description} ${document.owner}`.toLowerCase().includes(search.trim().toLowerCase()));
  async function open(document) {
    const current = ++generation.current;
    setPreview({ ...document, loading: true });
    try { const data = await api('/documents/' + document.id, userId); if (current === generation.current) setPreview(data); }
    catch (error) { if (current === generation.current) setPreview({ ...document, error: error.message }); }
  }
  function close() { generation.current++; setPreview(null); }
  return <div className="documents-page">
    <div className="documents-notice"><FolderOpen size={21} /><div><strong>Your shared company library</strong><p>Sample documents for Forma Studio. Browse, read, or download a copy.</p></div><span className="count-pill">Mock data</span></div>
    <section className="panel documents-panel" aria-label="Corporate document library">
      <div className="documents-toolbar"><div className="document-folders" role="group" aria-label="Document folders">{folders.map(name => <button key={name} className={folder === name ? 'selected' : ''} aria-pressed={folder === name} onClick={() => setFolder(name)}>{name}<span>{name === 'All documents' ? documents.length : documents.filter(d => d.folder === name).length}</span></button>)}</div><label className="search-field"><Search size={17} /><input aria-label="Search corporate documents" placeholder="Search documents" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      {loading ? <p className="documents-message" role="status">Loading documents…</p> : error ? <div className="documents-message" role="alert"><p>{error}</p><button className="text-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : visible.length ? <div className="document-grid">{visible.map(document => <article className="document-card" key={document.id}><div className="document-card-top"><span className="document-icon"><FileText size={23} /></span><span>{document.folder}</span></div><h2>{document.title}</h2><p>{document.description}</p><div className="document-meta"><span>{document.owner} · v{document.version}</span><span>Updated 13 Sep 2026 · {document.format}</span></div><div className="document-actions"><button className="button secondary small-button" aria-label={`Read ${document.title}`} onClick={() => open(document)}>Read document</button><a className="icon-button" href={`/api/documents/${document.id}/download`} download aria-label={`Download ${document.title}`}><ArrowDownToLine size={18} /></a></div></article>)}</div> : <div className="empty"><FolderOpen size={29} /><h3>No matching documents</h3><p>Try a different search or folder.</p><button className="text-button" onClick={() => { setSearch(''); setFolder('All documents'); }}>Show all documents</button></div>}
    </section>
    {preview && <Modal title={preview.title} subtitle={`${preview.folder} · Sample document`} close={close}>{preview.loading ? <p role="status">Opening document…</p> : preview.error ? <div role="alert"><p>{preview.error}</p><button className="text-button" onClick={() => open(preview)}>Try again</button></div> : <div className="document-content">{preview.content.split(/\n\s*\n/).map((block, index) => block.startsWith('# ') ? null : block.startsWith('## ') ? <h3 key={index}>{block.slice(3)}</h3> : <p key={index}>{block}</p>)}</div>}<div className="modal-actions"><button className="button secondary" onClick={close}>Close</button><a className="button primary" href={`/api/documents/${preview.id}/download`} download><ArrowDownToLine size={17} />Download file</a></div></Modal>}
  </div>;
}
