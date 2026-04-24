import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bot, Database, Download, RefreshCw, Search, ShieldCheck, Sparkles, TreePine, Users, Home } from 'lucide-react'
import { useEffect, useState } from 'react'
import Dock from '@/components/ui/dock'
import ChromaGrid from '@/components/ChromaGrid'

type SearchHit = {
  score: number
  chunk_id: string
  title: string
  year: number | null
  category: string
  source: string
  document_type: string
  url: string
  text: string
  tags: string[]
}

type QueryResponse = {
  query: string
  answer: string
  total_hits: number
  highlight_terms: string[]
  hits: SearchHit[]
}

const categories = [
  { label: 'All categories', value: '' },
  { label: 'Policy', value: 'policy' },
  { label: 'Species', value: 'species' },
  { label: 'Ecosystems', value: 'ecosystems' },
  { label: 'Legal', value: 'legal' },
]

const sources = [
  { label: 'Any source', value: '' },
  { label: 'India', value: 'India' },
  { label: 'Global', value: 'Global' },
  { label: 'Starter', value: 'Starter' },
]

const heroLines = [
  'Multimodal wildlife intelligence for viva-ready RAG demos.',
  'Policy, species, ecosystem, and legal retrieval in one console.',
]

const exampleQuery = 'What policies protect endangered wildlife habitats in India?'

const exampleQueries = [
  {
    label: 'Latest tiger conservation',
    query: 'What are the latest tiger conservation strategies in India?',
  },
  {
    label: 'Policy evolution',
    query: 'Compare the evolution of Wildlife Protection Act policies in India.',
  },
  {
    label: 'Wetlands and climate',
    query: 'How do wetlands support climate resilience and biodiversity?',
  },
  {
    label: 'Species recovery',
    query: 'Which species recovery programs are currently active in India?',
  },
  {
    label: 'International treaties',
    query: 'What international treaties govern wildlife trade and habitat protection?',
  },
  {
    label: 'Community conservation',
    query: 'How are local communities involved in wildlife conservation programs?',
  },
]

const teamGridItems = [
  {
    image: '/Morya.jpeg',
    title: 'L Moryakantha',
    subtitle: '1RV24AI406',
    description: 'lmoryakantha.ai24@rvce.edu.in',
    borderColor: '#7ef0a8',
    gradient: 'linear-gradient(165deg, #0f3d31, #07110f 72%)',
  },
  {
    image: '/Vineet.jpeg',
    title: 'Vineet Raj',
    subtitle: '1RV23AI132',
    description: 'vineetraj.ai23@rvce.edu.in',
    borderColor: '#ffc857',
    gradient: 'linear-gradient(165deg, #463410, #07110f 72%)',
  },
  {
    image: '/Srihari.jpeg',
    title: 'Srihari S',
    subtitle: '1RV23AI106',
    description: 'sriharis.ai23@rvce.edu.in',
    borderColor: '#6ea7ff',
    gradient: 'linear-gradient(165deg, #12304a, #07110f 72%)',
  },
]

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text: string, terms: string[]): JSX.Element | string {
  const cleanTerms = terms
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)

  if (!cleanTerms.length) {
    return text
  }

  try {
    const regex = new RegExp(`(${cleanTerms.map(escapeRegex).join('|')})`, 'gi')
    const parts = text.split(regex)
    const termSet = new Set(cleanTerms.map((term) => term.toLowerCase()))

    return (
      <>
        {parts.map((part, idx) => {
          const isMatch = termSet.has(part.toLowerCase())
          return isMatch ? (
            <mark key={`${part}-${idx}`} style={{ backgroundColor: '#fbbf24', padding: '0 2px' }}>
              {part}
            </mark>
          ) : (
            <span key={`${part}-${idx}`}>{part}</span>
          )
        })}
      </>
    )
  } catch {
    return text
  }
}

function ResearchConsole({ 
  query, 
  setQuery, 
  category, 
  setCategory, 
  source, 
  setSource, 
  year, 
  setYear, 
  topK, 
  setTopK, 
  loading, 
  reindexing, 
  health, 
  result, 
  error, 
  runQuery, 
  rebuildIndex 
}: {
  query: string
  setQuery: (q: string) => void
  category: string
  setCategory: (c: string) => void
  source: string
  setSource: (s: string) => void
  year: string
  setYear: (y: string) => void
  topK: number
  setTopK: (k: number) => void
  loading: boolean
  reindexing: boolean
  health: { status: string; index_ready: boolean } | null
  result: QueryResponse | null
  error: string
  runQuery: (e: React.FormEvent<HTMLFormElement>) => void
  rebuildIndex: () => void
}) {
  const [selectedExample, setSelectedExample] = useState(exampleQueries[0]?.query ?? '')

  const metrics = [
    { label: 'Status', value: health?.status ?? 'offline' },
    { label: 'Index', value: health?.index_ready ? 'ready' : 'not built' },
    { label: 'Hits', value: result?.total_hits?.toString() ?? '0' },
  ]

  // Sort hits by year (latest first), then by score
  const sortedHits = [...(result?.hits ?? [])].sort((a, b) => {
    if ((a.year ?? 0) !== (b.year ?? 0)) {
      return (b.year ?? 0) - (a.year ?? 0)
    }
    return b.score - a.score
  })

  function downloadSummary() {
    if (!result?.answer) return

    const referenceSection = sortedHits.length
      ? sortedHits
          .map((hit, idx) => {
            const yearText = hit.year ? ` (${hit.year})` : ''
            const scoreText = `${Math.round(hit.score * 100)}%`
            return [
              `${idx + 1}. ${hit.title}${yearText}`,
              `   - Category: ${hit.category}`,
              `   - Source: ${hit.source}`,
              `   - Type: ${hit.document_type}`,
              `   - Relevance: ${scoreText}`,
              `   - URL: ${hit.url || 'N/A'}`,
            ].join('\n')
          })
          .join('\n\n')
      : 'No references available for this query.'

    const fileBody = [
      '# WILDAI Query Report',
      '',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      '## Query',
      result.query,
      '',
      '## Answer Summary',
      result.answer,
      '',
      '## Retrieval Summary',
      `Total Hits: ${result.total_hits}`,
      '',
      '## References',
      referenceSection,
    ].join('\n')

    const blob = new Blob([fileBody], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.href = url
    link.download = `wildai-query-report-${stamp}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="layout">
      <motion.section
        className="hero panel"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            WILDAI GenAI Stack
          </div>
          <h1>Wildlife RAG with a research-console interface.</h1>
          {heroLines.map((line) => (
            <p key={line}>{line}</p>
          ))}

          <div className="hero-actions">
            <button className="primary-button" onClick={rebuildIndex} disabled={reindexing}>
              {reindexing ? 'Rebuilding index...' : 'Rebuild FAISS Index'}
              <RefreshCw size={16} />
            </button>
            <a className="ghost-button" href="#results">
              Inspect retrieval
              <ArrowRight size={16} />
            </a>
          </div>

          <div className="metric-row">
            {metrics.map((metric) => (
              <div className="metric-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-side panel-inset">
          <div className="console-card">
            <div className="console-header">
              <Bot size={18} />
              Retrieval agent
            </div>
            <ul>
              <li>Query parsing with category and source filters</li>
              <li>SentenceTransformer embeddings + FAISS search</li>
              <li>FastAPI backend for viva-friendly demos</li>
            </ul>
          </div>
          <div className="badge-row">
            <span><Database size={14} /> FAISS</span>
            <span><ShieldCheck size={14} /> FastAPI</span>
            <span><TreePine size={14} /> React UI</span>
          </div>
        </div>
      </motion.section>

      <section className="panel query-panel">
        <div className="section-heading">
          <h2>Ask the corpus</h2>
          <p>Search the 2GB+ wildlife dataset with 364 authoritative documents (1960-2026).</p>
        </div>

        <div className="query-layout">
          <form className="query-form query-form-main" onSubmit={runQuery}>
            <label>
              Query
              <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
            </label>

            <div className="control-grid">
              <label>
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((option) => (
                    <option key={option.value || option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Source
                <select value={source} onChange={(event) => setSource(event.target.value)}>
                  {sources.map((option) => (
                    <option key={option.value || option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Year
                <input
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  placeholder="Any"
                  inputMode="numeric"
                />
              </label>

              <label>
                Top K
                <input
                  value={topK}
                  onChange={(event) => setTopK(Number(event.target.value))}
                  type="range"
                  min="1"
                  max="8"
                />
              </label>
            </div>

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Retrieving...' : 'Run RAG Search'}
                <Search size={16} />
              </button>
              <button className="secondary-button" type="button" onClick={() => setQuery(exampleQuery)}>
                Load example
              </button>
            </div>
          </form>

          <aside className="example-panel panel-inset">
            <div className="section-heading">
              <h3>Top example queries</h3>
              <p>Use these to explore different parts of the corpus.</p>
            </div>
            <div className="example-picker">
              <label>
                Example Query
                <select
                  className="example-select"
                  value={selectedExample}
                  onChange={(event) => setSelectedExample(event.target.value)}
                >
                  {exampleQueries.map((item) => (
                    <option key={item.label} value={item.query}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondary-button" type="button" onClick={() => setQuery(selectedExample)}>
                Apply Selected Query
              </button>
              <p className="example-preview">{selectedExample}</p>
            </div>
          </aside>
        </div>

        {error ? <div className="alert">{error}</div> : null}
      </section>

      <AnimatePresence mode="wait">
        <motion.section
          key={result?.query ?? 'empty-results'}
          id="results"
          className="results-grid"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.4 }}
        >
          <div className="panel answer-panel">
            <div className="answer-header">
              <div className="section-heading">
                <h2>Answer synthesis</h2>
                <p>Concise explanation generated from the highest-scoring retrieved chunks.</p>
              </div>
              <button
                className="secondary-button answer-download"
                type="button"
                onClick={downloadSummary}
                disabled={!result?.answer}
              >
                Download Summary
                <Download size={16} />
              </button>
            </div>
            <div className="answer-text">
              {(result?.answer ?? 'Run a query to see the retrieval answer and source grounding here.')
                .split('\n')
                .map((line, idx) => (
                  <p key={`${line}-${idx}`}>{line || ' '}</p>
                ))}
            </div>
          </div>

          <div className="panel source-panel">
            <div className="section-heading">
              <h2>Retrieved sources (latest policies first)</h2>
              <p>Top chunks from FAISS, sorted by policy year (newest) and relevance score.</p>
            </div>

            <div className="result-list">
              {sortedHits.map((hit, index) => (
                <motion.article
                  key={hit.chunk_id}
                  className="result-card"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <div className="result-topline">
                    <div className="result-meta-left">
                      <span className="category-badge">{hit.category}</span>
                      {hit.year && <span className="year-badge" title="Policy Year">📅 {hit.year}</span>}
                    </div>
                    <strong className="score-badge">{Math.round(hit.score * 100)}%</strong>
                  </div>
                  <h3>{hit.title}</h3>
                  <p className="result-text">{highlightText(hit.text, result?.highlight_terms ?? [])}</p>
                  <div className="result-meta-info">
                    <span className="source-meta">📄 {hit.source}</span>
                    <span className="type-meta">📋 {hit.document_type}</span>
                    {hit.url && <span className="url-meta">🔗 External</span>}
                  </div>
                  <div className="tag-row">
                    {hit.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                    {hit.tags.length > 4 && <span className="tag tag-more">+{hit.tags.length - 4}</span>}
                  </div>
                </motion.article>
              ))}
              {!result?.hits?.length ? <div className="empty-state">No hits yet. Run a search to populate this panel.</div> : null}
            </div>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  )
}

function TeamPage() {
  return (
    <motion.div
      className="layout"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <section className="hero panel">
        <div className="hero-copy">
          <h1>Meet the Team</h1>
          <p>Dedicated professionals working on wildlife conservation through AI and RAG technology.</p>
        </div>
      </section>

      <section className="panel team-chroma-panel">

        <div className="team-chroma-shell">
          <ChromaGrid items={teamGridItems} radius={260} columns={3} rows={1} damping={0.45} fadeOut={0.6} />
        </div>
      </section>

      <section className="panel stats-panel">
        <div className="section-heading">
          <h2>Project Statistics</h2>
          <p>Key metrics about the WILDAI corpus and system.</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <strong>364</strong>
            <span>Documents</span>
          </div>
          <div className="stat-card">
            <strong>2.089 GB</strong>
            <span>Corpus Size</span>
          </div>
          <div className="stat-card">
            <strong>206,529</strong>
            <span>Indexed Chunks</span>
          </div>
          <div className="stat-card">
            <strong>34</strong>
            <span>Categories</span>
          </div>
          <div className="stat-card">
            <strong>1960-2026</strong>
            <span>Year Coverage</span>
          </div>
          <div className="stat-card">
            <strong>21</strong>
            <span>Data Sources</span>
          </div>
        </div>
      </section>
    </motion.div>
  )
}

function App() {
  const [currentPage, setCurrentPage] = useState('research')
  const [query, setQuery] = useState(exampleQuery)
  const [category, setCategory] = useState('')
  const [source, setSource] = useState('')
  const [year, setYear] = useState('')
  const [topK, setTopK] = useState(4)
  const [loading, setLoading] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [health, setHealth] = useState<{ status: string; index_ready: boolean } | null>(null)
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [error, setError] = useState('')

  const dockItems = [
    {
      icon: <Home size={18} />,
      label: 'Research',
      active: currentPage === 'research',
      onClick: () => setCurrentPage('research'),
    },
    {
      icon: <Users size={18} />,
      label: 'Team',
      active: currentPage === 'team',
      onClick: () => setCurrentPage('team'),
    },
    {
      icon: <RefreshCw size={18} />,
      label: reindexing ? 'Rebuilding' : 'Rebuild',
      onClick: rebuildIndex,
      disabled: reindexing,
    },
    {
      icon: <Sparkles size={18} />,
      label: 'Example',
      onClick: () => {
        setCurrentPage('research')
        setQuery(exampleQuery)
      },
    },
  ]

  useEffect(() => {
    void loadHealth()
  }, [])

  async function loadHealth() {
    try {
      const response = await fetch('/api/health')
      const payload = await response.json()
      setHealth(payload)
    } catch {
      setHealth(null)
    }
  }

  async function runQuery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          top_k: topK,
          category: category || null,
          source: source || null,
          year: year ? Number(year) : null,
        }),
      })

      if (!response.ok) {
        throw new Error('Query failed')
      }

      const payload = (await response.json()) as QueryResponse
      setResult(payload)
    } catch {
      setError('Backend query failed. Start the FastAPI server and rebuild the index if needed.')
    } finally {
      setLoading(false)
    }
  }

  async function rebuildIndex() {
    setReindexing(true)
    setError('')
    try {
      const response = await fetch('/api/index/rebuild', { method: 'POST' })
      if (!response.ok) {
        throw new Error('Reindex failed')
      }
      await loadHealth()
    } catch {
      setError('Index rebuild failed. Check the backend logs and available Python packages.')
    } finally {
      setReindexing(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="grid-overlay" />
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <div className="orb orb-three" />

      <header className="navbar-shell">
        <div className="navbar-brand">
          <TreePine size={24} />
          <div>
            <span>WILDAI</span>
            <small>Research Console</small>
          </div>
        </div>

        <Dock items={dockItems} panelHeight={68} baseItemSize={50} magnification={70} />

        <div className="navbar-status" data-ready={Boolean(health?.index_ready)}>
          <span className="status-dot" />
          <div>
            <strong>{health?.status ?? 'offline'}</strong>
            <small>{health?.index_ready ? 'Index ready' : 'Index warming up'}</small>
          </div>
        </div>
      </header>

      <main className="layout-wrapper">
        <AnimatePresence mode="wait">
          {currentPage === 'research' ? (
            <ResearchConsole
              key="research"
              query={query}
              setQuery={setQuery}
              category={category}
              setCategory={setCategory}
              source={source}
              setSource={setSource}
              year={year}
              setYear={setYear}
              topK={topK}
              setTopK={setTopK}
              loading={loading}
              reindexing={reindexing}
              health={health}
              result={result}
              error={error}
              runQuery={runQuery}
              rebuildIndex={rebuildIndex}
            />
          ) : (
            <TeamPage key="team" />
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default App
