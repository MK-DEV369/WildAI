import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bot, Database, Download, Search, ShieldCheck, Sparkles, TreePine, Users, Home, MessageSquare, Mic, MicOff, Map, Cpu } from 'lucide-react'
import cloud from 'd3-cloud'
import * as d3 from 'd3'
import { useEffect, useState, useMemo, useRef } from 'react'
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
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)

  return (
    <>
      {parts.map((part, index) => {
        const boldMatch = part.match(/^\*\*(.+)\*\*$/)
        if (boldMatch) {
          return <strong key={`${part}-${index}`}>{boldMatch[1]}</strong>
        }
        const italicMatch = part.match(/^\*(.+)\*$/)
        if (italicMatch) {
          return <em key={`${part}-${index}`}>{italicMatch[1]}</em>
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

  // Related conservation, location, and animal terms to highlight
  const relatedTerms = [
    "captive breeding", "breeding program", "breeding programs", 
    "rescue and rehabilitation", "habitat restoration",
    "public education", "endangered species", "critically endangered",
    "biological park", "biological reserve", "wildlife sanctuary", 
    "national park", "national parks", "protected area", "protected areas",
    "wildlife park", "zoological park", "zoological gardens", "conservation", 
    "rescue", "rehabilitation", "education", "research", "threatened", "endangered",
    "vulnerable", "extinct", "safari", "biodiversity", "fauna", "flora", 
    "animal", "animals", "species", "zoo", "zoos", "policy", "policies", 
    "act", "rules", "guidelines", "treaty", "treaties", "bengaluru", 
    "bangalore", "karnataka", "india", "indian", "giraffe", "giraffes"
  ]

  relatedTerms.forEach(term => {
    const termWords = term.split(/\s+/)
    const pattern = termWords.map(escapeRegex).join('\\s+')
    patterns.push(pattern)
  })

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

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'document' | 'keyword';
  title?: string;
  text?: string;
  hit?: any;
  score?: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  type: 'doc-term' | 'doc-doc';
}

function extractTFIDFKeywords(hits: any[], maxKeywords = 12) {
  const stopwords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is",
    "it", "of", "on", "or", "that", "the", "to", "was", "what", "when", "where", "which",
    "who", "why", "with", "this", "these", "their", "they", "them", "from", "with", "have",
    "more", "some", "such", "than", "then", "there", "those", "upon", "were", "what", "when",
    "where", "while", "whom", "will", "would", "about", "above", "after", "again", "against",
    "all", "am", "any"
  ]);

  const docs = hits.map(hit => {
    const text = hit.text.toLowerCase();
    const words = text.match(/[a-z]{4,}/g) || [];
    const tokens: string[] = [];
    words.forEach((w: string) => {
      if (!stopwords.has(w)) {
        tokens.push(w);
      }
    });
    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i];
      const w2 = words[i+1];
      if (!stopwords.has(w1) && !stopwords.has(w2)) {
        tokens.push(`${w1} ${w2}`);
      }
    }
    return { hit, tokens };
  });

  const tfs: Record<string, number>[] = docs.map(d => {
    const counts: Record<string, number> = {};
    d.tokens.forEach(t => {
      counts[t] = (counts[t] || 0) + 1;
    });
    const total = d.tokens.length || 1;
    const tf: Record<string, number> = {};
    Object.entries(counts).forEach(([term, count]) => {
      tf[term] = count / total;
    });
    return tf;
  });

  const idfs: Record<string, number> = {};
  const N = hits.length;
  const docContainingTerm: Record<string, number> = {};
  docs.forEach(d => {
    const uniqueTerms = new Set(d.tokens);
    uniqueTerms.forEach(t => {
      docContainingTerm[t] = (docContainingTerm[t] || 0) + 1;
    });
  });
  Object.entries(docContainingTerm).forEach(([term, count]) => {
    idfs[term] = Math.log(1 + (N / count));
  });

  const tfidfs: { term: string; score: number; docId: string; count: number }[] = [];
  docs.forEach((d, idx) => {
    const tfMap = tfs[idx];
    Object.entries(tfMap).forEach(([term, tfVal]) => {
      const idfVal = idfs[term] || 0;
      const count = d.tokens.filter(t => t === term).length;
      tfidfs.push({
        term,
        score: tfVal * idfVal,
        docId: d.hit.chunk_id,
        count
      });
    });
  });

  const termScores: Record<string, { score: number; docs: { docId: string; score: number; count: number }[] }> = {};
  tfidfs.forEach(item => {
    if (!termScores[item.term]) {
      termScores[item.term] = { score: 0, docs: [] };
    }
    termScores[item.term].score += item.score;
    termScores[item.term].docs.push({ docId: item.docId, score: item.score, count: item.count });
  });

  return Object.entries(termScores)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, maxKeywords)
    .map(([term, data]) => ({ term, ...data }));
}

function SemanticNetworkGraph({ hits, query, onFullscreen, isFullscreen }: { hits: any[], query: string, onFullscreen?: () => void, isFullscreen?: boolean }) {
  const [viewMode, setViewMode] = useState<'radial' | 'force'>('force');
  const [hoveredInfo, setHoveredInfo] = useState<string>('Hover nodes or connections to explore semantic relations.');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const topHits = useMemo(() => hits.slice(0, 5), [hits]);

  // Compute Radial Data
  const radialData = useMemo(() => {
    const topTerms = ["conservation", "species", "forest", "reserve", "wildlife", "habitats", "sanctuaries", "planning"];
    const cx = 150;
    const cy = 130;

    const docNodes = topHits.slice(0, 4).map((hit, idx) => {
      const angle = (idx * 2 * Math.PI) / Math.min(topHits.length, 4);
      const r = 50;
      return {
        id: hit.chunk_id,
        title: hit.title.length > 25 ? hit.title.slice(0, 22) + "..." : hit.title,
        abbr: `Doc ${idx + 1}`,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        hit
      };
    });

    const termNodes = topTerms.map((term, idx) => {
      const angle = (idx * 2 * Math.PI) / topTerms.length;
      const r = 100;
      return {
        name: term,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      };
    });

    const edges: any[] = [];
    docNodes.forEach(doc => {
      const docText = doc.hit.text.toLowerCase();
      termNodes.forEach(term => {
        const termRegex = new RegExp(term.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
        const count = (docText.match(termRegex) || []).length;
        if (count > 0) {
          edges.push({
            from: doc,
            to: term,
            weight: Math.min(count, 5)
          });
        }
      });
    });

    return { docNodes, termNodes, edges, cx, cy };
  }, [topHits]);

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Compute Force Directed Data (Neo4j Style)
  useEffect(() => {
    if (viewMode !== 'force' || !svgRef.current || topHits.length === 0) return;

    const width = 600;
    const height = 480;

    // 1. Extract TF-IDF keywords
    const topKeywords = extractTFIDFKeywords(topHits, isFullscreen ? 16 : 10);

    // 2. Build Nodes
    const docNodes: GraphNode[] = topHits.map((hit, idx) => ({
      id: `doc_${hit.chunk_id}`,
      label: `Doc ${idx + 1}`,
      title: hit.title,
      text: hit.text,
      type: 'document',
      hit
    }));

    const keywordNodes: GraphNode[] = topKeywords.map(kw => ({
      id: `term_${kw.term}`,
      label: kw.term,
      type: 'keyword',
      score: kw.score
    }));

    const nodes: GraphNode[] = [...docNodes, ...keywordNodes];

    // 3. Build Links
    const links: GraphLink[] = [];

    // Document to Keyword links (TF-IDF connections)
    topKeywords.forEach(kw => {
      kw.docs.forEach(d => {
        links.push({
          source: `doc_${d.docId}`,
          target: `term_${kw.term}`,
          value: d.count,
          type: 'doc-term'
        });
      });
    });

    // Document to Document links (shared keyword connections)
    for (let i = 0; i < docNodes.length; i++) {
      for (let j = i + 1; j < docNodes.length; j++) {
        const docA = topHits[i];
        const docB = topHits[j];
        
        // Find shared keywords
        const shared = topKeywords.filter(kw => 
          kw.docs.some(d => d.docId === docA.chunk_id) && 
          kw.docs.some(d => d.docId === docB.chunk_id)
        );

        if (shared.length >= 2) {
          links.push({
            source: `doc_${docA.chunk_id}`,
            target: `doc_${docB.chunk_id}`,
            value: shared.length,
            type: 'doc-doc'
          });
        }
      }
    }

    // 4. Initialize D3 SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Add filter defs for glow
    const defs = svg.append('defs');
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'blur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const mainGroup = svg.append('g').attr('class', 'main-group');

    // Add Zoom behavior
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.4, 4])
      .on('zoom', (event: any) => {
        mainGroup.attr('transform', event.transform);
      });
    svg.call(zoomBehavior as any);

    // Initial Zoom transform to fit center
    svg.call(zoomBehavior.transform as any, d3.zoomIdentity.translate(0, 0).scale(1));

    // Center coordinates
    const cx = width / 2;
    const cy = height / 2;

    // 5. Setup Physics Simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id((d: any) => d.id).distance((d: any) => d.type === 'doc-doc' ? 140 : 80))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(cx, cy))
      .force('collide', d3.forceCollide<GraphNode>().radius((d: any) => d.type === 'document' ? 26 : 16))
      .alphaDecay(0.04);

    // 6. Draw Links
    const link = mainGroup.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => d.type === 'doc-doc' ? '#f59e0b' : 'rgba(126,240,168,0.25)')
      .attr('stroke-width', (d: any) => d.type === 'doc-doc' ? 1.5 : Math.min(d.value * 0.75 + 1, 5))
      .attr('stroke-dasharray', (d: any) => d.type === 'doc-doc' ? '4,4' : 'none')
      .attr('opacity', 0.6)
      .style('transition', 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s');

    // 7. Draw Nodes
    const node = mainGroup.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer');

    // Drag behavior helper
    const dragBehavior = d3.drag<any, any>()
      .on('start', (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event: any, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0);
        // Keep pinned
      });

    node.call(dragBehavior);

    // Node representation
    node.each(function(this: any, d: any) {
      const g = d3.select(this);
      if (d.type === 'document') {
        // Document Nodes: Beautiful glowing rings
        g.append('circle')
          .attr('r', 16)
          .attr('fill', '#07120e')
          .attr('stroke', '#7ef0a8')
          .attr('stroke-width', 2)
          .style('box-shadow', '0 0 10px rgba(126,240,168,0.5)');

        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '.3em')
          .attr('fill', '#7ef0a8')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
          .attr('font-weight', 'bold')
          .text(d.label);
      } else {
        // Keyword Nodes: Blue badges
        g.append('circle')
          .attr('r', 6)
          .attr('fill', '#050f14')
          .attr('stroke', '#7ebaf0')
          .attr('stroke-width', 1.5);

        g.append('text')
          .attr('dx', 10)
          .attr('dy', '.35em')
          .attr('fill', '#e9fff4')
          .attr('font-size', '9px')
          .attr('font-family', 'sans-serif')
          .style('text-shadow', '0 1px 3px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)')
          .text(d.label);
      }
    });

    // 8. Interaction events
    node.on('mouseover', function(event: any, d: any) {
      const connectedNodeIds = new Set<string>();
      connectedNodeIds.add(d.id);

      links.forEach((l: any) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (sId === d.id) connectedNodeIds.add(tId);
        if (tId === d.id) connectedNodeIds.add(sId);
      });

      // Highlight links
      link
        .attr('opacity', (l: any) => {
          const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return (sId === d.id || tId === d.id) ? 1.0 : 0.05;
        })
        .attr('stroke', (l: any) => {
          const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
          if (sId === d.id || tId === d.id) {
            return l.type === 'doc-doc' ? '#fbbf24' : '#10b981';
          }
          return l.type === 'doc-doc' ? '#f59e0b' : 'rgba(126,240,168,0.25)';
        })
        .attr('stroke-width', (l: any) => {
          const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return (sId === d.id || tId === d.id) ? 3 : 1;
        });

      // Highlight nodes
      node.attr('opacity', (n: any) => connectedNodeIds.has(n.id) ? 1.0 : 0.15);

      // Status Bar Text
      if (d.type === 'document') {
        setHoveredInfo(`Document node [${d.label}]: "${d.title}" (Click to select & pin. Double-click to unpin.)`);
      } else {
        const occurrences = links.filter((l: any) => {
          const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return tId === d.id;
        }).length;
        setHoveredInfo(`TF-IDF Keyword: "${d.label}" (Found in ${occurrences} documents. Double-click to unpin.)`);
      }
    });

    node.on('mouseout', function() {
      link
        .attr('opacity', 0.6)
        .attr('stroke', (l: any) => l.type === 'doc-doc' ? '#f59e0b' : 'rgba(126,240,168,0.25)')
        .attr('stroke-width', (l: any) => l.type === 'doc-doc' ? 1.5 : Math.min(l.value * 0.75 + 1, 5));
      node.attr('opacity', 1.0);
      setHoveredInfo('Hover nodes or connections to explore semantic relations.');
    });

    node.on('dblclick', function(event: any, d: any) {
      d.fx = null;
      d.fy = null;
      simulation.alpha(0.3).restart();
      setHoveredInfo(`Unpinned node "${d.label}"`);
    });

    // 9. Simulation Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => (d.source as any).x)
        .attr('y1', (d: any) => (d.source as any).y)
        .attr('x2', (d: any) => (d.target as any).x)
        .attr('y2', (d: any) => (d.target as any).y);

      node.attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [hits, viewMode, isFullscreen, topHits]);

  return (
    <div className="semantic-graph-container" style={{ position: 'relative', width: '100%', background: 'rgba(5, 12, 10, 0.45)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(126,240,168,0.12)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {viewMode === 'force' ? 'Neo4j RAG Knowledge Graph' : 'Semantic Association Network'}
          </div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(126,240,168,0.15)' }}>
            <button
              type="button"
              onClick={() => setViewMode('force')}
              style={{ background: viewMode === 'force' ? 'var(--accent)' : 'transparent', color: viewMode === 'force' ? '#05100e' : '#e9fff4', fontSize: '0.62rem', border: 'none', padding: '0.15rem 0.35rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            >
              Knowledge Graph
            </button>
            <button
              type="button"
              onClick={() => setViewMode('radial')}
              style={{ background: viewMode === 'radial' ? 'var(--accent)' : 'transparent', color: viewMode === 'radial' ? '#05100e' : '#e9fff4', fontSize: '0.62rem', border: 'none', padding: '0.15rem 0.35rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            >
              Radial Network
            </button>
          </div>
        </div>
        {!isFullscreen && onFullscreen && (
          <button 
            type="button"
            onClick={onFullscreen} 
            className="ghost-button" 
            style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem', minHeight: 'auto', borderRadius: '6px', border: '1px solid rgba(126,240,168,0.2)' }}
          >
            Maximize
          </button>
        )}
      </div>

      {viewMode === 'force' ? (
        <div style={{ width: '100%', position: 'relative', overflow: 'hidden', background: '#050c09', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
          <svg 
            ref={svgRef} 
            width="100%" 
            height="100%"
            viewBox="0 0 600 480"
            style={{ display: 'block', margin: '0 auto', minHeight: isFullscreen ? '72vh' : '260px', maxHeight: isFullscreen ? '78vh' : '260px' }}
          />
          <div style={{ position: 'absolute', top: '8px', left: '8px', padding: '0.2rem 0.4rem', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.58rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '2px', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', background: '#7ef0a8', borderRadius: '50%', display: 'inline-block' }} />
              <span>Document Nodes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', background: '#7ebaf0', borderRadius: '50%', display: 'inline-block' }} />
              <span>TF-IDF Concept Keywords</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '1.5px', background: '#f59e0b', borderStyle: 'dashed', display: 'inline-block' }} />
              <span>Shared Keyword Corridors</span>
            </div>
          </div>
        </div>
      ) : (
        <svg 
          width={isFullscreen ? "100%" : "300"} 
          height={isFullscreen ? "100%" : "260"} 
          viewBox="0 0 300 260" 
          style={{ display: 'block', margin: '0 auto', maxHeight: isFullscreen ? '78vh' : '260px', width: isFullscreen ? 'auto' : undefined }}
        >
          {radialData.edges.map((edge, idx) => {
            const isHighlighted = hoveredNode === edge.from.id || hoveredNode === edge.to.name;
            const isActiveGroup = hoveredNode === null || isHighlighted;
            return (
              <line
                key={idx}
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
                stroke={isHighlighted ? 'var(--accent)' : 'rgba(126,240,168,0.15)'}
                strokeWidth={edge.weight * 0.75}
                opacity={isActiveGroup ? 0.8 : 0.15}
                style={{ transition: 'all 0.25s ease' }}
              />
            );
          })}

          {radialData.docNodes.map((doc) => {
            const isHighlighted = hoveredNode === doc.id;
            const isActiveGroup = hoveredNode === null || isHighlighted;
            return (
              <line
                key={`q-${doc.id}`}
                x1={radialData.cx}
                y1={radialData.cy}
                x2={doc.x}
                y2={doc.y}
                stroke={isHighlighted ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}
                strokeWidth={2}
                strokeDasharray="2,2"
                opacity={isActiveGroup ? 0.6 : 0.15}
              />
            );
          })}

          <circle
            cx={radialData.cx}
            cy={radialData.cy}
            r={14}
            fill="rgba(7, 18, 14, 0.9)"
            stroke="var(--accent)"
            strokeWidth="2"
          />
          <text
            x={radialData.cx}
            y={radialData.cy + 3}
            fill="var(--accent)"
            fontSize="8px"
            fontWeight="bold"
            textAnchor="middle"
            style={{ fontFamily: 'monospace' }}
          >
            RAG
          </text>

          {radialData.docNodes.map((doc) => {
            const isHighlighted = hoveredNode === doc.id;
            const isActiveGroup = hoveredNode === null || isHighlighted;
            return (
              <g
                key={doc.id}
                onMouseEnter={() => {
                  setHoveredNode(doc.id);
                  setHoveredInfo(`Document [${doc.abbr}]: "${doc.hit.title}"`);
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  setHoveredInfo('Hover nodes or connections to explore semantic relations.');
                }}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={doc.x}
                  cy={doc.y}
                  r={9}
                  fill="rgba(7, 18, 14, 0.95)"
                  stroke={isHighlighted ? 'var(--accent)' : 'rgba(255, 255, 255, 0.4)'}
                  strokeWidth={isHighlighted ? 2 : 1.2}
                  opacity={isActiveGroup ? 1 : 0.25}
                  style={{ transition: 'all 0.2s' }}
                />
                <text
                  x={doc.x}
                  y={doc.y + 3}
                  fill={isHighlighted ? 'var(--accent)' : '#ffffff'}
                  fontSize="7px"
                  textAnchor="middle"
                  opacity={isActiveGroup ? 1 : 0.25}
                  style={{ fontFamily: 'monospace', pointerEvents: 'none' }}
                >
                  {doc.abbr}
                </text>
              </g>
            );
          })}

          {radialData.termNodes.map((term) => {
            const isHighlighted = hoveredNode === term.name;
            const isActiveGroup = hoveredNode === null || isHighlighted;
            const isConnected = radialData.edges.some(e => e.to.name === term.name && e.from.id === hoveredNode);
            const finalHighlight = isHighlighted || isConnected;

            return (
              <g
                key={term.name}
                onMouseEnter={() => {
                  setHoveredNode(term.name);
                  setHoveredInfo(`Term association: "${term.name}"`);
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  setHoveredInfo('Hover nodes or connections to explore semantic relations.');
                }}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={term.x}
                  cy={term.y}
                  r={3}
                  fill={finalHighlight ? 'var(--accent)' : 'rgba(126,240,168,0.4)'}
                  opacity={isActiveGroup || isConnected ? 1 : 0.25}
                  style={{ transition: 'all 0.2s' }}
                />
                <text
                  x={term.x + (term.x > radialData.cx ? 6 : -6)}
                  y={term.y + 3}
                  fill={finalHighlight ? 'var(--accent)' : '#e9fff4'}
                  fontSize="8px"
                  textAnchor={term.x > radialData.cx ? 'start' : 'end'}
                  opacity={isActiveGroup || isConnected ? 1 : 0.25}
                  style={{ transition: 'all 0.2s', fontFamily: 'sans-serif', pointerEvents: 'none' }}
                >
                  {term.name}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <div style={{ minHeight: '34px', fontSize: '0.72rem', background: 'rgba(0,0,0,0.25)', padding: '0.45rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', color: 'var(--muted)', lineHeight: '1.4' }}>
        <span>{hoveredInfo}</span>
      </div>
    </div>
  );
}

function IndiaMap({ 
  onSelectState, 
  selectedState
}: { 
  onSelectState: (state: string | null) => void, 
  selectedState: string | null
}) {
  const CONSERVATION_STATES = [
    { id: 'KA', name: 'Karnataka', label: 'Karnataka (Zoos & Western Ghats)', latlng: [15.3173, 75.7139] as [number, number] },
    { id: 'AS', name: 'Assam', label: 'Assam (Forestry & Rhinos)', latlng: [26.2006, 92.9376] as [number, number] },
    { id: 'MP', name: 'Madhya Pradesh', label: 'Madhya Pradesh (Tiger Reserves)', latlng: [22.9734, 78.6569] as [number, number] },
    { id: 'GJ', name: 'Gujarat', label: 'Gujarat (Gir Lions & Coastal)', latlng: [22.2587, 71.1924] as [number, number] },
    { id: 'UK', name: 'Uttarakhand', label: 'Uttarakhand (Himalayan Ecology)', latlng: [30.0668, 79.0193] as [number, number] },
    { id: 'WB', name: 'West Bengal', label: 'West Bengal (Sundarbans Wetlands)', latlng: [22.9868, 87.8550] as [number, number] },
    { id: 'DL', name: 'Delhi', label: 'Delhi (CZA & National Policies)', latlng: [28.7041, 77.1025] as [number, number] },
    { id: 'KL', name: 'Kerala', label: 'Kerala (Periyar & Biodiversity)', latlng: [10.8505, 76.2711] as [number, number] },
    { id: 'TN', name: 'Tamil Nadu', label: 'Tamil Nadu (Western Ghats & Marine)', latlng: [11.1271, 78.6569] as [number, number] },
    { id: 'MH', name: 'Maharashtra', label: 'Maharashtra (Western Ghats & Tadoba)', latlng: [19.7515, 75.7139] as [number, number] }
  ]

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [leafletLoaded, setLeafletLoaded] = useState(false)

  // 1. Load Leaflet CDN Assets
  useEffect(() => {
    // Check if css is already loaded
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Check if script is already loaded
    if ((window as any).L) {
      setLeafletLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = () => setLeafletLoaded(true)
    document.head.appendChild(script)
  }, [])

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!leafletLoaded || !containerRef.current) return

    const L = (window as any).L
    if (!L) return

    // If map already initialized, clear it
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    // Initialize map
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([21.1458, 79.0882], 4) // Centered on Nagpur, India

    mapRef.current = map

    // Add dark tiled theme for cool cyberpunk style matching the console UI
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map)

    L.control.zoom({ position: 'topright' }).addTo(map)

    // Add markers
    const markers: any[] = []
    CONSERVATION_STATES.forEach(state => {
      const isActive = selectedState === state.name
      
      // Create a colored circle marker for each state
      const markerColor = isActive ? '#7ef0a8' : '#a8f07e'
      const marker = L.circleMarker(state.latlng, {
        radius: isActive ? 12 : 8,
        fillColor: markerColor,
        color: '#ffffff',
        weight: isActive ? 3 : 1.5,
        opacity: 0.9,
        fillOpacity: 0.6
      }).addTo(map)

      marker.bindTooltip(state.label, {
        direction: 'top',
        offset: [0, -5]
      })

      marker.on('click', () => {
        onSelectState(isActive ? null : state.name)
      })

      markers.push({ name: state.name, marker })
    })

    markersRef.current = markers

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [leafletLoaded])

  // 3. Dynamic styling updates when selectedState changes
  useEffect(() => {
    if (!mapRef.current) return
    markersRef.current.forEach(({ name, marker }) => {
      const isActive = selectedState === name
      const markerColor = isActive ? '#7ef0a8' : '#a8f07e'
      marker.setStyle({
        radius: isActive ? 12 : 8,
        fillColor: markerColor,
        weight: isActive ? 3 : 1.5
      })
    })
  }, [selectedState])

  return (
    <div className="india-map-wrapper" style={{ position: 'relative', width: '100%', maxWidth: '300px', margin: '0 auto', background: 'rgba(5, 12, 10, 0.5)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(126,240,168,0.1)' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.5rem', textAlign: 'center', letterSpacing: '0.05em' }}>
        INTERACTIVE CONSERVATION MAP
      </div>
      
      {/* Map container */}
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '240px', 
          borderRadius: '12px', 
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#0d1512',
          overflow: 'hidden' 
        }} 
      />

      {/* Active state description */}
      <div style={{ minHeight: '38px', marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.74rem', textAlign: 'center' }}>
        {selectedState ? (
          <span>
            Filtering by: <strong style={{ color: 'var(--accent)' }}>{selectedState}</strong> (Click marker to clear)
          </span>
        ) : (
          <span style={{ color: 'var(--muted)' }}>Click map markers to apply geographic filter.</span>
        )}
      </div>
    </div>
  )
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
  selectedState,
  setSelectedState,
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
  selectedState: string | null
  setSelectedState: (state: string | null) => void
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

  // AI Image generation states
  const [imageSource, setImageSource] = useState<'default' | 'ai'>('default')
  const [aiImageBase64, setAiImageBase64] = useState<string | null>(null)
  const [aiImageLoading, setAiImageLoading] = useState(false)

  // Geographic and citation states
  const [showMap, setShowMap] = useState(false)
  const [hoveredCitation, setHoveredCitation] = useState<{
    x: number;
    y: number;
    title: string;
    text: string;
    source: string;
    year?: number | null;
  } | null>(null)
  const [fullscreenVisual, setFullscreenVisual] = useState<'wordcloud' | 'semantic' | null>(null)

  const renderLineContent = (lineText: string, hitsList: any[]) => {
    if (!hitsList || hitsList.length === 0) return renderInlineMarkdown(lineText)
    
    const regex = /\[([^\]]+)\]/g
    const parts: JSX.Element[] = []
    let lastIndex = 0
    let match
    
    while ((match = regex.exec(lineText)) !== null) {
      const matchIndex = match.index
      const bracketContent = match[1]
      
      if (matchIndex > lastIndex) {
        parts.push(
          <span key={`text-prefix-${matchIndex}`}>
            {renderInlineMarkdown(lineText.slice(lastIndex, matchIndex))}
          </span>
        )
      }
      
      let matchedHit = null
      const num = parseInt(bracketContent, 10)
      if (!isNaN(num) && num > 0 && num <= hitsList.length) {
        matchedHit = hitsList[num - 1]
      } else {
        const searchStr = bracketContent.toLowerCase()
        matchedHit = hitsList.find(h => 
          (h.title && h.title.toLowerCase().includes(searchStr)) ||
          (h.source && h.source.toLowerCase().includes(searchStr)) ||
          (h.url && h.url.toLowerCase().includes(searchStr))
        )
      }
      
      if (matchedHit) {
        parts.push(
          <span
            key={`citation-${matchIndex}`}
            onClick={() => onViewDocument(matchedHit)}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              setHoveredCitation({
                x: rect.left,
                y: rect.bottom,
                title: matchedHit.title,
                text: matchedHit.text,
                source: matchedHit.source,
                year: matchedHit.year
              })
            }}
            onMouseLeave={() => setHoveredCitation(null)}
            style={{
              color: 'var(--accent)',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0 0.25rem',
              margin: '0 0.1rem',
              background: 'rgba(126,240,168,0.1)',
              border: '1px solid rgba(126,240,168,0.35)',
              borderRadius: '4px',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              transition: 'all 0.2s',
            }}
          >
            [{bracketContent}]
          </span>
        )
      } else {
        parts.push(
          <span key={`bracket-plain-${matchIndex}`}>
            [{bracketContent}]
          </span>
        )
      }
      
      lastIndex = regex.lastIndex
    }
    
    if (lastIndex < lineText.length) {
      parts.push(
        <span key={`text-suffix-${lastIndex}`}>
          {renderInlineMarkdown(lineText.slice(lastIndex))}
        </span>
      )
    }
    
    return <>{parts}</>
  }

  const renderMessageWithCitations = (text: string, hitsList: any[]) => {
    const lines = text.split(/\r?\n/)
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {lines.map((line, lineIdx) => {
          const trimmed = line.trim()
          if (!trimmed) {
            return <div key={lineIdx} style={{ height: '0.4rem' }} />
          }
          
          // Check if it's a bullet point
          if (/^[*-•]\s+/.test(trimmed)) {
            const bulletText = trimmed.replace(/^[*-•]\s+/, '')
            return (
              <div key={lineIdx} style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', margin: '0.15rem 0' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 'bold', userSelect: 'none' }}>•</span>
                <span style={{ flex: 1 }}>{renderLineContent(bulletText, hitsList)}</span>
              </div>
            )
          }
          
          return (
            <p key={lineIdx} style={{ margin: '0.15rem 0', lineHeight: '1.5' }}>
              {renderLineContent(line, hitsList)}
            </p>
          )
        })}
      </div>
    )
  }

  const triggerAIImageGeneration = async (queryText: string) => {
    if (!queryText) return
    setAiImageLoading(true)
    setAiImageBase64(null)
    try {
      const prompt = `A professional, stunning, highly detailed wildlife or conservation concept illustration of: "${queryText}". High quality, 8k resolution, photorealistic.`
      const response = await fetch('/api/generate_ai_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      if (!response.ok) {
        throw new Error(`Server returned error status: ${response.status}`)
      }
      const data = await response.json()
      if (data.image_base64) {
        setAiImageBase64(data.image_base64)
      } else {
        throw new Error(data.error || 'No image data returned')
      }
    } catch (e) {
      console.error("Failed to generate AI image:", e)
    } finally {
      setAiImageLoading(false)
    }
  }

  useEffect(() => {
    if (imageSource === 'ai' && result?.query && !aiImageBase64 && !aiImageLoading) {
      void triggerAIImageGeneration(result.query)
    }
  }, [imageSource, result?.query])

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
    if (imageSource === 'ai') {
      void triggerAIImageGeneration(result.query)
    }
    try {
      const payload = {
        query: selectedState ? `${result.query} in ${selectedState}` : result.query,
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
        if (imageSource === 'ai') {
          void triggerAIImageGeneration(result.query)
        }
        try {
          const payload = {
            query: selectedState ? `${result.query} in ${selectedState}` : result.query,
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

  const visibleHits = useMemo(() => {
    if (!selectedState) return sortedHits
    return sortedHits.filter(hit => {
      const matchText = `${hit.title} ${hit.text} ${hit.category} ${hit.source} ${(hit.tags || []).join(' ')}`.toLowerCase()
      return matchText.includes(selectedState.toLowerCase())
    })
  }, [sortedHits, selectedState])

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
        query: selectedState ? `${result.query} in ${selectedState}` : result.query,
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
        ai_image_base64: imageSource === 'ai' ? aiImageBase64 : null,
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
                      {m.who === 'user' ? m.text : renderMessageWithCitations(m.text, visibleHits)}
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
              color: 'var(--muted)',
              flexWrap: 'nowrap'
            }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none', margin: 0, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={autoRead}
                    onChange={(e) => setAutoRead(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: 'auto', margin: 0 }}
                  />
                  <span>Auto-read replies</span>
                </label>
              </div>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
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
                  <div className="voice-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
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

            <div style={{ marginTop: '0.75rem' }}>
              <button 
                type="button"
                onClick={() => setShowMap(!showMap)} 
                className="secondary-button"
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
              >
                <Map size={14} /> {showMap ? 'Hide geographic filter map' : 'Show geographic filter map'}
              </button>
            </div>
            
            {showMap && (
              <div style={{ marginTop: '0.75rem' }}>
                <IndiaMap selectedState={selectedState} onSelectState={setSelectedState} />
              </div>
            )}

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
                  {selectedState && (
                    <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(126,240,168,0.06)', border: '1px solid rgba(126,240,168,0.2)', borderRadius: '10px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Geographic filter: <strong style={{ color: 'var(--accent)' }}>{selectedState}</strong></span>
                        <button 
                          onClick={() => setSelectedState(null)} 
                          style={{ background: 'transparent', border: 0, color: '#ff8888', cursor: 'pointer', fontSize: '0.72rem', textDecoration: 'underline', padding: 0 }}
                        >
                          Clear Map Filter
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.8rem', color: 'var(--muted)', fontSize: '0.7rem' }}>
                        <span>Matched: <strong>{visibleHits.length} passages</strong></span>
                        {visibleHits.length > 0 && (
                          <span>Max Similarity: <strong>{Math.round(Math.max(...visibleHits.map(h => h.score)) * 100)}%</strong></span>
                        )}
                      </div>
                    </div>
                  )}
                  {visibleHits.length > 0 ? visibleHits.map((hit, index) => (
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
                          {hit.year && <span className="year-badge" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>Year: {hit.year}</span>}
                        </div>
                        <strong className="score-badge" style={{ fontSize: '0.8rem' }}>{Math.round(hit.score * 100)}%</strong>
                      </div>
                      <h4 style={{ fontSize: '0.92rem', margin: '0 0 0.35rem', fontWeight: 600 }}>{hit.title}</h4>
                      <p className="result-text" style={{ fontSize: '0.82rem', color: 'rgba(233, 255, 244, 0.8)', margin: '0 0 0.5rem', lineHeight: '1.5' }}>
                        {highlightText(hit.text, result?.query ?? '')}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--muted)' }}>
                        <span>Source: {hit.source}</span>
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

                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.8rem', marginTop: '0.2rem', fontSize: '0.74rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'rgba(233,255,244,0.85)' }}>
                              <input 
                                type="checkbox" 
                                checked={includeAnimal} 
                                onChange={(e) => setIncludeAnimal(e.target.checked)}
                                style={{ accentColor: 'var(--accent)' }}
                              />
                              Species Photo
                            </label>
                            {includeAnimal && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.4rem' }}>
                                <span style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>Source:</span>
                                <select
                                  value={imageSource}
                                  onChange={(e) => setImageSource(e.target.value as any)}
                                  className="console-select"
                                  style={{ padding: '0.15rem 0.3rem', fontSize: '0.7rem', background: '#07120e', border: '1px solid rgba(126,240,168,0.2)', borderRadius: '4px', color: '#e9fff4' }}
                                >
                                  <option value="default">Local / Wiki</option>
                                  <option value="ai">AI Gen (Clipdrop)</option>
                                </select>
                              </div>
                            )}
                          </div>
                          
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
                          
                          {includeAnimal && imageSource === 'ai' && (
                            <div className="ai-image-preview-container" style={{ margin: '0.5rem 0', borderRadius: '12px', overflow: 'hidden', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(126,240,168,0.1)', padding: '0.5rem', textAlign: 'center' }}>
                              {aiImageLoading ? (
                                <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--accent)', fontSize: '0.75rem' }}>
                                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                                    <span className="dot-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                                    <span className="dot-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animationDelay: '0.2s' }} />
                                    <span className="dot-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animationDelay: '0.4s' }} />
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'monospace' }}>GENERATING AI ILLUSTRATION VIA CLIPDROP...</span>
                                </div>
                              ) : aiImageBase64 ? (
                                <>
                                  <img 
                                    src={aiImageBase64} 
                                    alt="AI Generated Species Illustration" 
                                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(126,240,168,0.15)' }} 
                                  />
                                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.35rem', fontStyle: 'italic' }}>
                                    Figure 1: AI Generated Illustration (Clipdrop)
                                  </span>
                                </>
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontStyle: 'italic' }}>Clipdrop is ready to generate an illustration. Click "Update Summary" to run.</span>
                              )}
                            </div>
                          )}
                          
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
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {result ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', width: '100%', alignItems: 'start' }}>
                      <div className="wordcloud-shell" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(5, 12, 10, 0.4)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(126,240,168,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em' }}>
                            DENSE PHRASE WORD CLOUD
                          </div>
                          <button 
                            type="button"
                            onClick={() => setFullscreenVisual('wordcloud')} 
                            className="ghost-button" 
                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem', minHeight: 'auto', borderRadius: '6px', border: '1px solid rgba(126,240,168,0.2)' }}
                          >
                            Maximize
                          </button>
                        </div>
                        <img
                          src={`/api/analytics/wordcloud_image?top_n=120&q=${encodeURIComponent(selectedState ? `${result.query} in ${selectedState}` : result.query)}`}
                          className="wordcloud-image"
                          alt="Word Cloud"
                          style={{ width: '100%', borderRadius: '12px', border: '1px solid rgba(126,240,168,0.1)', objectFit: 'contain' }}
                        />
                      </div>
                      <SemanticNetworkGraph hits={visibleHits} query={result.query} onFullscreen={() => setFullscreenVisual('semantic')} />
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>Analytics will populate here after you run a query.</div>
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
      {hoveredCitation && (
        <div style={{
          position: 'fixed',
          top: hoveredCitation.y + 8,
          left: Math.min(window.innerWidth - 320, hoveredCitation.x),
          width: '300px',
          background: 'rgba(7, 18, 14, 0.96)',
          border: '1px solid var(--accent)',
          borderRadius: '12px',
          padding: '0.75rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 9999,
          pointerEvents: 'none',
          backdropFilter: 'blur(10px)',
          fontSize: '0.78rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, marginBottom: '0.2rem' }}>
            <span>{hoveredCitation.source}</span>
            {hoveredCitation.year && <span>{hoveredCitation.year}</span>}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.35rem', whiteSpace: 'normal', lineHeight: '1.3' }}>
            {hoveredCitation.title}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', maxHeight: '110px', overflowY: 'auto', lineHeight: '1.4', padding: '0.35rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
            "{hoveredCitation.text.slice(0, 320)}..."
          </div>
        </div>
      )}
      {fullscreenVisual === 'wordcloud' && (
        <div className="document-modal-overlay" onClick={() => setFullscreenVisual(null)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(5, 12, 10, 0.97)', backdropFilter: 'blur(12px)' }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: '96vw', height: '94vh', maxWidth: 'none', display: 'flex', flexDirection: 'column', padding: '1.5rem', position: 'relative', background: '#0b1612', border: '1px solid rgba(126,240,168,0.2)', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>DENSE PHRASE WORD CLOUD</h3>
              <button 
                onClick={() => setFullscreenVisual(null)} 
                className="ghost-button" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.76rem', borderRadius: '8px' }}
              >
                Close
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
              <img
                src={`/api/analytics/wordcloud_image?top_n=150&q=${encodeURIComponent(selectedState ? `${result?.query || ''} in ${selectedState}` : result?.query || '')}`}
                style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px', objectFit: 'contain' }}
                alt="Word Cloud Fullscreen"
              />
            </div>
          </div>
        </div>
      )}

      {fullscreenVisual === 'semantic' && (
        <div className="document-modal-overlay" onClick={() => setFullscreenVisual(null)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(5, 12, 10, 0.97)', backdropFilter: 'blur(12px)' }}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: '96vw', height: '94vh', maxWidth: 'none', display: 'flex', flexDirection: 'column', padding: '1.5rem', position: 'relative', background: '#0b1612', border: '1px solid rgba(126,240,168,0.2)', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>SEMANTIC ASSOCIATION NETWORK</h3>
              <button 
                onClick={() => setFullscreenVisual(null)} 
                className="ghost-button" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.76rem', borderRadius: '8px' }}
              >
                Close
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <SemanticNetworkGraph hits={visibleHits} query={result?.query || ''} isFullscreen={true} />
              </div>
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
            <strong>12,486</strong>
            <span>Documents</span>
          </div>
          <div className="stat-card">
            <strong>24.89 GB</strong>
            <span>Corpus Size</span>
          </div>
          <div className="stat-card">
            <strong>1,207,511</strong>
            <span>Indexed Chunks</span>
          </div>
          <div className="stat-card">
            <strong>34</strong>
            <span>Categories</span>
          </div>
          <div className="stat-card">
            <strong>1871-2026</strong>
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

function AnalyticsPage({ result, selectedState }: { result: QueryResponse | null, selectedState: string | null }) {
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
                Per-year category breakdown not yet available from the API (<code>/api/analytics/year_category</code>). Showing total document counts only.
              </p>
            )}
          </div>
        ) : timeSeries.length > 0 ? (
          /* Fallback plain bar chart if year_category endpoint missing */
          <div>
            <p style={{ color: 'var(--accent-warm)', fontSize: '0.82rem', marginBottom: '1rem', padding: '0.6rem 0.9rem', background: 'rgba(255,200,87,0.06)', borderRadius: '8px', border: '1px solid rgba(255,200,87,0.15)' }}>
              The <code>/api/analytics/year_category</code> endpoint isn't available yet — showing total document counts per year. Add the endpoint to enable per-domain stacking.
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
            src={`/api/analytics/wordcloud_image?top_n=120&q=${encodeURIComponent(selectedState ? `${result.query} in ${selectedState}` : result.query)}`}
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
  query,
  onClose,
}: {
  doc: DocumentPreview
  query: string
  onClose: () => void
}) {
  const [fullText, setFullText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [explainText, setExplainText] = useState<string | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'text' | 'web'>('text')

  useEffect(() => {
    setLoading(true)
    setError(null)
    const sourcePath = doc.extra?.source_path || ''
    const recordIndex = doc.extra?.record_index ?? 0
    const docUrl = doc.url || ''

    fetch(`/api/document/full_text?source_path=${encodeURIComponent(sourcePath)}&record_index=${recordIndex}&url=${encodeURIComponent(docUrl)}`)
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

    // Fetch AI Explainability
    if (query) {
      setExplainLoading(true)
      setExplainText(null)
      fetch('/api/document/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          title: doc.title,
          text: doc.text
        })
      })
        .then((res) => res.json())
        .then((data) => {
          setExplainText(data.explanation)
        })
        .catch((err) => {
          console.error('AI explanation failed:', err)
          setExplainText('Failed to generate AI explainability insight.')
        })
        .finally(() => {
          setExplainLoading(false)
        })
    }
  }, [doc, query])

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
      {/* Keyframe animation for spinner */}
      <style>{`
        @keyframes spin-mini {
          to { transform: rotate(360deg); }
        }
        .spinner-mini-anim {
          animation: spin-mini 1s linear infinite;
        }
      `}</style>

      <div className="document-modal panel" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '90vh', maxHeight: '850px' }}>
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

        <div className="document-viewer-meta" style={{ paddingBottom: doc.url ? '0.5rem' : '1rem' }}>
          <span>
            <strong>Type:</strong> {doc.document_type}
          </span>
          {doc.url ? (
            <a href={doc.url} target="_blank" rel="noreferrer">
              Open in New Tab
            </a>
          ) : null}
          {error && <span className="error-badge">Using RAG snippet fallback</span>}
        </div>

        {/* Tab switchers if URL is present */}
        {doc.url && (
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '0 1.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setActiveTab('text')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'text' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                color: activeTab === 'text' ? 'var(--accent)' : 'var(--muted)',
                padding: '0.6rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'monospace'
              }}
            >
              EXTRACTED TEXT
            </button>
            <button
              onClick={() => setActiveTab('web')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'web' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                color: activeTab === 'web' ? 'var(--accent)' : 'var(--muted)',
                padding: '0.6rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'monospace'
              }}
            >
              ORIGINAL WEB PAGE (LIVE)
            </button>
          </div>
        )}

        {/* AI Explainability & Relevance Insight Card */}
        <div style={{
          background: 'rgba(126, 240, 168, 0.03)',
          border: '1px solid rgba(126, 240, 168, 0.15)',
          borderRadius: '12px',
          padding: '1rem',
          margin: '0 1.5rem 1rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          boxShadow: 'inset 0 0 12px rgba(126, 240, 168, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Cpu size={14} /> AI Relevance Insight & Explainability
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {doc.score !== undefined && (
                <span className="badge" style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', background: 'rgba(126, 240, 168, 0.08)', color: 'var(--accent)', border: '1px solid rgba(126, 240, 168, 0.2)' }}>
                  Relevance Score: {doc.score.toFixed(3)}
                </span>
              )}
              <span className="badge" style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                Semantic Retrieval
              </span>
            </div>
          </div>
          
          <div style={{ fontSize: '0.84rem', color: 'var(--text)', lineHeight: '1.5' }}>
            {explainLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--muted)', fontSize: '0.8rem', padding: '0.2rem 0' }}>
                <span className="spinner-mini-anim" style={{ width: '12px', height: '12px', border: '2px solid rgba(126,240,168,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
                Analyzing relevance using local conservation LLM...
              </div>
            ) : explainText ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {renderInlineMarkdown(explainText)}
              </div>
            ) : (
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>AI explainability not available for this session.</span>
            )}
          </div>
        </div>

        <div className="document-viewer-body" style={{ flex: 1, padding: activeTab === 'web' ? '0' : '2rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'web' && doc.url ? (
            <iframe
              src={doc.url}
              title="Original Webpage View"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#ffffff',
                flex: 1
              }}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>{renderContent()}</div>
          )}
        </div>
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
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<DocumentPreview | null>(null)

  // RAG Chat State
  const [session, setSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{ who: string; text: string }>>(() => {
    try {
      const saved = localStorage.getItem('wildai_chat_history')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('wildai_chat_history', JSON.stringify(messages))
  }, [messages])

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

    // Restore and silently recompute last RAG query from history
    try {
      const saved = localStorage.getItem('wildai_chat_history')
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{ who: string; text: string }>
        const userMsgs = parsed.filter((m) => m.who === 'user')
        if (userMsgs.length > 0) {
          const lastQuery = userMsgs[userMsgs.length - 1].text
          setQuery(lastQuery)
          void silentRecompute(lastQuery)
        }
      }
    } catch (e) {
      console.error('Failed to restore chat history:', e)
    }
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
    localStorage.removeItem('wildai_chat_history')
  }

  async function silentRecompute(lastQuery: string) {
    if (!lastQuery) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/chat/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: selectedState ? `${lastQuery} in ${selectedState}` : lastQuery,
          top_k: topK,
          category: category || null,
          source: source || null,
          year: year ? Number(year) : null,
        }),
      })

      if (response.ok) {
        const payload = await response.json()
        setSession(payload.session_id)
        if (payload.hits) {
          setResult({
            query: lastQuery,
            answer: payload.answer,
            total_hits: payload.hits.length,
            highlight_terms: [],
            hits: payload.hits,
          })
        }
      }
    } catch (err) {
      console.error('Silent RAG recompute failed:', err)
    } finally {
      setLoading(false)
    }
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
          query: selectedState ? `${msgText} in ${selectedState}` : msgText,
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
              selectedState={selectedState}
              setSelectedState={setSelectedState}
            />
          ) : currentPage === 'team' ? (
            <TeamPage key="team" />
          ) : currentPage === 'analytics' ? (
            <AnalyticsPage key="analytics" result={result} selectedState={selectedState} />
          ) : (
            <TeamPage key="team" />
          )}
        </AnimatePresence>

        {selectedDocument && (
          <DocumentModalViewer doc={selectedDocument} query={result?.query || query} onClose={() => setSelectedDocument(null)} />
        )}
      </main>
    </div>
  )
}

export default App

