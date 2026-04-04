import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bot, Database, RefreshCw, Search, ShieldCheck, Sparkles, TreePine, Users, Home } from 'lucide-react'
import { useEffect, useState } from 'react'

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
  hits: SearchHit[]
}

type TeamMember = {
  name: string
  role: string
  bio: string
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

const teamMembers: TeamMember[] = [
  {
    name: 'Team Member 1',
    role: 'Lead Researcher',
    bio: 'Specialized in wildlife conservation policies and ecosystem management.',
  },
  {
    name: 'Team Member 2',
    role: 'ML Engineer',
    bio: 'Expert in RAG systems, embeddings, and semantic search architectures.',
  },
  {
    name: 'Team Member 3',
    role: 'Data Specialist',
    bio: 'Focused on data curation, quality assurance, and corpus management.',
  },
]

function highlightQuery(text: string, query: string): JSX.Element | string {
  if (!query || query.length < 2) return text
  try {
    const regex = new RegExp(`(${query.split(/\s+/).join('|')})`, 'gi')
    const parts = text.split(regex)
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} style={{ backgroundColor: '#fbbf24', padding: '0 2px' }}>
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
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
            <div className="example-list">
              {exampleQueries.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="example-chip"
                  onClick={() => setQuery(item.query)}
                >
                  <span>{item.label}</span>
                  <small>{item.query}</small>
                </button>
              ))}
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
            <div className="section-heading">
              <h2>Answer synthesis</h2>
              <p>Concise explanation generated from the highest-scoring retrieved chunks.</p>
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
                  <p className="result-text">{highlightQuery(hit.text, query)}</p>
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
          <div className="eyebrow">
            <Users size={16} />
            WILDAI Project
          </div>
          <h1>Meet the Team</h1>
          <p>Dedicated professionals working on wildlife conservation through AI and RAG technology.</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Our Team</h2>
          <p>Combining expertise in conservation, machine learning, and data science.</p>
        </div>

        <div className="team-grid">
          {teamMembers.map((member, index) => (
            <motion.article
              key={member.name}
              className="team-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="team-avatar">
                <div className="avatar-placeholder">{member.name.charAt(0)}</div>
              </div>
              <div className="team-content">
                <h3>{member.name}</h3>
                <p className="team-role">{member.role}</p>
                <p className="team-bio">{member.bio}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="panel">
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

      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <TreePine size={24} />
            <span>WILDAI</span>
          </div>
          <div className="navbar-links">
            <button
              className={`nav-link ${currentPage === 'research' ? 'active' : ''}`}
              onClick={() => setCurrentPage('research')}
            >
              <Home size={18} />
              Research Console
            </button>
            <button
              className={`nav-link ${currentPage === 'team' ? 'active' : ''}`}
              onClick={() => setCurrentPage('team')}
            >
              <Users size={18} />
              Team
            </button>
          </div>
        </div>
      </nav>

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
