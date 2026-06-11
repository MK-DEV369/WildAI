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

function highlightText(text: string, query: string): JSX.Element | string {
  if (!query || !query.trim()) return text

  const stopwords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is",
    "it", "of", "on", "or", "that", "the", "to", "was", "what", "when", "where", "which",
    "who", "why", "with", "latest", "recent", "newest", "current", "about", "describe", "compare", "strategies"
  ])

  const words = query
    .toLowerCase()
    .match(/[a-z0-9]+/g) || []

  const filteredWords = words.filter(w => w.length >= 2 && !stopwords.has(w))
  if (filteredWords.length === 0) return text

  const patterns: string[] = []
  
  // 3-grams
  for (let i = 0; i < filteredWords.length - 2; i++) {
    patterns.push(`${filteredWords[i]}\\s+${filteredWords[i+1]}\\s+${filteredWords[i+2]}`)
  }
  // 2-grams
  for (let i = 0; i < filteredWords.length - 1; i++) {
    patterns.push(`${filteredWords[i]}\\s+${filteredWords[i+1]}`)
  }
  // 1-grams
  for (const w of filteredWords) {
    patterns.push(w)
  }

  const uniquePatterns = Array.from(new Set(patterns)).sort((a, b) => b.length - a.length)

  try {
    const regex = new RegExp(`\\b(${uniquePatterns.map(escapeRegex).join('|')})\\b`, 'gi')
    const parts = text.split(regex)
    const testRegex = new RegExp(`^(${uniquePatterns.map(escapeRegex).join('|')})$`, 'i')

    return (
      <>
        {parts.map((part, idx) => {
          const isMatch = testRegex.test(part.trim())
          return isMatch ? (
            <mark key={`${part}-${idx}`} style={{ backgroundColor: '#fbbf24', color: '#000', padding: '0 2px', borderRadius: '2px' }}>
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
  rebuildIndex,
  onViewDocument,
  messages,
  setMessages,
  sendChatMessage,
  clearChat,
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
  rebuildIndex: () => void
  onViewDocument: (hit: DocumentPreview) => void
  messages: Array<{ who: string; text: string }>
  setMessages: React.Dispatch<React.SetStateAction<Array<{ who: string; text: string }>>>
  sendChatMessage: (msg: string) => Promise<void>
  clearChat: () => void
}) {
  const [selectedExample, setSelectedExample] = useState(exampleQueries[0]?.query ?? '')
  const [exporting, setExporting] = useState(false)
  const [rightTab, setRightTab] = useState<'sources' | 'synthesis' | 'wordcloud'>('sources')
  const [chatInput, setChatInput] = useState('')

  const metrics = [
    { label: 'Status', value: health?.status ?? 'offline' },
    { label: 'Index', value: health?.index_ready ? 'ready' : 'not built' },
    { label: 'Hits', value: result?.total_hits?.toString() ?? '0' },
  ]

  const answerSections = result?.answer ? getAnswerSections(result.answer) : []
  const answerSummary = result?.answer
    ? result.answer.split(/\r?\n/).find((line) => line.trim().length > 0) ?? 'Run a query to see the retrieval answer and source grounding here.'
    : 'Run a query to see the retrieval answer and source grounding here.'

  const sortedHits = [...(result?.hits ?? [])].sort((a, b) => {
    if ((a.year ?? 0) !== (b.year ?? 0)) {
      return (b.year ?? 0) - (a.year ?? 0)
    }
    return b.score - a.score
  })

  async function downloadSummary() {
    if (!result?.answer) return
    setExporting(true)

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

  const [wordcloudWords, setWordcloudWords] = useState<Array<{ text: string; value: number }>>([])
  const [includeWordcloud, setIncludeWordcloud] = useState(true)

  useEffect(() => {
    async function loadWordcloudJSON() {
      if (!result) return
      try {
        const res = await fetch(`/api/analytics/wordcloud?top_n=120`)
        if (!res.ok) return
        const payload = await res.json()
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
    } catch { }

    try {
      const payload = {
        query: result.query,
        top_k: topK,
        category: category || null,
        source: source || null,
        year: year ? Number(year) : null,
        include_wordcloud: includeWordcloud,
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
    <div className="layout" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Hero / Header Panel */}
      <motion.section
        className="hero panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            WILDAI RAG-Chat Console
          </div>
          <h1 style={{ fontSize: '2.8rem', whiteSpace: 'nowrap' }}>Unified RAG & Chat Workspace</h1>
          <p>Chat with the 2GB+ wildlife corpus (1960-2026), grounded in real-time FAISS semantic search.</p>

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
            <div className="console-header" style={{ color: 'var(--accent-strong)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={18} />
              Conversational RAG Guidelines
            </div>
            <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0 0' }}>
              <li>Adjust retrieval filters in the right column to narrow down contexts.</li>
              <li>Ask follow-up questions in the chat console on the left.</li>
              <li>Toggle between retrieved passages, word clouds, and detailed synthesis on the right.</li>
            </ul>
          </div>
          <div className="badge-row">
            <span><Database size={14} /> GPU-FAISS</span>
            <span><ShieldCheck size={14} /> FastAPI</span>
            <span><MessageSquare size={14} /> Unified Console</span>
          </div>
        </div>
      </motion.section>

      {/* 2. Main Workspace Grid */}
      <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Chat Conversation */}
        <section className="panel chat-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '620px', padding: '1.5rem' }}>
          <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2>Interactive RAG Chat</h2>
              <p>Ask questions about species, treaties, and conservation acts.</p>
            </div>
            {messages.length > 0 && (
              <button className="secondary-button" onClick={clearChat} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '12px' }}>
                Clear Chat
              </button>
            )}
          </div>

          <div className="chat-shell" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '450px' }}>
            <div className="chat-conversation panel-inset" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '420px', overflowY: 'auto', padding: '1rem', background: 'rgba(5, 12, 10, 0.4)' }}>
              <div className="chat-history" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.length ? messages.map((m, i) => (
                  <div key={i} className={`chat-bubble ${m.who}`} style={{
                    alignSelf: m.who === 'user' ? 'flex-end' : 'flex-start',
                    background: m.who === 'user' ? 'rgba(126, 240, 168, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    border: m.who === 'user' ? '1px solid rgba(126, 240, 168, 0.2)' : '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px',
                    padding: '0.85rem 1.1rem',
                    maxWidth: '85%',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    <div className="bubble-label" style={{ 
                      fontSize: '0.72rem', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.08em', 
                      color: m.who === 'user' ? 'var(--accent-strong)' : 'var(--accent-warm)',
                      marginBottom: '0.35rem' 
                    }}>
                      {m.who === 'user' ? 'You' : 'Grounded Assistant'}
                    </div>
                    <div className="bubble-text" style={{ fontSize: '0.94rem', lineHeight: '1.6', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                      {m.text}
                    </div>
                  </div>
                )) : (
                  <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 1rem', background: 'transparent', border: 0 }}>
                    <Bot size={48} style={{ color: 'var(--accent-strong)', marginBottom: '1rem', opacity: 0.8 }} />
                    <p style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text)' }}>Welcome to the Grounded Research Console!</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--muted)', maxWidth: '450px', margin: '0.5rem auto 1.5rem' }}>
                      Start by asking a question. Your filters on the right will isolate the FAISS database search space dynamically.
                    </p>
                    <div className="example-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '450px', margin: '0 auto' }}>
                      {exampleQueries.slice(0, 3).map((item) => (
                        <button key={item.label} className="example-chip" type="button" onClick={() => {
                          setChatInput(item.query);
                          void sendChatMessage(item.query);
                        }} style={{
                          textAlign: 'left',
                          padding: '0.75rem 1rem',
                          borderRadius: '12px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontSize: '0.85rem',
                          color: 'var(--text)'
                        }}>
                          <span style={{ display: 'block', color: 'var(--accent-strong)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{item.label}</span>
                          <span style={{ display: 'block', marginTop: '0.15rem' }}>{item.query}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {loading && (
                  <div className="chat-bubble assistant thinking-bubble" style={{
                    alignSelf: 'flex-start',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px',
                    padding: '0.85rem 1.1rem',
                    maxWidth: '85%'
                  }}>
                    <div className="bubble-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-warm)', marginBottom: '0.35rem' }}>Assistant</div>
                    <div className="bubble-text thinking-dots" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)' }}>
                      <span>Retrieving & synthesizing answer</span>
                      <div className="dots-container" style={{ display: 'flex', gap: '0.2rem' }}>
                        <span className="dot" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)' }}></span>
                        <span className="dot" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)' }}></span>
                        <span className="dot" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)' }}></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="chat-input-row" style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
              <input 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                placeholder="Ask a follow-up or enter a new query..." 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (chatInput.trim()) {
                      void sendChatMessage(chatInput.trim());
                      setChatInput('');
                    }
                  }
                }} 
                style={{ flex: 1, padding: '0.9rem 1.1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(4,10,9,0.6)', color: 'var(--text)' }}
              />
              <button 
                className="primary-button" 
                onClick={() => {
                  if (chatInput.trim()) {
                    void sendChatMessage(chatInput.trim());
                    setChatInput('');
                  }
                }} 
                disabled={loading || !chatInput.trim()}
                style={{ padding: '0 1.5rem', height: '52px', borderRadius: '16px' }}
              >
                Send
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: RAG Context, Filters, and Sources */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Filters & Control Panel */}
          <section className="panel" style={{ padding: '1.25rem' }}>
            <div className="section-heading compact-heading" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Search size={16} /> Active RAG Filters
              </h3>
              <p>Constrain similarity matching context.</p>
            </div>

            <div className="control-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.82rem' }}>
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value)} style={{ padding: '0.6rem 0.8rem', borderRadius: '12px', fontSize: '0.85rem' }}>
                  {categories.map((option) => (
                    <option key={option.value || option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: '0.82rem' }}>
                Source
                <select value={source} onChange={(event) => setSource(event.target.value)} style={{ padding: '0.6rem 0.8rem', borderRadius: '12px', fontSize: '0.85rem' }}>
                  {sources.map((option) => (
                    <option key={option.value || option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: '0.82rem' }}>
                Year
                <input
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  placeholder="Any"
                  inputMode="numeric"
                  style={{ padding: '0.6rem 0.8rem', borderRadius: '12px', fontSize: '0.85rem' }}
                />
              </label>

              <label style={{ fontSize: '0.82rem' }}>
                Top K: {topK}
                <input
                  value={topK}
                  onChange={(event) => setTopK(Number(event.target.value))}
                  type="range"
                  min="1"
                  max="8"
                  style={{ height: '32px' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                className="secondary-button" 
                onClick={rebuildIndex} 
                disabled={reindexing}
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', borderRadius: '12px' }}
              >
                {reindexing ? 'Reindexing...' : 'Rebuild Index'}
              </button>
            </div>
          </section>

          {/* RAG Context Display Panel */}
          <section className="panel" style={{ padding: '1.25rem', minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
            
            {/* Tab Selection */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem', paddingBottom: '0.25rem' }}>
              <button 
                onClick={() => setRightTab('sources')} 
                style={{
                  background: 'transparent',
                  color: rightTab === 'sources' ? 'var(--accent)' : 'var(--muted)',
                  border: 0,
                  borderBottom: rightTab === 'sources' ? '2px solid var(--accent)' : '2px solid transparent',
                  padding: '0.5rem 0.85rem',
                  cursor: 'pointer',
                  fontWeight: rightTab === 'sources' ? 600 : 400,
                  fontSize: '0.86rem'
                }}
              >
                Passages
              </button>
              <button 
                onClick={() => setRightTab('synthesis')} 
                style={{
                  background: 'transparent',
                  color: rightTab === 'synthesis' ? 'var(--accent)' : 'var(--muted)',
                  border: 0,
                  borderBottom: rightTab === 'synthesis' ? '2px solid var(--accent)' : '2px solid transparent',
                  padding: '0.5rem 0.85rem',
                  cursor: 'pointer',
                  fontWeight: rightTab === 'synthesis' ? 600 : 400,
                  fontSize: '0.86rem'
                }}
              >
                Synthesis
              </button>
              <button 
                onClick={() => setRightTab('wordcloud')} 
                style={{
                  background: 'transparent',
                  color: rightTab === 'wordcloud' ? 'var(--accent)' : 'var(--muted)',
                  border: 0,
                  borderBottom: rightTab === 'wordcloud' ? '2px solid var(--accent)' : '2px solid transparent',
                  padding: '0.5rem 0.85rem',
                  cursor: 'pointer',
                  fontWeight: rightTab === 'wordcloud' ? 600 : 400,
                  fontSize: '0.86rem'
                }}
              >
                Word Cloud
              </button>
            </div>

            {/* Tab Content Rendering */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              
              {rightTab === 'sources' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                  {sortedHits.length > 0 ? sortedHits.map((hit, index) => (
                    <motion.article
                      key={hit.chunk_id}
                      className="result-card"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      style={{ padding: '0.85rem', background: 'rgba(4, 10, 9, 0.4)' }}
                    >
                      <div className="result-topline" style={{ marginBottom: '0.45rem' }}>
                        <div className="result-meta-left">
                          <span className="category-badge" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>{hit.category}</span>
                          {hit.year && <span className="year-badge" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>📅 {hit.year}</span>}
                        </div>
                        <strong className="score-badge" style={{ fontSize: '0.8rem' }}>{Math.round(hit.score * 100)}%</strong>
                      </div>
                      <h4 style={{ fontSize: '0.92rem', margin: '0 0 0.35rem', fontWeight: 600 }}>{hit.title}</h4>
                      <p className="result-text" style={{ fontSize: '0.82rem', color: 'rgba(233, 255, 244, 0.8)', margin: '0 0 0.5rem', lineHeight: '1.5' }}>
                        {highlightText(hit.text, result?.query ?? '')}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--muted)' }}>
                        <span>📄 {hit.source}</span>
                        <button 
                          className="ghost-button" 
                          onClick={() => onViewDocument({ ...hit, rank: index + 1 })}
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', minHeight: 'auto', borderRadius: '8px' }}
                        >
                          View Document
                        </button>
                      </div>
                    </motion.article>
                  )) : (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>No retrieved passages yet. Send a question to run FAISS semantic lookup.</div>
                  )}
                </div>
              )}

              {rightTab === 'synthesis' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                  {result?.answer ? (
                    <div className="answer-sections" style={{ fontSize: '0.88rem' }}>
                      <div className="answer-summary-box" style={{ padding: '0.75rem 1rem', borderRadius: '12px' }}>
                        <span className="answer-summary-label" style={{ fontSize: '0.68rem', marginBottom: '0.25rem' }}>Key Takeaway</span>
                        <p style={{ fontSize: '0.85rem' }}>{renderInlineMarkdown(answerSummary)}</p>
                      </div>
                      
                      {answerSections.map((section) => (
                        <section key={section.title} className="answer-section-block" style={{ padding: '0.75rem 1rem', borderRadius: '12px' }}>
                          <h3 style={{ fontSize: '0.92rem', marginBottom: '0.5rem' }}>{section.title}</h3>
                          <div className="answer-section-body" style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>
                            {section.body.map((line, idx) => {
                              const trimmed = line.trim()
                              if (!trimmed) return <div key={idx} className="answer-spacer" style={{ height: '0.2rem' }} />
                              if (/^[*-]\s+/.test(trimmed)) {
                                return (
                                  <div key={idx} className="answer-bullet">
                                    <span className="answer-bullet-mark">•</span>
                                    <span>{renderInlineMarkdown(trimmed.replace(/^[*-]\s+/, ''))}</span>
                                  </div>
                                )
                              }
                              return <p key={idx}>{renderInlineMarkdown(trimmed)}</p>
                            })}
                          </div>
                        </section>
                      ))}
                      
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem' }}>
                        <button className="secondary-button" onClick={downloadSummary} style={{ flex: 1, padding: '0.5rem', fontSize: '0.78rem', borderRadius: '12px' }}>
                          Export Report (MD)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>Detailed report synthesis will populate here after a query has run.</div>
                  )}
                </div>
              )}

              {rightTab === 'wordcloud' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  {result ? (
                    <div className="wordcloud-shell" style={{ width: '100%' }}>
                      <img
                        src={`/api/analytics/wordcloud_image?top_n=120&q=${encodeURIComponent(result.query)}`}
                        className="wordcloud-image"
                        alt="Word Cloud"
                        style={{ width: '100%', borderRadius: '12px' }}
                      />
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>Word cloud will populate here after you run a query.</div>
                  )}
                </div>
              )}

            </div>
          </section>

        </div>
      </div>
      {error && <div className="alert">{error}</div>}
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
  const [energyData, setEnergyData] = useState<{ logs: any[]; system_specs: any } | null>(null)
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

        const res4 = await fetch('/api/analytics/energy')
        const p4 = await res4.json()
        setEnergyData(p4)
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
      <motion.section 
        className="hero panel analytics-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="hero-copy">
          <div className="eyebrow">
            <Database size={16} />
            Corpus analytics
          </div>
          <h1>Corpus signals, styled like the rest of the console.</h1>
          <p>Category mix, year coverage, and tech stack telemetry in one coherent analytics surface.</p>

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
      </motion.section>

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

        {/* Energy Telemetry Dashboard */}
        <div className="analytics-card panel-inset energy-telemetry-card" style={{ marginTop: '1.5rem' }}>
          <div className="section-heading compact-heading">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-strong)' }}>
              ⚡ Tech Stack Energy Telemetry
            </h3>
            <p>Real-time execution telemetry, hardware profiling, and energy consumption logs.</p>
          </div>
          
          {energyData?.system_specs ? (
            <div className="specs-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
              gap: '1rem', 
              margin: '1rem 0 1.5rem', 
              background: 'rgba(255, 255, 255, 0.02)', 
              padding: '1rem', 
              borderRadius: '12px', 
              border: '1px solid rgba(255, 255, 255, 0.05)' 
            }}>
              <div><strong>OS:</strong> <span style={{ color: 'var(--accent)', marginLeft: '0.5rem' }}>{energyData.system_specs.os}</span></div>
              <div><strong>CPU:</strong> <span style={{ color: 'var(--accent)', marginLeft: '0.5rem' }}>{energyData.system_specs.cpu}</span></div>
              <div><strong>GPU:</strong> <span style={{ color: 'var(--accent)', marginLeft: '0.5rem' }}>{energyData.system_specs.gpu}</span></div>
              <div><strong>RAM:</strong> <span style={{ color: 'var(--accent)', marginLeft: '0.5rem' }}>{energyData.system_specs.ram}</span></div>
            </div>
          ) : null}

          {energyData?.logs && energyData.logs.length > 0 ? (
            <div className="telemetry-table-wrapper" style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table className="telemetry-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', color: 'var(--accent-strong)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Task Name</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Duration</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>CPU Util</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>CPU Power</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>GPU Power</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Energy Consumed</th>
                  </tr>
                </thead>
                <tbody>
                  {energyData.logs.map((log: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{log.task}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-warm)' }}>{log.duration.toFixed(2)}s</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{log.cpu_util.toFixed(1)}%</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{log.cpu_w.toFixed(1)}W</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{log.gpu_w.toFixed(1)}W</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent)', fontWeight: 600 }}>{log.energy.toFixed(5)} Wh</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No telemetry logged yet. Telemetry will accumulate as you run indexing, queries, or chat.</div>
          )}
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

  // RAG Chat State
  const [session, setSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{ who: string; text: string }>>([])

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

  const clearChat = () => {
    setMessages([])
    setSession(null)
  }

  async function sendChatMessage(msgText: string) {
    if (!msgText) return
    setLoading(true)
    setError('')
    setMessages((m) => [...m, { who: 'user', text: msgText }])
    try {
      const response = await fetch('/api/chat/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: msgText,
          top_k: topK,
          category: category || null,
          source: source || null,
          year: year ? Number(year) : null,
        }),
      })

      if (!response.ok) {
        throw new Error('Chat failed')
      }

      const payload = await response.json()
      setSession(payload.session_id)
      setMessages((m) => [...m, { who: 'assistant', text: payload.answer }])
      
      if (payload.hits) {
        setResult({
          query: msgText,
          answer: payload.answer,
          total_hits: payload.hits.length,
          highlight_terms: [],
          hits: payload.hits,
        })
      }
    } catch (err) {
      console.error(err)
      setMessages((m) => [...m, { who: 'assistant', text: 'Error: chat failed. Make sure the FastAPI backend is running.' }])
      setError('Chat response failed. Please verify API is running.')
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
              rebuildIndex={rebuildIndex}
              onViewDocument={setSelectedDocument}
              messages={messages}
              setMessages={setMessages}
              sendChatMessage={sendChatMessage}
              clearChat={clearChat}
            />
          ) : currentPage === 'team' ? (
            <TeamPage key="team" />
          ) : currentPage === 'analytics' ? (
            <AnalyticsPage key="analytics" result={result} />
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

