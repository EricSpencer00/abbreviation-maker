import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import "./App.css"

type Result = { title: string; detail: string; kind: string }
type ScoredWord = { word: string; score: number; source: "seed" | "bank" }
type MeaningSignal = {
  token: string
  variants: string[]
}
type PartialExpansion = {
  words: string[]
  score: number
}

const EXPANSION_BEAM_WIDTH = 96

const stopWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "out",
  "that",
  "the",
  "their",
  "there",
  "this",
  "to",
  "with",
  "within",
  "you",
  "your",
  "are",
  "was",
  "were",
  "who",
  "what",
  "which",
  "when",
  "why",
  "how",
  "through",
  "about",
  "have",
  "has",
  "had",
  "being",
  "been",
  "can",
  "may",
  "should",
])

const genericLexicon: Record<string, string[]> = {
  A: ["Alliance", "Agency", "Authority", "Archive", "Axis", "Area", "Atlas", "Approach", "Access", "Audit"],
  B: ["Bureau", "Bridge", "Builder", "Board", "Base", "Beacon", "Bay", "Balance", "Batch", "Backup"],
  C: ["Council", "Center", "Collective", "Care", "Code", "Circuit", "Civic", "Capital", "Compass", "Circle", "Context", "Clearance", "Certified"],
  D: ["Division", "Design", "Development", "Domain", "Direct", "Dock", "Drive", "Data", "District", "Delivery", "Demand"],
  E: ["Exchange", "Engine", "Event", "Evidence", "Enterprise", "Evolution", "Ecosystem", "Elected", "Edition", "Edge", "Entity"],
  F: ["Forum", "Foundation", "Framework", "Field", "Figure", "Fleet", "Focus", "Fusion", "Factor", "Future", "Flow", "Facility", "Family"],
  G: ["Group", "Gateway", "Grant", "Grade", "Guide", "Guild", "Garden", "Grid", "Governance", "Growth"],
  H: ["Hub", "House", "Human", "Horizon", "Health", "Harbor", "Harvest", "History", "Host", "Harness", "Hunt", "Habitat"],
  I: ["Institute", "Intelligence", "Initiative", "Index", "Issue", "Integration", "Inspection", "Input", "Impact", "Income", "Intent"],
  J: ["Journal", "Justice", "Journey", "Joint", "Junction", "Kernel", "Junior", "Jointly"],
  K: ["Knowledge", "Keeper", "Kernel", "Key", "Knight", "Kind", "Kinetic", "Kinship", "Kiosk", "Knoll", "Keen"],
  L: ["Laboratory", "Learning", "Line", "Link", "League", "Ledger", "Level", "Loop", "Logic", "Launch", "Lumen", "Legacy"],
  M: ["Market", "Movement", "Model", "Method", "Mission", "Manual", "Module", "Measure", "Margin", "Matrix", "Motion", "Mastery"],
  N: ["Network", "Node", "Nation", "Norm", "Notice", "Nomad", "Nexus", "North", "Nature", "Nucleus", "Neutral"],
  O: ["Office", "Order", "Origin", "Open", "Orbit", "Object", "Output", "Outcome", "Oasis"],
  P: ["Project", "People", "Program", "Public", "Policy", "Point", "Portal", "Platform", "Practice", "Proof", "Path"],
  Q: ["Quality", "Quest", "Quotient", "Quarter", "Queue", "Quick", "Quiet", "Quill", "Query", "Quota", "Quantum"],
  R: ["Research", "Resource", "Registry", "Rule", "Relay", "Record", "Route", "Radius", "Ridge", "Root", "Response", "Reward"],
  S: ["Service", "Society", "Studio", "Signal", "System", "Scheme", "Sector", "Stream", "Source"],
  T: ["Trust", "Team", "Tool", "Transit", "Template", "Target", "Theory", "Task", "Thread", "Token", "Terrain", "Treaty"],
  U: ["Union", "Urban", "Utility", "Unit", "Unique", "Update", "Usage", "User", "Umbrella", "Uplift", "Upgrade"],
  V: ["Vision", "Vector", "Value", "Version", "Vendor", "Vessel", "Venue", "Volume", "Village", "Vault", "Vital", "Verify"],
  W: ["Works", "World", "Ward", "Watch", "Water", "Weight", "Wide", "Window", "Welfare", "Warden", "Web", "Waypoint"],
  X: ["Xchange", "Xpress", "Xenon", "Xeno", "Xact", "Xylo", "Xavier", "Xplore", "Xtra", "Xcell"],
  Y: ["Year", "Yield", "Youth", "Yard", "Yarn", "Yeast", "Yonder", "Yoke", "Yardstick", "Yielding"],
  Z: ["Zone", "Zoom", "Zero", "Zenith", "Zonal", "Zebra", "Zinc", "Zest", "Zeal"],
}

const universalDescriptors = [
  "Alliance",
  "Authority",
  "Association",
  "Agency",
  "Network",
  "Bureau",
  "Council",
  "Board",
  "Office",
  "Union",
  "Guild",
  "Service",
  "Network",
  "Collective",
  "Institute",
  "Laboratory",
  "Platform",
]

const stemSuffixes = ["ing", "ed", "es", "s", "ly", "tion", "ment", "ness", "ship", "ity"]

const clean = (value: string) => value.trim().replace(/\s+/g, " ")
const titleCase = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase())
const initials = (value: string) => {
  const withoutDiacritics = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  return withoutDiacritics
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.match(/[a-z]/i)?.[0] ?? "")
    .join("")
    .toUpperCase()
}

function tokenize(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !stopWords.has(token))
}

function stemToken(token: string) {
  let base = token
  for (const suffix of stemSuffixes) {
    if (base.length > suffix.length + 2 && base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length)
      break
    }
  }
  return base
}

function expandToken(token: string) {
  const out = new Set<string>([token])
  const stem = stemToken(token)
  if (stem && stem !== token) out.add(stem)
  if (token.endsWith("ies")) {
    out.add(token.slice(0, -3) + "y")
  }
  if (token.endsWith("ers") && token.length > 4) {
    out.add(token.slice(0, -3) + "er")
  }
  if (token.endsWith("ments") && token.length > 5) {
    out.add(token.slice(0, -2))
  }
  if (token.endsWith("ing") && token.length > 5) {
    out.add(token.slice(0, -3))
    out.add(`${token.slice(0, -3)}e`)
  }
  if (token.endsWith("ed") && token.length > 4) {
    out.add(token.slice(0, -2))
    out.add(`${token.slice(0, -2)}ing`)
  }
  if (token === "men") out.add("man")
  if (token === "women") out.add("woman")
  if (token === "licenses" || token === "licens") out.add("license")
  if (token === "people") out.add("person")
  out.add(titleCase(token))
  return Array.from(out)
}

function extractMeaningSignals(meaning: string): MeaningSignal[] {
  const tokens = tokenize(meaning)
  const unique = new Map<string, MeaningSignal>()
  for (const token of tokens) {
    if (unique.has(token)) continue
    unique.set(token, { token, variants: expandToken(token) })
  }
  return Array.from(unique.values())
}

function sharedRootScore(candidate: string, signals: MeaningSignal[]) {
  const candidateLower = candidate.toLowerCase()
  let score = 0
  for (const signal of signals) {
    for (const variant of signal.variants) {
      const normalized = variant.toLowerCase()
      if (!normalized || normalized.length < 3) continue
      if (candidateLower === normalized) score += 190
      else if (candidateLower.startsWith(normalized) || normalized.startsWith(candidateLower))
        score += 55
      else if (candidateLower.includes(normalized.slice(0, 4))) score += 35

      for (let i = 0; i < Math.min(candidateLower.length, normalized.length) - 1; i++) {
        const chunk = candidateLower.slice(i, i + 3)
        if (chunk.length === 3 && normalized.includes(chunk)) score += 8
      }
    }
  }
  return score
}

function sortedScoredOptions(letter: string, signals: MeaningSignal[], position: number): ScoredWord[] {
  const scored = new Map<string, ScoredWord>()
  const bank = genericLexicon[letter] ?? []
  const seenWords = new Set<string>()

  for (const item of bank) {
    if (!item) continue
    const trimmed = clean(item)
    if (!trimmed) continue
    const normalized = trimmed.toLowerCase()
    if (seenWords.has(normalized)) continue
    seenWords.add(normalized)

    const sourceBonus = 20
    let score = 70 + sourceBonus
    score += sharedRootScore(trimmed, signals)
    if (/[aeiou]$/.test(normalized)) score += 4
    if (position === 0) score += 18
    if (normalized.length > 14) score -= 10
    if (normalized.length < 4) score -= 8

    scored.set(trimmed, {
      word: titleCase(trimmed),
      score,
      source: "bank",
    })
  }

  for (const signal of signals) {
    for (const variant of signal.variants) {
      if (!variant[0]) continue
      const upperFirst = titleCase(variant)
      if (upperFirst[0].toUpperCase() !== letter) continue
      const normalized = upperFirst.toLowerCase()
      const previous = scored.get(normalized)
      const seedScore = 120 + sharedRootScore(upperFirst, signals) + (position === 0 ? 25 : 10)
      if (!previous || previous.score < seedScore) {
        scored.set(normalized, { word: upperFirst, score: seedScore, source: "seed" })
      }
    }
  }

  const candidates = Array.from(scored.values()).sort(
    (a, b) =>
      b.score - a.score ||
      (a.source === b.source ? a.word.localeCompare(b.word) : a.source === "seed" ? -1 : b.source === "seed" ? 1 : 0),
  )
  return candidates
}

function uniqueByText(items: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const normalized = item.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    out.push(item)
  }
  return out
}

function effectiveLetters(abbreviation: string, meaning: string) {
  const suppliedLetters = abbreviation
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
  return (suppliedLetters || initials(meaning) || "IDEA").slice(0, 8)
}

function expansions(abbreviation: string, meaning: string): Result[] {
  const signals = extractMeaningSignals(meaning)
  const letters = effectiveLetters(abbreviation, meaning)

  const pools = letters.split("").map((letter, index) => sortedScoredOptions(letter, signals, index))
  // Keep browser work bounded instead of enumerating every 6^N combination.
  let beam: PartialExpansion[] = [{ words: [], score: 0 }]

  for (const pool of pools) {
    const choices = uniqueByText(pool.map((item) => item.word)).slice(0, 6)
    if (choices.length === 0) return []

    const scores = new Map(pool.map((item) => [item.word, item.score]))
    const next = beam.flatMap((partial) =>
      choices.map((choice) => ({
        words: [...partial.words, choice],
        score: partial.score + (scores.get(choice) ?? 45),
      })),
    )

    next.sort(
      (a, b) =>
        b.score - a.score ||
        a.words.join(" ").localeCompare(b.words.join(" ")),
    )
    beam = next.slice(0, EXPANSION_BEAM_WIDTH)
  }

  const details = uniqueByText(beam.map((partial) => partial.words.join(" ")))

  return details.slice(0, 5).map((detail, index) => ({
    title: letters,
    detail,
    kind: index === 0 ? "best fit" : index < 3 ? "strong" : "unexpected",
  }))
}

function phraseScore(detail: string, signals: MeaningSignal[]) {
  const lowerDetail = detail.toLowerCase()
  let score = 0
  for (const signal of signals) {
    const token = signal.token
    const tokenLower = token.toLowerCase()
    if (!tokenLower) continue
    if (lowerDetail.includes(tokenLower)) score += 26
    if (new RegExp(`\\b${tokenLower}`, "i").test(lowerDetail)) score += 12

    const stem = stemToken(tokenLower)
    if (stem && lowerDetail.includes(stem)) score += 8

    for (const variant of signal.variants) {
      const variantLower = variant.toLowerCase()
      if (lowerDetail.includes(variantLower)) score += 3
    }
  }

  const words = lowerDetail.split(" ").filter(Boolean)
  if (words.length > 2) score += 12
  if (words.length <= 5) score += 16
  return score
}

function alternatives(meaning: string, abbreviation: string): Result[] {
  const subject = clean(meaning) || "creative ideas"
  const signals = extractMeaningSignals(subject)
  const tokens = signals.map((signal) => signal.token)
  const subjectWords = tokens.map((token) => titleCase(token))

  const baseWords = genericLexicon[subjectWords[0]?.[0]?.toUpperCase() ?? "A"] ?? ["Origin"]
  const phrases = new Set<string>()

  if (subjectWords.length > 0) {
    phrases.add(titleCase(subject))
  }
  for (const subjectWord of subjectWords) {
    phrases.add(titleCase(subjectWord))
  }

  for (const core of subjectWords.slice(0, 5)) {
    for (const descriptor of universalDescriptors.slice(0, 6)) {
      phrases.add(`${core} ${descriptor}`)
      phrases.add(`${descriptor} ${core}`)
    }
  }

  for (let i = 0; i < Math.min(subjectWords.length - 1, 3); i++) {
    phrases.add(`${subjectWords[i]} ${subjectWords[i + 1]}`)
    phrases.add(`${subjectWords[i + 1]} ${subjectWords[i]}`)
    for (const descriptor of universalDescriptors.slice(0, 3)) {
      phrases.add(`${subjectWords[i]} ${descriptor} ${subjectWords[i + 1]}`)
    }
  }
  for (const root of baseWords.slice(0, 3)) {
    phrases.add(`${root} ${subjectWords[0] ?? "Collective"}`)
  }

  if (phrases.size < 12) {
    for (const descriptor of universalDescriptors.slice(0, 6)) {
      phrases.add(`${descriptor} ${subjectWords[0] ?? "Group"}`)
    }
  }

  const scored = Array.from(phrases)
    .map((phrase) => ({ phrase, score: phraseScore(phrase, signals) }))
    .sort((a, b) => b.score - a.score || a.phrase.localeCompare(b.phrase))


  const out: Result[] = []
  const seen = new Set<string>()
  const requested = effectiveLetters(abbreviation, meaning)

  for (const item of scored) {
    const title = initials(item.phrase)
    if (title.length <= 1) continue
    const upper = title.toUpperCase()
    if (upper === requested) continue
    if (seen.has(upper)) continue
    seen.add(upper)
    out.push({
      title: upper,
      detail: item.phrase,
      kind: out.length === 0 ? "direct" : out.length < 3 ? "clean" : "surprising",
    })
    if (out.length === 5) break
  }

  return out
}

export default function App() {
  const [abbreviation, setAbbreviation] = useState("")
  const [meaning, setMeaning] = useState("")
  const [submitted, setSubmitted] = useState<{ abbreviation: string; meaning: string } | null>(null)
  const [running, setRunning] = useState(false)
  const reduceMotion = useReducedMotion()

  const meanings = useMemo(() => (submitted ? expansions(submitted.abbreviation, submitted.meaning) : []), [submitted])
  const alternates = useMemo(
    () => (submitted ? alternatives(submitted.meaning, submitted.abbreviation) : []),
    [submitted],
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!clean(abbreviation) && !clean(meaning)) return
    setRunning(true)
    window.setTimeout(() => {
      setSubmitted({ abbreviation: clean(abbreviation), meaning: clean(meaning) })
      setRunning(false)
    }, reduceMotion ? 0 : 700)
  }

  return (
    <main className="app-shell">
      <header>
        <span className="mark">/abbreviation</span>
        <span className="hint">one thing, many ways to say it</span>
      </header>
      <section className="workbench">
        <form onSubmit={submit} className="search-form">
          <label>
            <span>abbreviation</span>
            <input
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              placeholder="CIA"
              autoComplete="off"
            />
          </label>
          <label>
            <span>meaning</span>
            <input
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="candy in Atlanta"
              autoComplete="off"
            />
          </label>
          <button disabled={running || (!abbreviation.trim() && !meaning.trim())}>
            {running ? <span className="pulse">searching</span> : "generate"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <AnimatePresence mode="wait">
          {submitted && !running && (
            <motion.section
              key={`${submitted.abbreviation}-${submitted.meaning}`}
              className="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <ResultList label="could mean" items={meanings} delay={0.04} />
              <ResultList label="could also be" items={alternates} delay={0.14} />
            </motion.section>
          )}
        </AnimatePresence>
      </section>
      <footer>
        <span>enter one or both</span>
        <a className="main-link" href="https://ericspencer.us" target="_blank" rel="noopener noreferrer">
          ericspencer.us
        </a>
      </footer>
    </main>
  )
}

function ResultList({ label, items, delay }: { label: string; items: Result[]; delay: number }) {
  return (
    <div className="result-list">
      <div className="list-label">
        {label}
        <span>{String(items.length).padStart(2, "0")}</span>
      </div>
      {items.map((item, index) => (
        <motion.article
          key={`${item.title}-${item.detail}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + index * 0.065, duration: 0.32, ease: "easeOut" }}
        >
          <div className="result-top">
            <strong>{item.title}</strong>
            <small>{item.kind}</small>
          </div>
          <p>{item.detail}</p>
        </motion.article>
      ))}
    </div>
  )
}
