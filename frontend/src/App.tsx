import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bot, Database, Download, Search, ShieldCheck, Sparkles, TreePine, Users, Home, MessageSquare } from 'lucide-react'
import cloud from 'd3-cloud'
import { useEffect, useState } from 'react'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/animations/scale.css'
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
  extra?: {
    source_path?: string
    record_index?: number
  }
}

type QueryResponse = {
  query: string
  answer: string
  total_hits: number
  highlight_terms: string[]
  hits: SearchHit[]
}

type DocumentPreview = SearchHit & { rank?: number }

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

async function generateDetailedReport(
  query: string,
  hits: SearchHit[],
): Promise<string> {
  const top3 = hits.slice(0, 3)
 
  const sourcesBlock = top3
    .map(
      (h, i) => `
SOURCE [${i + 1}]
Title   : ${h.title}
Year    : ${h.year ?? 'N/A'}
Category: ${h.category}
Source  : ${h.source}
Type    : ${h.document_type}
Tags    : ${h.tags.slice(0, 6).join(', ')}
Text    :
${h.text.slice(0, 1200)}`.trim(),
    )
    .join('\n\n---\n\n')
 
  const systemPrompt = `
You are a wildlife-policy research analyst writing a formal report section.
Write a detailed, well-structured answer to the user's query.
 
Rules:
- Cite sources inline as [1], [2], [3] whenever you draw on them.
- Every factual claim must be traceable to at least one source.
- Structure with ### headings: Overview, Key Findings, Policy Implications, Conclusion.
- Use clear, formal prose — no bullet spam.
- Length: 350-500 words.
- End with a one-sentence "Confidence note" describing retrieval quality.
`.trim()
 
  const userPrompt = `
Query: ${query}
 
Retrieved sources:
${sourcesBlock}
 
Write the detailed cited report now.
`.trim()
 
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
 
  if (!response.ok) throw new Error('Claude API call failed')
  const data = await response.json()
  return (data.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
}
 
// ─── helper: format a single hit as Markdown ─────────────────────────────────
 
function hitToMarkdown(hit: SearchHit, index: number): string {
  const yearLine = hit.year ? `**Year:** ${hit.year}` : ''
  const urlLine = hit.url ? `**URL:** ${hit.url}` : ''
  const tags = hit.tags.slice(0, 6).join(' · ')
 
  return [
    `### [${index}] ${hit.title}`,
    '',
    `| Field       | Value |`,
    `|-------------|-------|`,
    `| **Category**  | ${hit.category} |`,
    yearLine ? `| **Year**      | ${hit.year} |` : '',
    `| **Source**    | ${hit.source} |`,
    `| **Type**      | ${hit.document_type} |`,
    `| **Relevance** | ${Math.round(hit.score * 100)}% |`,
    urlLine ? `| **URL**       | ${hit.url} |` : '',
  ]
    .filter(Boolean)
    .concat([
      '',
      tags ? `*Tags: ${tags}*` : '',
      '',
      '**Excerpt:**',
      '',
      `> ${hit.text.slice(0, 600).replace(/\n/g, '\n> ')}${hit.text.length > 600 ? '…' : ''}`,
    ])
    .filter((l) => l !== undefined)
    .join('\n')
}

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getAnswerSections(answer: string): Array<{ title: string; body: string[] }> {
  const lines = answer.split(/\r?\n/)
  const sections: Array<{ title: string; body: string[] }> = []
  let currentSection: { title: string; body: string[] } | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      if (currentSection && currentSection.body.length && currentSection.body[currentSection.body.length - 1] !== '') {
        currentSection.body.push('')
      }
      continue
    }

    const headingMatch = line.match(/^#{1,3}\s+(.+)$/)
    if (headingMatch) {
      currentSection = { title: headingMatch[1], body: [] }
      sections.push(currentSection)
      continue
    }

    if (!currentSection) {
      currentSection = { title: 'Summary', body: [] }
      sections.push(currentSection)
    }

    currentSection.body.push(rawLine)
  }

  return sections.length ? sections : [{ title: 'Summary', body: lines.filter(Boolean) }]
}

function renderInlineMarkdown(text: string): JSX.Element {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return (
    <>
      {parts.map((part, index) => {
        const boldMatch = part.match(/^\*\*(.+)\*\*$/)
        if (boldMatch) {
          return <strong key={`${part}-${index}`}>{boldMatch[1]}</strong>
        }
        return <span key={`${part}-${index}`}>{part}</span>
      })}
    </>
  )
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
  rebuildIndex,
  onViewDocument,
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
  onViewDocument: (hit: DocumentPreview) => void
}) {
  const [selectedExample, setSelectedExample] = useState(exampleQueries[0]?.query ?? '')
  const [exporting, setExporting] = useState(false)

  const metrics = [
    { label: 'Status', value: health?.status ?? 'offline' },
    { label: 'Index', value: health?.index_ready ? 'ready' : 'not built' },
    { label: 'Hits', value: result?.total_hits?.toString() ?? '0' },
  ]

  const answerSections = result?.answer ? getAnswerSections(result.answer) : []
  const answerSummary = result?.answer
    ? result.answer.split(/\r?\n/).find((line) => line.trim().length > 0) ?? 'Run a query to see the retrieval answer and source grounding here.'
    : 'Run a query to see the retrieval answer and source grounding here.'

  // Sort hits by year (latest first), then by score
  const sortedHits = [...(result?.hits ?? [])].sort((a, b) => {
    if ((a.year ?? 0) !== (b.year ?? 0)) {
      return (b.year ?? 0) - (a.year ?? 0)
    }
    return b.score - a.score
  })

  async function downloadSummary() {
    if (!result?.answer) return
    setExporting(true)

    // ── Step 1: generate a detailed, cited report via Claude ─────────────────
    const top3 = sortedHits.slice(0, 3)
    let detailedReport = ''

    try {
      const systemPrompt = `
  You are a wildlife-policy research analyst writing a formal report section.
  Write a detailed, well-structured answer to the user's query.
  Rules:
  - Cite sources inline as [1], [2], [3] whenever you draw on them.
  - Every factual claim must be traceable to at least one source.
  - Structure with ### headings: Overview, Key Findings, Policy Implications, Conclusion.
  - Use clear, formal prose — no bullet spam.
  - Length: 350-500 words.
  - End with a one-sentence "Confidence note" describing retrieval quality.`.trim()

      const sourcesBlock = top3
        .map((h, i) => `SOURCE [${i + 1}]\nTitle: ${h.title}\nYear: ${h.year ?? 'N/A'}\nCategory: ${h.category}\nSource: ${h.source}\nType: ${h.document_type}\nTags: ${h.tags.slice(0, 6).join(', ')}\nText:\n${h.text.slice(0, 1200)}`)
        .join('\n\n---\n\n')

      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Query: ${result.query}\n\nRetrieved sources:\n${sourcesBlock}\n\nWrite the detailed cited report now.` }],
        }),
      })
      if (apiRes.ok) {
        const data = await apiRes.json()
        detailedReport = (data.content as Array<{ type: string; text?: string }>)
          .filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
      }
    } catch {
      detailedReport = '_Detailed synthesis unavailable._\n\n' + result.answer
    }

    // ── Step 2: build top-3 sources section ──────────────────────────────────
    function hitToMd(hit: SearchHit, idx: number): string {
      return [
        `### [${idx}] ${hit.title}`,
        '',
        `| Field | Value |`,
        `|-------|-------|`,
        `| **Category** | ${hit.category} |`,
        hit.year ? `| **Year** | ${hit.year} |` : '',
        `| **Source** | ${hit.source} |`,
        `| **Type** | ${hit.document_type} |`,
        `| **Relevance** | ${Math.round(hit.score * 100)}% |`,
        hit.url ? `| **URL** | ${hit.url} |` : '',
        '',
        hit.tags.length ? `*Tags: ${hit.tags.slice(0, 6).join(' · ')}*` : '',
        '',
        '**Excerpt:**',
        '',
        `> ${hit.text.slice(0, 600).replace(/\n/g, '\n> ')}${hit.text.length > 600 ? '…' : ''}`,
      ].filter(Boolean).join('\n')
    }

    const top3Section = top3.map((h, i) => hitToMd(h, i + 1)).join('\n\n---\n\n')

    const referenceList = sortedHits
      .map((hit, idx) =>
        `${idx + 1}. **${hit.title}**${hit.year ? ` (${hit.year})` : ''} — ` +
        `${hit.source} · ${hit.category} · ${Math.round(hit.score * 100)}% relevance` +
        (hit.url ? ` · [link](${hit.url})` : '')
      ).join('\n')

    const stamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    const isoStamp = new Date().toISOString().replace(/[:.]/g, '-')
    const remainingCount = sortedHits.length - 3

    const fileBody = [
      '# WILDAI Research Report',
      '',
      `> Generated by WILDAI Research Console · ${stamp}`,
      '',
      '---',
      '',
      '## Query',
      '',
      `> ${result.query}`,
      '',
      '---',
      '',
      '## Detailed Analysis',
      '',
      detailedReport,
      '',
      '---',
      '',
      '## Top 3 Retrieved Sources',
      '',
      top3Section,
      '',
      remainingCount > 0 ? `*… and ${remainingCount} additional source(s) in the reference list below.*\n` : '',
      '---',
      '',
      '## Full Reference List',
      '',
      referenceList,
      '',
      '---',
      '',
      '## Retrieval Metadata',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| Total hits | ${result.total_hits} |`,
      `| Returned | ${sortedHits.length} |`,
      `| Highlight terms | ${result.highlight_terms.join(', ') || 'N/A'} |`,
      '',
      '---',
      '',
      '*Report produced by WILDAI · Wildlife Intelligence RAG System*',
    ].join('\n')

    const blob = new Blob([fileBody], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `wildai-report-${isoStamp}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  // Wordcloud JSON state for interactive wordcloud
  const [wordcloudWords, setWordcloudWords] = useState<Array<{ text: string; value: number }>>([])
  const [includeWordcloud, setIncludeWordcloud] = useState(true)

  useEffect(() => {
    async function loadWordcloudJSON() {
      if (!result) return
      try {
        const res = await fetch(`/api/analytics/wordcloud?top_n=120`)
        if (!res.ok) return
        const payload = await res.json()
        // payload.words = [{term, count}]
        const words = (payload.words || []).map((w: any) => ({ text: w.term, value: w.count }))
        setWordcloudWords(words)
      } catch (err) {
        // ignore
      }
    }
    void loadWordcloudJSON()
  }, [result])

  async function exportServer(fmt: string) {
    if (!result) return
    setExporting(true)

    // Generate detailed report to embed in server-side export
    let detailedReport = result.answer
    try {
      const top3 = sortedHits.slice(0, 3)
      const systemPrompt = `You are a wildlife-policy analyst. Write a 350-500 word formal report with ### headings (Overview, Key Findings, Policy Implications, Conclusion). Cite sources inline as [1] [2] [3]. End with a one-line Confidence note.`
      const sourcesBlock = top3
        .map((h, i) => `SOURCE [${i + 1}]\nTitle: ${h.title}\nYear: ${h.year ?? 'N/A'}\nText:\n${h.text.slice(0, 1000)}`)
        .join('\n\n---\n\n')
      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Query: ${result.query}\n\n${sourcesBlock}\n\nWrite the report now.` }],
        }),
      })
      if (apiRes.ok) {
        const data = await apiRes.json()
        detailedReport = (data.content as Array<{ type: string; text?: string }>)
          .filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
      }
    } catch { /* keep original answer */ }

    try {
      const payload = {
        query: result.query,
        top_k: topK,
        category: category || null,
        source: source || null,
        year: year ? Number(year) : null,
        include_wordcloud: includeWordcloud,
        // ↓ enriched fields your backend renderer can use directly
        detailed_report: detailedReport,
        top3_sources: sortedHits.slice(0, 3).map((h) => ({
          title: h.title,
          year: h.year,
          category: h.category,
          source: h.source,
          document_type: h.document_type,
          url: h.url,
          score: h.score,
          tags: h.tags.slice(0, 6),
          excerpt: h.text.slice(0, 800),
        })),
        total_hits: result.total_hits,
        highlight_terms: result.highlight_terms,
        all_hits: sortedHits.map((h) => ({
          title: h.title, year: h.year, category: h.category,
          source: h.source, document_type: h.document_type,
          url: h.url, score: h.score, tags: h.tags,
        })),
      }

      const res = await fetch(`/api/export?fmt=${fmt}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Export failed')
      // payload["detailed_report"]
      // payload["top3_sources"]
      // payload["all_hits"]
      // payload["total_hits"]
      // payload["highlight_terms"]
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wildai-report.${fmt}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert(`Export as ${fmt.toUpperCase()} failed.`)
    } finally {
      setExporting(false)
    }
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

              <div className="console-detail-card">
                <h4>Methodology</h4>
                <ul>
                  <li>Clean and chunk source documents into retrieval-ready passages.</li>
                  <li>Encode each chunk with Ollama Nomic Embed Text embeddings</li>
                  <li>Index vectors in FAISS for fast similarity search and deterministic ranking.</li>
                  <li>Apply category, source, and year filters before producing the final answer.</li>
                </ul>
              </div>

              <div className="console-detail-card">
                <h4>Tech stack</h4>
                <ul>
                  <li>Frontend: React, Vite, TypeScript, Framer Motion, Lucide, D3 cloud.</li>
                  <li>Backend: FastAPI, FAISS, NumPy, scikit-learn, Ollama</li>
                  <li>Local AI: Ollama with <strong>nomic-embed-text</strong> for embeddings and local chat.</li>
                  <li>Storage: JSON corpus files plus generated FAISS and chunk metadata artifacts.</li>
                </ul>
              </div>
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
              <div className="answer-actions">
                <button
                  className="secondary-button answer-download"
                  type="button"
                  onClick={downloadSummary}
                  disabled={!result?.answer}
                >
                  Download Summary
                  <Download size={14} />
                </button>
                <button className="ghost-button" onClick={() => exportServer('md')} disabled={!result?.answer || exporting}>
                  Export MD
                </button>
                <button className="ghost-button" onClick={() => exportServer('pdf')} disabled={!result?.answer || exporting}>
                  Export PDF
                </button>
                <button className="ghost-button" onClick={() => exportServer('docx')} disabled={!result?.answer || exporting}>
                  Export DOCX
                </button>
                <button className="ghost-button" onClick={() => {
                  // download standalone wordcloud PNG
                  (async () => {
                    try {
                      const r = await fetch('/api/analytics/wordcloud_image?top_n=160')
                      if (!r.ok) throw new Error('failed')
                      const b = await r.blob()
                      const url = URL.createObjectURL(b)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `wildai-wordcloud.png`
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                    } catch (err) {
                      alert('Failed to download wordcloud')
                    }
                  })()
                }} disabled={!result?.answer || exporting}>
                  Download Wordcloud
                </button>
              </div>
            </div>
            <div className="answer-text">
              {result?.answer ? (
                <div className="answer-sections">
                  <div className="answer-summary-box">
                    <span className="answer-summary-label">Key takeaway</span>
                    <p>{renderInlineMarkdown(answerSummary)}</p>
                  </div>

                  {answerSections.map((section) => (
                    <section key={section.title} className="answer-section-block">
                      <h3>{section.title}</h3>
                      <div className="answer-section-body">
                        {section.body.map((line, idx) => {
                          const trimmed = line.trim()
                          if (!trimmed) {
                            return <div key={`${section.title}-spacer-${idx}`} className="answer-spacer" />
                          }

                          if (/^[*-]\s+/.test(trimmed)) {
                            return (
                              <div key={`${section.title}-bullet-${idx}`} className="answer-bullet">
                                <span className="answer-bullet-mark">•</span>
                                <span>{renderInlineMarkdown(trimmed.replace(/^[*-]\s+/, ''))}</span>
                              </div>
                            )
                          }

                          return <p key={`${section.title}-line-${idx}`}>{renderInlineMarkdown(trimmed)}</p>
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <p>Run a query to see the retrieval answer and source grounding here.</p>
              )}
            </div>

            {result ? (
              <div className="wordcloud-panel">
                <h4>Word cloud</h4>
                <div className="wordcloud-shell">
                  <img
                    src={`/api/analytics/wordcloud_image?top_n=120&q=${encodeURIComponent(result.query)}`}
                    className="wordcloud-image"
                    alt="Word Cloud"
                  />
                </div>
              </div>
            ) : null}
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
                  <div className="result-actions">
                    <button className="secondary-button" type="button" onClick={() => onViewDocument({ ...hit, rank: index + 1 })}>
                      View document
                    </button>
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

function WordCloud({ words }: { words: Array<{ text: string; value: number }> }) {
  const [layoutWords, setLayoutWords] = useState<Array<{ text: string; value: number; size: number; x: number; y: number; rotate: number }>>([])

  useEffect(() => {
    if (!words.length) {
      setLayoutWords([])
      return
    }

    const width = 980
    const height = 340
    const maxValue = Math.max(...words.map((word) => word.value))
    const layout = cloud()
      .size([width, height])
      .words(
        words.slice(0, 70).map((word) => ({
          text: word.text,
          value: word.value,
          size: 16 + Math.round((word.value / maxValue) * 46),
        })),
      )
      .padding(5)
      .rotate(() => (Math.random() > 0.82 ? 90 : 0))
      .font('Inter')
      .fontSize((d: any) => d.size)
      .spiral('archimedean')
      .on('end', (placedWords: Array<{ text: string; value: number; size: number; x: number; y: number; rotate: number }>) => {
        setLayoutWords(placedWords)
      })

    layout.start()

    return () => {
      layout.stop()
    }
  }, [words])

  if (!words || words.length === 0) return <div className="wordcloud-empty">No terms available</div>
  if (!layoutWords.length) return <div className="wordcloud-empty">Building word cloud...</div>

  return (
    <div className="wordcloud-shell">
      <svg className="wordcloud-svg" viewBox="0 0 980 340" role="img" aria-label="Word cloud">
        {layoutWords.map((word) => {
          const palette = ['#7ef0a8', '#ffc857', '#5ec8ff', '#ff8b7b', '#91a7ff', '#f48fb1']
          const color = palette[word.text.length % palette.length]
          return (
            <text
              key={word.text}
              className="wordcloud-term"
              textAnchor="middle"
              transform={`translate(${490 + word.x}, ${170 + word.y}) rotate(${word.rotate})`}
              style={{
                fontSize: `${word.size}px`,
                fill: color,
              }}
            >
              {word.text}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function AnalyticsPage({ result }: { result: QueryResponse | null }) {
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number> | null>(null)
  const [timeSeries, setTimeSeries] = useState<Array<[number, number]>>([])
  const [wordcloudWords, setWordcloudWords] = useState<Array<{ text: string; value: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res1 = await fetch('/api/analytics/category_counts')
        const p1 = await res1.json()
        setCategoryCounts(p1.category_counts || null)

        const res2 = await fetch('/api/analytics/time_series')
        const p2 = await res2.json()
        setTimeSeries(p2.time_series || [])

        const res3 = await fetch('/api/analytics/wordcloud?top_n=90')
        const p3 = await res3.json()
        setWordcloudWords((p3.words || []).map((w: any) => ({ text: w.term, value: w.count })))
      } catch (err) {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <motion.div className="layout analytics-layout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <section className="hero panel analytics-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Database size={16} />
            Corpus analytics
          </div>
          <h1>Corpus signals, styled like the rest of the console.</h1>
          <p>Category mix, year coverage, and the strongest terms in one coherent analytics surface.</p>

          <div className="metric-row">
            <div className="metric-card">
              <span>Categories</span>
              <strong>{categoryCounts ? Object.keys(categoryCounts).length : '—'}</strong>
            </div>
            <div className="metric-card">
              <span>Years</span>
              <strong>{timeSeries.length || '—'}</strong>
            </div>
            <div className="metric-card">
              <span>Word cloud</span>
              <strong>{wordcloudWords.length || '—'}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side panel-inset">
          <div className="console-card">
            <div className="console-header">
              <ShieldCheck size={18} />
              Analytics snapshot
            </div>
            <ul>
              <li>Category counts grouped from indexed chunks</li>
              <li>Time series from the search corpus</li>
              <li>Interactive word cloud using the same palette as Research</li>
            </ul>
          </div>
          <div className="badge-row">
            <span><Database size={14} /> Corpus</span>
            <span><Sparkles size={14} /> Terms</span>
            <span><TreePine size={14} /> Trends</span>
          </div>
        </div>
      </section>

      <section className="panel analytics-grid-panel">
        <div className="section-heading">
          <h2>Analytics panels</h2>
          <p>Matching visual treatment for charts, term clouds, and counts.</p>
        </div>

        <div className="analytics-grid">
          <div className="analytics-card panel-inset">
            <div className="section-heading compact-heading">
              <h3>Category counts</h3>
              <p>Document chunks per major corpus category.</p>
            </div>
            {categoryCounts ? (
              <div className="analytics-list">
                {Object.entries(categoryCounts).map(([k, v]) => (
                  <div key={k} className="analytics-list-row">
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">{loading ? 'Loading category counts...' : 'No category counts available.'}</div>
            )}
          </div>

          <div className="analytics-right-col">
            <div className="analytics-card panel-inset analytics-chart-card">
              <div className="section-heading compact-heading">
                <h3>Yearly documents</h3>
                <p>Counts plotted as a compact bar chart.</p>
              </div>
              {timeSeries.length ? (
                <div className="bar-chart" aria-label="Yearly document counts">
                  {timeSeries.map(([year, count]) => {
                    const maxCount = Math.max(...timeSeries.map((s) => s[1])) || 1
                    const height = Math.max(8, (count / maxCount) * 100)
                    return (
                      <div key={year} className="bar-chart-item">
                        <div className="bar-chart-column">
                          <span className="bar-chart-value">{count}</span>
                          <div className="bar-chart-bar-wrap">
                            <div className="bar-chart-bar" style={{ height: `${height}%` }} />
                          </div>
                        </div>
                        <span className="bar-chart-year">{year}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state">{loading ? 'Loading time series...' : 'No yearly data available.'}</div>
              )}
            </div>

            <div className="analytics-card panel-inset analytics-wordcloud-card">
              <div className="section-heading compact-heading">
                <h3>Word cloud</h3>
                <p>Top terms from the active search query.</p>
              </div>
              {result ? (
                <div className="analytics-wordcloud-shell">
                  <img
                    src={`/api/analytics/wordcloud_image?top_n=120&q=${encodeURIComponent(result.query)}`}
                    className="wordcloud-image"
                    alt="Word Cloud"
                  />
                </div>
              ) : (
                <div className="empty-state">No search results yet. Run a query in the Research tab to view the word cloud.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  )
}

function DocumentModalViewer({
  doc,
  onClose,
}: {
  doc: DocumentPreview
  onClose: () => void
}) {
  const [fullText, setFullText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!doc.extra?.source_path) {
      setFullText(doc.text) // Fallback to chunk text
      return
    }

    setLoading(true)
    setError(null)
    const sourcePath = doc.extra.source_path
    const recordIndex = doc.extra.record_index ?? 0

    fetch(`/api/document/full_text?source_path=${encodeURIComponent(sourcePath)}&record_index=${recordIndex}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to retrieve original document content')
        }
        return res.json()
      })
      .then((data) => {
        setFullText(data.full_text || doc.text)
      })
      .catch((err) => {
        console.error(err)
        setError(err.message)
        setFullText(doc.text) // Fallback to RAG chunk
      })
      .finally(() => {
        setLoading(false)
      })
  }, [doc])

  const renderContent = () => {
    if (loading) {
      return (
        <div className="document-viewer-loading">
          <span>Loading original document...</span>
          <div className="dots-container">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>
      )
    }

    if (!fullText) return null

    // Let's highlight the snippet
    const chunkText = doc.text
    const index = fullText.indexOf(chunkText)
    if (index === -1) {
      return <span>{fullText}</span>
    }

    const before = fullText.slice(0, index)
    const match = fullText.slice(index, index + chunkText.length)
    const after = fullText.slice(index + chunkText.length)

    return (
      <>
        {before}
        <mark className="search-highlight">{match}</mark>
        {after}
      </>
    )
  }

  return (
    <div className="document-modal-overlay" onClick={onClose}>
      <div className="document-modal panel" onClick={(e) => e.stopPropagation()}>
        <div className="document-viewer-header">
          <div>
            <div className="eyebrow">
              <Search size={16} />
              Document viewer
            </div>
            <h3>{doc.title}</h3>
            <p>
              {doc.rank ? `Rank ${doc.rank} · ` : ''} {doc.source} · {doc.category}
              {doc.year ? ` · ${doc.year}` : ''}
            </p>
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="document-viewer-meta">
          <span>
            <strong>Type:</strong> {doc.document_type}
          </span>
          {doc.url ? (
            <a href={doc.url} target="_blank" rel="noreferrer">
              Open original
            </a>
          ) : null}
          {error && <span className="error-badge">⚠️ Using RAG snippet fallback</span>}
        </div>

        <div className="document-viewer-body">{renderContent()}</div>
      </div>
    </div>
  )
}

function ChatPage() {
  const [session, setSession] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ who: string; text: string }>>([])
  const [loading, setLoading] = useState(false)
  const [relatedHits, setRelatedHits] = useState<SearchHit[]>([])
  const [selectedDocument, setSelectedDocument] = useState<DocumentPreview | null>(null)

  const suggestedPrompts = [
    'Summarize the latest policy changes for Indian zoos.',
    'Which zoo histories are best represented in the dataset?',
    'Compare Bannerghatta and Mysore Zoo conservation roles.',
    'What policy documents mention annual zoo reporting?',
  ]

  async function send() {
    if (!message) return
    setLoading(true)
    setMessages((m) => [...m, { who: 'user', text: message }])
    try {
      const res = await fetch('/api/chat/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: message, top_k: 4 }),
      })
      const payload = await res.json()
      setSession(payload.session_id)
      setMessages((m) => [...m, { who: 'assistant', text: payload.answer }])
      setRelatedHits(payload.hits || [])
    } catch (err) {
      console.error(err)
      setMessages((m) => [...m, { who: 'assistant', text: 'Error: chat failed' }])
    } finally {
      setLoading(false)
      setMessage('')
    }
  }

  return (
    <motion.div className="layout chat-layout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <section className="hero panel chat-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <MessageSquare size={16} />
            Local RAG chat
          </div>
          <h1>Chat with the corpus through Ollama.</h1>
          <p>The same source-grounded retrieval flow, now wrapped in a local LLM experience.</p>

          <div className="hero-actions">
            <button className="primary-button" onClick={send} disabled={loading || !message}>
              {loading ? 'Thinking...' : 'Send to Ollama'}
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="metric-row">
            <div className="metric-card">
              <span>Session</span>
              <strong>{session ?? 'new'}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side panel-inset">
          <div className="console-card">
            <div className="console-header">
              <Bot size={18} />
              Suggested prompts
            </div>
            <div className="example-list">
              {suggestedPrompts.map((prompt) => (
                <button key={prompt} className="example-chip" type="button" onClick={() => setMessage(prompt)}>
                  <span>Try this</span>
                  <small>{prompt}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel chat-panel">
        <div className="section-heading">
          <h2>Conversation</h2>
          <p>Source-backed answers are shown below, with Ollama handling the final response.</p>
        </div>

        <div className="chat-shell">
          <div className="chat-body-grid">
            <div className="chat-conversation panel-inset">
              <div className="chat-history">
                {messages.length ? messages.map((m, i) => (
                  <div key={i} className={`chat-bubble ${m.who}`}>
                    <div className="bubble-label">{m.who === 'user' ? 'You' : 'Assistant'}</div>
                    <div className="bubble-text">{m.text}</div>
                  </div>
                )) : (
                  <div className="empty-state">Ask a question to start a local RAG conversation.</div>
                )}
                {loading && (
                  <div className="chat-bubble assistant thinking-bubble">
                    <div className="bubble-label">Assistant</div>
                    <div className="bubble-text thinking-dots">
                      <span>Loading the answer</span>
                      <div className="dots-container">
                        <span className="dot"></span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="expected-questions-ticker">
                <div className="ticker-wrapper">
                  <div className="ticker-content">
                    {suggestedPrompts.map((q, idx) => (
                      <span key={idx} className="ticker-item" onClick={() => setMessage(q)}>
                        {q}
                      </span>
                    ))}
                    {suggestedPrompts.map((q, idx) => (
                      <span key={`dup-${idx}`} className="ticker-item" onClick={() => setMessage(q)}>
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="chat-input-row">
                <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a question..." onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }} />
                <button onClick={send} disabled={loading || !message}>Send</button>
              </div>
            </div>

            <div className="related-documents panel-inset">
              <div className="section-heading compact-heading">
                <h3>Related documents</h3>
                <p>Open the full document from the top-k results returned by the RAG retriever.</p>
              </div>

              {relatedHits.length ? (
                <div className="related-doc-grid">
                  {relatedHits.map((hit, index) => (
                    <article key={hit.chunk_id} className="related-doc-card">
                      <div className="result-topline">
                        <div className="result-meta-left">
                          <span className="category-badge">{hit.category}</span>
                          {hit.year && <span className="year-badge">📅 {hit.year}</span>}
                        </div>
                        <strong className="score-badge">{Math.round(hit.score * 100)}%</strong>
                      </div>
                      <h3>{hit.title}</h3>
                      <p>{hit.text.slice(0, 220)}{hit.text.length > 220 ? '…' : ''}</p>
                      <div className="result-actions">
                        <button className="secondary-button" type="button" onClick={() => setSelectedDocument({ ...hit, rank: index + 1 })}>
                          View document
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Documents will appear here after you send a question.</div>
              )}
            </div>
          </div>

          {selectedDocument && (
            <DocumentModalViewer doc={selectedDocument} onClose={() => setSelectedDocument(null)} />
          )}


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
  const [selectedDocument, setSelectedDocument] = useState<DocumentPreview | null>(null)

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
      icon: <Database size={18} />,
      label: 'Analytics',
      active: currentPage === 'analytics',
      onClick: () => setCurrentPage('analytics'),
    },
    {
      icon: <MessageSquare size={18} />,
      label: 'Chat',
      active: currentPage === 'chat',
      onClick: () => setCurrentPage('chat'),
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

        <div />

        <div className="navbar-status" data-ready={Boolean(health?.index_ready)}>
          <span className="status-dot" />
          <div>
            <strong>{health?.status ?? 'offline'}</strong>
            <small>{health?.index_ready ? 'Index ready' : 'Index warming up'}</small>
          </div>
        </div>
      </header>

      <div className="dock-sticky-container">
        <Dock items={dockItems} panelHeight={68} baseItemSize={50} magnification={70} />
      </div>

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
              onViewDocument={setSelectedDocument}
            />
          ) : currentPage === 'team' ? (
            <TeamPage key="team" />
          ) : currentPage === 'analytics' ? (
            <AnalyticsPage key="analytics" result={result} />
          ) : currentPage === 'chat' ? (
            <ChatPage key="chat" />
          ) : (
            <TeamPage key="team" />
          )}
        </AnimatePresence>

        {selectedDocument && (
          <DocumentModalViewer doc={selectedDocument} onClose={() => setSelectedDocument(null)} />
        )}
      </main>
    </div>
  )
}

export default App
