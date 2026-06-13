import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bot, Database, Download, Search, ShieldCheck, Sparkles, TreePine, Users, Home, MessageSquare, Mic, MicOff } from 'lucide-react'
import cloud from 'd3-cloud'
import { useEffect, useState, useMemo } from 'react'
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

  if (words.length === 0) return text

  const patterns: string[] = []

  const isValuable = (phraseWords: string[]) => {
    return phraseWords.some(w => !stopwords.has(w) && w.length >= 2)
  }

  // Generate N-grams from N down to 1
  for (let n = Math.min(8, words.length); n >= 1; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      const subWords = words.slice(i, i + n)
      if (isValuable(subWords)) {
        const pattern = subWords.map(escapeRegex).join('\\s+')
        patterns.push(pattern)
      }
    }
  }

  if (patterns.length === 0) return text

  // Sort unique patterns by length descending so that longer phrase matches take precedence
  const uniquePatterns = Array.from(new Set(patterns)).sort((a, b) => b.length - a.length)

  try {
    const regex = new RegExp(`\\b(${uniquePatterns.join('|')})\\b`, 'gi')
    const parts = text.split(regex)
    const testRegex = new RegExp(`^(${uniquePatterns.join('|')})$`, 'i')

    return (
      <>
        {parts.map((part, idx) => {
          const isMatch = testRegex.test(part.trim())
          return isMatch ? (
            <mark key={`${part}-${idx}`} className="search-highlight">
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
  const [showMdPreview, setShowMdPreview] = useState(false)
  const [mdPreviewContent, setMdPreviewContent] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Custom Report Export Settings States
  const [summaryLength, setSummaryLength] = useState('2') // '1', '2', '3+'
  const [summaryType, setSummaryType] = useState('abstractive') // 'abstractive', 'comprehensive', 'evolution', 'executive'
  const [includeAnimal, setIncludeAnimal] = useState(true)
  const [includeTelemetry, setIncludeTelemetry] = useState(true)
  const [attachSnippets, setAttachSnippets] = useState(true)
  const [synthesisReport, setSynthesisReport] = useState('')
  const [synthesisLoading, setSynthesisLoading] = useState(false)

  // Speech to Text State
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)

  // Text to Speech State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [autoRead, setAutoRead] = useState(true)

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = 'en-US'

      rec.onstart = () => {
        setIsListening(true)
      }

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setChatInput((prev) => (prev ? prev + ' ' + transcript : transcript))
      }

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      rec.onend = () => {
        setIsListening(false)
      }

      setRecognition(rec)
    }
  }, [])

  const toggleListening = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser. Please try Chrome or Edge.')
      return
    }

    if (isListening) {
      recognition.stop()
    } else {
      recognition.start()
    }
  }

  // Load and monitor speech synthesis voices
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const list = window.speechSynthesis.getVoices()
        setVoices(list)
        if (list.length > 0 && !selectedVoiceName) {
          const englishVoice = list.find((v) => v.lang.startsWith('en'))
          setSelectedVoiceName(englishVoice ? englishVoice.name : list[0].name)
        }
      }
    }

    loadVoices()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }

    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        setIsSpeaking(window.speechSynthesis.speaking)
      }
    }, 250)

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null
      }
      clearInterval(interval)
    }
  }, [selectedVoiceName])

  // Trigger speak when new assistant message arrives
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.who === 'assistant' && autoRead) {
        // Strip markdown and citations for a cleaner read-aloud voice
        const textToSpeak = lastMessage.text
          .replace(/[*#`_\-]/g, '')
          .replace(/\[\d+\]/g, '')
          .trim()
        
        if (textToSpeak && !textToSpeak.startsWith('Error:')) {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(textToSpeak)
          if (selectedVoiceName) {
            const voice = voices.find((v) => v.name === selectedVoiceName)
            if (voice) utterance.voice = voice
          }
          window.speechSynthesis.speak(utterance)
        }
      }
    }
  }, [messages, autoRead, selectedVoiceName, voices])

  async function generateCustomSummary() {
    if (!result) return
    setSynthesisLoading(true)
    try {
      const payload = {
        query: result.query,
        summary_length: summaryLength,
        summary_type: summaryType,
        include_animal_photo: includeAnimal,
        include_telemetry_charts: includeTelemetry,
        attach_snippets: attachSnippets,
        category: category || null,
        source: source || null,
        year: year ? Number(year) : null,
        top_k: topK
      }
      const res = await fetch('/api/generate_summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setSynthesisReport(data.summary)
    } catch (err) {
      console.error(err)
      alert('Failed to generate custom summary. Make sure the backend API is running.')
    } finally {
      setSynthesisLoading(false)
    }
  }

  useEffect(() => {
    if (result) {
      setSynthesisReport(result.answer)
      const loadDefaultSummary = async () => {
        setSynthesisLoading(true)
        try {
          const payload = {
            query: result.query,
            summary_length: '2', // default 2 pages
            summary_type: 'abstractive', // default abstractive
            include_animal_photo: true,
            include_telemetry_charts: true,
            attach_snippets: true,
            category: category || null,
            source: source || null,
            year: year ? Number(year) : null,
            top_k: topK
          }
          const res = await fetch('/api/generate_summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          if (res.ok) {
            const data = await res.json()
            setSynthesisReport(data.summary)
          }
        } catch (err) {
          console.error('Failed to pre-load custom summary:', err)
        } finally {
          setSynthesisLoading(false)
        }
      }
      void loadDefaultSummary()
    } else {
      setSynthesisReport('')
    }
  }, [result])

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

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

  function generateReportMarkdown(detailedReportText: string): string {
    const top3 = sortedHits.slice(0, 3)
    
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
    const remainingCount = sortedHits.length - 3

    return [
      '# WILDAI Research Report',
      '',
      `> Generated by WILDAI Research Console · ${stamp}`,
      '',
      '---',
      '',
      '## Query',
      '',
      `> ${result?.query ?? ''}`,
      '',
      '---',
      '',
      '## Detailed Analysis',
      '',
      detailedReportText,
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
      `| Total hits | ${result?.total_hits ?? 0} |`,
      `| Returned | ${sortedHits.length} |`,
      `| Highlight terms | ${result?.highlight_terms.join(', ') || 'N/A'} |`,
      '',
      '---',
      '',
      '*Report produced by WILDAI · Wildlife Intelligence RAG System*',
    ].join('\n')
  }

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
  - Analyze the years/time periods of the retrieved documents (e.g. from 2011 to 2026). Use this chronological timeframe in your summary, even if the text itself doesn't explicitly label them as 'latest'.
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

    const fileBody = generateReportMarkdown(detailedReport || result.answer)
    const blob = new Blob([fileBody], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const isoStamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.download = `wildai-report-${isoStamp}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  async function handleOpenMdPreview() {
    if (!result?.answer) return
    setPreviewLoading(true)
    setShowMdPreview(true)
    
    let detailedReport = ''
    try {
      const top3 = sortedHits.slice(0, 3)
      const systemPrompt = `
  You are a wildlife-policy research analyst writing a formal report section.
  Write a detailed, well-structured answer to the user's query.
  Rules:
  - Cite sources inline as [1], [2], [3] whenever you draw on them.
  - Every factual claim must be traceable to at least one source.
  - Structure with ### headings: Overview, Key Findings, Policy Implications, Conclusion.
  - Use clear, formal prose — no bullet spam.
  - Length: 350-500 words.
  - Analyze the years/time periods of the retrieved documents (e.g. from 2011 to 2026). Use this chronological timeframe in your summary, even if the text itself doesn't explicitly label them as 'latest'.
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
      } else {
        detailedReport = result.answer
      }
    } catch {
      detailedReport = result.answer
    }
    
    const markdown = generateReportMarkdown(detailedReport)
    setMdPreviewContent(markdown)
    setPreviewLoading(false)
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

    try {
      const payload = {
        query: result.query,
        summary_length: summaryLength,
        summary_type: summaryType,
        include_animal_photo: includeAnimal,
        include_telemetry_charts: includeTelemetry,
        attach_snippets: attachSnippets,
        category: category || null,
        source: source || null,
        year: year ? Number(year) : null,
        top_k: topK,
        detailed_report: synthesisReport || result.answer,
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
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.download = `wildai-report-${timestamp}.${fmt}`
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

            {/* Voice Control Bar */}
            <div className="voice-control-panel" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.55rem 0.85rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              marginBottom: '0.75rem',
              fontSize: '0.82rem',
              color: 'var(--muted)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={autoRead}
                    onChange={(e) => setAutoRead(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                  <span>Auto-read replies</span>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {isSpeaking && (
                  <button
                    onClick={stopSpeaking}
                    style={{
                      background: 'rgba(255, 100, 100, 0.15)',
                      border: '1px solid rgba(255, 100, 100, 0.3)',
                      color: '#ff8888',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 100, 100, 0.25)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 100, 100, 0.15)';
                    }}
                  >
                    Stop Reading
                  </button>
                )}

                {voices.length > 0 && (
                  <div className="voice-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>Voice:</span>
                    <select
                      value={selectedVoiceName}
                      onChange={(e) => setSelectedVoiceName(e.target.value)}
                      style={{
                        background: 'rgba(4, 10, 9, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '0.2rem 0.5rem',
                        color: 'var(--text)',
                        fontSize: '0.78rem',
                        outline: 'none',
                        cursor: 'pointer',
                        maxWidth: '180px'
                      }}
                    >
                      {voices.map((v) => (
                        <option key={v.name} value={v.name} style={{ background: '#0c1b17', color: '#e9fff4' }}>
                          {v.name.slice(0, 20)} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="chat-input-row" style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
              <button
                type="button"
                onClick={toggleListening}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '52px',
                  height: '52px',
                  borderRadius: '16px',
                  border: isListening ? '1px solid rgba(255, 100, 100, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                  background: isListening ? 'rgba(255, 100, 100, 0.15)' : 'rgba(4,10,9,0.6)',
                  color: isListening ? '#ff8888' : 'var(--accent)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
                title={isListening ? 'Listening... Click to stop.' : 'Voice input (Speech-to-Text)'}
              >
                {isListening ? (
                  <>
                    <MicOff size={20} />
                    <span className="ping" style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '16px',
                      border: '2px solid rgba(255, 100, 100, 0.5)',
                      animation: 'pulse-mic 1.5s infinite ease-in-out'
                    }}></span>
                  </>
                ) : (
                  <Mic size={20} />
                )}
              </button>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Export Settings Panel */}
                      <div className="export-settings-panel" style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid rgba(126, 240, 168, 0.15)', background: 'rgba(12, 27, 23, 0.6)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em' }}>REPORT EXPORT SETTINGS</span>
                          <button 
                            className="secondary-button" 
                            onClick={generateCustomSummary} 
                            disabled={synthesisLoading}
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem', minHeight: 'auto', borderRadius: '8px' }}
                          >
                            {synthesisLoading ? 'Generating...' : 'Update Summary'}
                          </button>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Summary Type</label>
                            <select 
                              value={summaryType} 
                              onChange={(e) => setSummaryType(e.target.value)}
                              className="console-select"
                              style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', background: '#07120e', border: '1px solid rgba(126,240,168,0.2)', borderRadius: '6px', color: '#e9fff4' }}
                            >
                              <option value="abstractive">Abstractive Summary</option>
                              <option value="comprehensive">Comprehensive Report</option>
                              <option value="evolution">Policy Evolution Analyst</option>
                              <option value="executive">Executive Briefing</option>
                            </select>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Target Length</label>
                            <select 
                              value={summaryLength} 
                              onChange={(e) => setSummaryLength(e.target.value)}
                              className="console-select"
                              style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', background: '#07120e', border: '1px solid rgba(126,240,168,0.2)', borderRadius: '6px', color: '#e9fff4' }}
                            >
                              <option value="1">1 Page (Compact)</option>
                              <option value="2">2 Pages (Standard)</option>
                              <option value="3+">3+ Pages (Exhaustive)</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', marginTop: '0.2rem', fontSize: '0.74rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'rgba(233,255,244,0.85)' }}>
                            <input 
                              type="checkbox" 
                              checked={includeAnimal} 
                              onChange={(e) => setIncludeAnimal(e.target.checked)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            Species Photo
                          </label>
                          
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'rgba(233,255,244,0.85)' }}>
                            <input 
                              type="checkbox" 
                              checked={includeTelemetry} 
                              onChange={(e) => setIncludeTelemetry(e.target.checked)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            Telemetry Charts
                          </label>
                          
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'rgba(233,255,244,0.85)' }}>
                            <input 
                              type="checkbox" 
                              checked={attachSnippets} 
                              onChange={(e) => setAttachSnippets(e.target.checked)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            Attach Passage Snippets
                          </label>
                        </div>
                      </div>

                      {/* Summary Report Body */}
                      {synthesisLoading ? (
                        <div className="synthesis-loading-box" style={{ padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px dashed rgba(126,240,168,0.1)' }}>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <span className="dot-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                            <span className="dot-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animationDelay: '0.2s' }} />
                            <span className="dot-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animationDelay: '0.4s' }} />
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontFamily: 'monospace' }}>COMPILING REPORT SYNTHESIS FROM PASSAGES...</span>
                        </div>
                      ) : (
                        <div className="answer-sections" style={{ fontSize: '0.88rem' }}>
                          <div className="answer-summary-box" style={{ padding: '0.75rem 1rem', borderRadius: '12px' }}>
                            <span className="answer-summary-label" style={{ fontSize: '0.68rem', marginBottom: '0.25rem' }}>Active Document Timeframe</span>
                            <p style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>
                              Report configuration: {summaryLength} Page(s) · {summaryType.toUpperCase()} summary
                            </p>
                          </div>
                          
                          {getAnswerSections(synthesisReport || result.answer).map((section) => (
                            <section key={section.title} className="answer-section-block" style={{ padding: '0.75rem 1rem', borderRadius: '12px', marginTop: '0.5rem' }}>
                              <h3 style={{ fontSize: '0.92rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>{section.title}</h3>
                              <div className="answer-section-body" style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>
                                {section.body.map((line, idx) => {
                                  const trimmed = line.trim()
                                  if (!trimmed) return <div key={idx} className="answer-spacer" style={{ height: '0.2rem' }} />
                                  if (/^[*-]\s+/.test(trimmed)) {
                                    return (
                                      <div key={idx} className="answer-bullet" style={{ display: 'flex', gap: '0.4rem', margin: '0.2rem 0' }}>
                                        <span className="answer-bullet-mark" style={{ color: 'var(--accent)' }}>•</span>
                                        <span>{renderInlineMarkdown(trimmed.replace(/^[*-]\s+/, ''))}</span>
                                      </div>
                                    )
                                  }
                                  return <p key={idx} style={{ margin: '0.4rem 0', lineHeight: '1.5' }}>{renderInlineMarkdown(trimmed)}</p>
                                })}
                              </div>
                            </section>
                          ))}
                        </div>
                      )}

                      {/* Export Action Buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginTop: '0.5rem' }}>
                        <button className="secondary-button" onClick={() => exportServer('pdf')} style={{ padding: '0.5rem 0.25rem', fontSize: '0.74rem', borderRadius: '12px' }} disabled={exporting || synthesisLoading}>
                          Export PDF
                        </button>
                        <button className="secondary-button" onClick={() => exportServer('docx')} style={{ padding: '0.5rem 0.25rem', fontSize: '0.74rem', borderRadius: '12px' }} disabled={exporting || synthesisLoading}>
                          Export Word
                        </button>
                        <button className="secondary-button" onClick={() => exportServer('md')} style={{ padding: '0.5rem 0.25rem', fontSize: '0.74rem', borderRadius: '12px' }} disabled={exporting || synthesisLoading}>
                          Export MD
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

      {showMdPreview && (
        <div className="document-modal-overlay" onClick={() => setShowMdPreview(false)}>
          <div className="document-modal panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="document-viewer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Search size={16} />
                  Report Markdown Preview
                </div>
                <h3>{result?.query}</h3>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="ghost-button" 
                  onClick={() => {
                    navigator.clipboard.writeText(mdPreviewContent);
                    alert("Markdown report copied to clipboard!");
                  }}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.76rem', borderRadius: '8px' }}
                  disabled={previewLoading}
                >
                  Copy Markdown
                </button>
                <button 
                  className="ghost-button" 
                  onClick={() => setShowMdPreview(false)}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.76rem', borderRadius: '8px' }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="document-viewer-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem 0', display: 'flex', flexDirection: 'column' }}>
              {previewLoading ? (
                <div className="document-viewer-loading" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="thinking-dots" style={{ marginBottom: '0.5rem' }}>
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Synthesizing detailed Markdown report...</span>
                  </div>
                </div>
              ) : (
                <pre style={{ 
                  margin: 0, 
                  padding: '1rem', 
                  background: '#06100d', 
                  border: '1px solid rgba(126, 240, 168, 0.15)', 
                  borderRadius: '10px', 
                  color: 'rgba(233, 255, 244, 0.92)', 
                  fontFamily: 'Consolas, Courier New, monospace', 
                  fontSize: '0.82rem', 
                  lineHeight: '1.6', 
                  whiteSpace: 'pre-wrap', 
                  overflowX: 'auto' 
                }}>
                  {mdPreviewContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
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
  // New: per-year category breakdown
  const [yearCategoryData, setYearCategoryData] = useState<Record<number, Record<string, number>>>({})

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

        // New endpoint: per-year category breakdown
        // Expected shape: { year_category: { "2020": { "policy": 12, "species": 8, ... }, ... } }
        try {
          const res2b = await fetch('/api/analytics/year_category')
          if (res2b.ok) {
            const p2b = await res2b.json()
            setYearCategoryData(p2b.year_category || {})
          }
        } catch { /* graceful degradation */ }

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

  // Cluster duplicate tasks in energyData.logs
  const clusteredLogs = useMemo(() => {
    if (!energyData?.logs) return []
    const groups: Record<string, {
      task: string
      energy: number
      duration: number
      cpu_util_sum: number
      cpu_w_sum: number
      gpu_w_sum: number
      count: number
    }> = {}

    for (const log of energyData.logs) {
      const name = log.task || "Unknown Task"
      if (!groups[name]) {
        groups[name] = {
          task: name,
          energy: 0,
          duration: 0,
          cpu_util_sum: 0,
          cpu_w_sum: 0,
          gpu_w_sum: 0,
          count: 0,
        }
      }
      const g = groups[name]
      g.energy += log.energy ?? 0
      g.duration += log.duration ?? 0
      g.cpu_util_sum += log.cpu_util ?? 0
      g.cpu_w_sum += log.cpu_w ?? 0
      g.gpu_w_sum += log.gpu_w ?? 0
      g.count += 1
    }

    return Object.values(groups).map((g) => ({
      task: g.task,
      energy: g.energy,
      duration: g.duration,
      cpu_util: g.cpu_util_sum / g.count,
      cpu_w: g.cpu_w_sum / g.count,
      gpu_w: g.gpu_w_sum / g.count,
      count: g.count,
    }))
  }, [energyData?.logs])

  // ─── Derived data for stacked bar chart ───────────────────────────────────
  // Palette per domain category (expand as needed)
  const DOMAIN_PALETTE: Record<string, string> = {
    policy:      '#7ef0a8',
    species:     '#ffc857',
    ecosystems:  '#5ec8ff',
    legal:       '#ff8b7b',
    habitat:     '#91a7ff',
    trade:       '#f48fb1',
    community:   '#80cbc4',
    climate:     '#ce93d8',
    research:    '#ffcc80',
    management:  '#a5d6a7',
  }
  const FALLBACK_COLORS = ['#7ef0a8','#ffc857','#5ec8ff','#ff8b7b','#91a7ff','#f48fb1','#80cbc4','#ce93d8']

  // Build a unified set of all domain keys seen across all years
  const allDomains = Array.from(
    new Set(Object.values(yearCategoryData).flatMap((obj) => Object.keys(obj)))
  ).sort()

  // Years sorted ascending, last 12 for readability
  const chartYears = Object.keys(yearCategoryData)
    .map(Number)
    .sort((a, b) => a - b)
    .slice(-12)

  // Per-year totals for normalization
  const yearTotals: Record<number, number> = {}
  for (const yr of chartYears) {
    const row = yearCategoryData[yr] ?? {}
    yearTotals[yr] = Object.values(row).reduce((s, v) => s + v, 0) || 1
  }

  function domainColor(domain: string, idx: number): string {
    return DOMAIN_PALETTE[domain.toLowerCase()] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
  }

  // ─── Donut chart for category counts ──────────────────────────────────────
  function buildDonut(counts: Record<string, number>) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1
    const cx = 110, cy = 110, r = 80, innerR = 48
    let angle = -Math.PI / 2
    const slices = entries.map(([label, value], i) => {
      const frac = value / total
      const startAngle = angle
      angle += frac * 2 * Math.PI
      const endAngle = angle
      const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle)
      const ix1 = cx + innerR * Math.cos(startAngle), iy1 = cy + innerR * Math.sin(startAngle)
      const ix2 = cx + innerR * Math.cos(endAngle),   iy2 = cy + innerR * Math.sin(endAngle)
      const large = frac > 0.5 ? 1 : 0
      const path = `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`
      const midAngle = startAngle + (frac * Math.PI)
      return { label, value, frac, path, color: domainColor(label, i), midAngle }
    })
    return { slices, total }
  }

  // ─── Energy telemetry bar chart ───────────────────────────────────────────
  const maxEnergy = clusteredLogs.length
    ? Math.max(...clusteredLogs.map((l: any) => l.energy)) || 1
    : 1
  const maxDuration = clusteredLogs.length
    ? Math.max(...clusteredLogs.map((l: any) => l.duration)) || 1
    : 1

  return (
    <motion.div className="layout analytics-layout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.section
        className="hero panel analytics-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="hero-copy">
          <div className="eyebrow"><Database size={16} />Corpus analytics</div>
          <h1>Corpus Signals & System Telemetry</h1>
          <p>Category distribution, yearly domain breakdown, and energy profiling — all in one surface.</p>
          <div className="metric-row">
            <div className="metric-card"><span>Categories</span><strong>{categoryCounts ? Object.keys(categoryCounts).length : '—'}</strong></div>
            <div className="metric-card"><span>Years tracked</span><strong>{timeSeries.length || '—'}</strong></div>
            <div className="metric-card"><span>Energy logs</span><strong>{energyData?.logs?.length ?? '—'}</strong></div>
          </div>
        </div>
        <div className="hero-side panel-inset">
          <div className="console-card">
            <div className="console-header"><ShieldCheck size={18} />What's in this tab</div>
            <ul>
              <li><strong>Section A</strong> — Category donut + ranked list</li>
              <li><strong>Section B</strong> — Yearly domain stacked bars (normalized %)</li>
              <li><strong>Section C</strong> — Word cloud for active query</li>
              <li><strong>Section D</strong> — Energy & latency telemetry charts</li>
            </ul>
          </div>
          <div className="badge-row">
            <span><Database size={14} /> Corpus</span>
            <span><Sparkles size={14} /> Terms</span>
            <span><TreePine size={14} /> Trends</span>
          </div>
        </div>
      </motion.section>

      {/* ── Section A: Category distribution ────────────────────────────── */}
      <section className="panel" style={{ padding: '1.5rem' }}>
        <div className="section-heading" style={{ marginBottom: '1.25rem' }}>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: '0.4rem' }}>
            <span>A</span> — Category Distribution
          </div>
          <h2 style={{ marginBottom: '0.25rem' }}>What types of documents are in the corpus?</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Top 10 categories by indexed chunk count. Hover slices for exact values.</p>
        </div>

        {categoryCounts ? (() => {
          const { slices, total } = buildDonut(categoryCounts)
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '3rem', alignItems: 'center' }}>
              {/* Donut */}
              <div style={{ position: 'relative', width: '320px', height: '320px' }}>
                <svg viewBox="0 0 220 220" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <title>Category distribution donut chart</title>
                  {slices.map((s) => (
                    <path
                      key={s.label}
                      d={s.path}
                      fill={s.color}
                      opacity={0.88}
                      style={{ transition: 'opacity 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.88')}
                    >
                      <title>{s.label}: {s.value.toLocaleString()} chunks ({(s.frac * 100).toFixed(1)}%)</title>
                    </path>
                  ))}
                  {/* Center label */}
                  <text x="110" y="105" textAnchor="middle" style={{ fill: 'var(--text)', fontSize: '22px', fontWeight: 700 }}>{total.toLocaleString()}</text>
                  <text x="110" y="122" textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: '10px' }}>total chunks</text>
                </svg>
              </div>

              {/* Legend + ranked list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '480px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '200px 100px 80px', gap: '0.35rem 1rem', fontSize: '0.82rem', color: 'var(--muted)', padding: '0 0.5rem 0.35rem', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.25rem' }}>
                  <span>Category</span><span style={{ textAlign: 'right' }}>Chunks</span><span style={{ textAlign: 'right' }}>Share</span>
                </div>
                {slices.map((s, i) => (
                  <div key={s.label} style={{ display: 'grid', gridTemplateColumns: '200px 100px 80px', gap: '0.35rem 1rem', alignItems: 'center', padding: '0.3rem 0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.84rem', color: 'var(--text)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: '0.84rem', color: 'var(--text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.value.toLocaleString()}</span>
                    <span style={{ fontSize: '0.78rem', color: s.color, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(s.frac * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })() : (
          <div className="empty-state">{loading ? 'Loading category data…' : 'No category data available.'}</div>
        )}
      </section>

      {/* ── Section B: Yearly domain breakdown (normalized stacked bars) ── */}
      <section className="panel" style={{ padding: '1.5rem' }}>
        <div className="section-heading" style={{ marginBottom: '1.25rem' }}>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: '0.4rem' }}>
            <span>B</span> — Yearly Domain Breakdown
          </div>
          <h2 style={{ marginBottom: '0.25rem' }}>How does domain composition shift across years?</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Each bar is normalized to 100%. Stacked segments show the share of each domain category per year (last 12 years shown).
          </p>
        </div>

        {chartYears.length > 0 ? (
          <div>
            {/* Chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '180px', padding: '0 0 0.25rem' }} role="img" aria-label="Stacked bar chart of domain distribution by year">
              {chartYears.map((yr) => {
                const row = yearCategoryData[yr] ?? {}
                const total = yearTotals[yr]
                let cumulative = 0
                return (
                  <div key={yr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%' }}>
                    {/* Label above bar */}
                    <span style={{ fontSize: '0.6rem', color: 'var(--muted)', marginBottom: 'auto' }}>{total}</span>
                    {/* Stacked bar */}
                    <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column-reverse', borderRadius: '4px', overflow: 'hidden', cursor: 'default' }}>
                      {allDomains.map((domain, di) => {
                        const count = row[domain] ?? 0
                        if (!count) return null
                        const pct = (count / total) * 100
                        return (
                          <div
                            key={domain}
                            style={{ width: '100%', height: `${pct}%`, background: domainColor(domain, di), minHeight: count > 0 ? '2px' : '0', transition: 'height 0.4s ease' }}
                            title={`${domain}: ${count} docs (${pct.toFixed(1)}%)`}
                          />
                        )
                      })}
                    </div>
                    {/* Year label below */}
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '4px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', lineHeight: 1 }}>{yr}</span>
                  </div>
                )
              })}
            </div>

            {/* Y-axis guide labels */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '0.75rem', marginTop: '0.25rem', paddingLeft: '0', fontSize: '0.7rem', color: 'var(--muted)' }}>
              <span>0%</span><span style={{ marginLeft: 'auto' }}>← normalized share per year →</span><span>100%</span>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)', width: '100%', marginBottom: '0.25rem' }}>Legend — domain categories</span>
              {allDomains.map((domain, di) => (
                <div key={domain} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: domainColor(domain, di), flexShrink: 0 }} />
                  <span style={{ textTransform: 'capitalize' }}>{domain}</span>
                </div>
              ))}
            </div>

            {/* Fallback: if yearCategoryData is empty, show plain time series */}
            {chartYears.length === 0 && timeSeries.length > 0 && (
              <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '1rem' }}>
                ℹ️ Per-year category breakdown not yet available from the API (<code>/api/analytics/year_category</code>). Showing total document counts only.
              </p>
            )}
          </div>
        ) : timeSeries.length > 0 ? (
          /* Fallback plain bar chart if year_category endpoint missing */
          <div>
            <p style={{ color: 'var(--accent-warm)', fontSize: '0.82rem', marginBottom: '1rem', padding: '0.6rem 0.9rem', background: 'rgba(255,200,87,0.06)', borderRadius: '8px', border: '1px solid rgba(255,200,87,0.15)' }}>
              ⚠️ The <code>/api/analytics/year_category</code> endpoint isn't available yet — showing total document counts per year. Add the endpoint to enable per-domain stacking.
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '160px' }} role="img" aria-label="Bar chart of documents per year">
              {timeSeries.map(([year, count]) => {
                const maxCount = Math.max(...timeSeries.map((s) => s[1])) || 1
                const heightPct = Math.max(6, (count / maxCount) * 100)
                return (
                  <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', gap: '4px' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--muted)', marginBottom: 'auto' }}>{count}</span>
                    <div style={{ width: '100%', height: `${heightPct}%`, background: '#7ef0a8', borderRadius: '4px 4px 0 0', minHeight: '4px' }} title={`${year}: ${count}`} />
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{year}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="empty-state">{loading ? 'Loading yearly data…' : 'No yearly data available.'}</div>
        )}
      </section>

      {/* ── Section C: Word Cloud ─────────────────────────────────────────── */}
      <section className="panel" style={{ padding: '1.5rem' }}>
        <div className="section-heading" style={{ marginBottom: '1.25rem' }}>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: '0.4rem' }}>
            <span>C</span> — Term Frequency Cloud
          </div>
          <h2 style={{ marginBottom: '0.25rem' }}>What terms dominate the retrieved passages?</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Top 120 terms from the corpus, sized by frequency. Run a query in the Research tab to filter by your active search.
          </p>
        </div>
        {result ? (
          <img
            src={`/api/analytics/wordcloud_image?top_n=120&q=${encodeURIComponent(result.query)}`}
            alt={`Word cloud for query: ${result.query}`}
            style={{ width: '100%', borderRadius: '12px', maxHeight: '280px', objectFit: 'contain' }}
          />
        ) : (
          <div className="empty-state">No active query — word cloud will appear after you run a search in the Research tab.</div>
        )}
      </section>

      {/* ── Section D: Energy & Latency Telemetry ────────────────────────── */}
      <section className="panel" style={{ padding: '1.5rem' }}>
        <div className="section-heading" style={{ marginBottom: '1.25rem' }}>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: '0.4rem' }}>
            <span>D</span> — Tech Stack Energy & Latency Telemetry
          </div>
          <h2 style={{ marginBottom: '0.25rem' }}>How much energy does each pipeline stage consume?</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Wh consumed and wall-clock duration per task. Logged as you run indexing, queries, or chat sessions.
          </p>
        </div>

        {/* System specs */}
        {energyData?.system_specs && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'OS', value: energyData.system_specs.os },
              { label: 'CPU', value: energyData.system_specs.cpu },
              { label: 'GPU', value: energyData.system_specs.gpu },
              { label: 'RAM', value: energyData.system_specs.ram },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.025)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{label}</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--accent)', fontWeight: 600 }}>{value ?? '—'}</div>
              </div>
            ))}
          </div>
        )}

        {energyData?.logs?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* D1: Energy consumed per task */}
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#7ef0a8', display: 'inline-block' }} />
                Energy consumed (Wh) per task — lower is better
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {clusteredLogs.map((log: any, idx: number) => {
                  const barPct = Math.max(2, (log.energy / maxEnergy) * 100)
                  const labelText = log.count > 1 ? `${log.task} (${log.count} runs)` : log.task
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '240px 1fr 80px', gap: '0.75rem', alignItems: 'center', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={labelText}>{labelText}</span>
                      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '18px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${barPct}%`, height: '100%', background: 'linear-gradient(90deg, #7ef0a8, #5ec8ff)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ color: '#7ef0a8', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{log.energy.toFixed(5)} Wh</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* D2: Duration per task */}
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffc857', display: 'inline-block' }} />
                Wall-clock duration (s) per task
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {clusteredLogs.map((log: any, idx: number) => {
                  const barPct = Math.max(2, (log.duration / maxDuration) * 100)
                  const labelText = log.count > 1 ? `${log.task} (${log.count} runs)` : log.task
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '240px 1fr 80px', gap: '0.75rem', alignItems: 'center', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={labelText}>{labelText}</span>
                      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '18px', overflow: 'hidden' }}>
                        <div style={{ width: `${barPct}%`, height: '100%', background: 'linear-gradient(90deg, #ffc857, #ff8b7b)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ color: '#ffc857', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{log.duration.toFixed(2)}s</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* D3: CPU vs GPU power scatter / comparison */}
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#91a7ff', display: 'inline-block' }} />
                CPU util & power draw per task
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.65rem' }}>
                {clusteredLogs.map((log: any, idx: number) => {
                  const cpuFrac = Math.min(100, log.cpu_util ?? 0)
                  const cpuW    = log.cpu_w ?? 0
                  const gpuW    = log.gpu_w ?? 0
                  const labelText = log.count > 1 ? `${log.task} (${log.count} runs)` : log.task
                  return (
                    <div key={idx} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.025)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.78rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={labelText}>{labelText}</div>
                      {/* CPU util gauge */}
                      <div style={{ marginBottom: '0.35rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginBottom: '2px' }}>
                          <span>CPU util</span><span style={{ color: '#91a7ff' }}>{cpuFrac.toFixed(1)}%</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '3px', height: '6px' }}>
                          <div style={{ width: `${cpuFrac}%`, height: '100%', background: '#91a7ff', borderRadius: '3px' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', color: 'var(--muted)' }}>
                        <span>CPU <strong style={{ color: '#91a7ff' }}>{cpuW.toFixed(1)}W</strong></span>
                        <span>GPU <strong style={{ color: '#f48fb1' }}>{gpuW.toFixed(1)}W</strong></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* D4: Raw log table (collapsed detail) */}
            <details style={{ marginTop: '0.5rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: 'var(--muted)', padding: '0.5rem 0', userSelect: 'none' }}>
                ▸ Show full telemetry table ({energyData.logs.length} entries)
              </summary>
              <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--accent)' }}>
                      {['Task','Duration','CPU Util','CPU W','GPU W','Energy (Wh)'].map((h) => (
                        <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {energyData.logs.map((log: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{log.task}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#ffc857' }}>{log.duration.toFixed(2)}s</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{log.cpu_util.toFixed(1)}%</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{log.cpu_w.toFixed(1)}W</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{log.gpu_w.toFixed(1)}W</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#7ef0a8', fontWeight: 600 }}>{log.energy.toFixed(5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        ) : (
          <div className="empty-state">{loading ? 'Loading telemetry…' : 'No telemetry logged yet — run indexing or a query to populate this section.'}</div>
        )}
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

