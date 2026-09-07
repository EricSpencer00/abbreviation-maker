import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import "./App.css"

type Result = { title: string; detail: string; kind: string }

const general: Record<string, string[]> = {
  A: ["Alliance", "Authority", "Association", "Agency", "Assembly", "Arts"],
  B: ["Bureau", "Builders", "Business", "Brand", "Better", "Bold"],
  C: ["Collective", "Council", "Company", "Community", "Creative", "Center"],
  D: ["Department", "Design", "Development", "Direction", "Discovery", "District"],
  E: ["Exchange", "Enterprise", "Experts", "Engine", "Everyday", "Exceptional"],
  F: ["Foundation", "Forum", "Future", "Federation", "Friendly", "Fresh"],
  G: ["Group", "Guild", "Global", "Good", "Growth", "Gathering"],
  H: ["House", "Hub", "Human", "Honest", "Helpful", "Home"],
  I: ["Institute", "Initiative", "Intelligence", "Ideas", "Innovation", "Independent"],
  J: ["Journal", "Junction", "Joy", "Justice", "Joint", "Journey"],
  K: ["Knowledge", "Kitchen", "Kindred", "Key", "Keepers", "Kind"],
  L: ["Laboratory", "League", "Local", "Learning", "Living", "Leaders"],
  M: ["Movement", "Makers", "Market", "Modern", "Mission", "Media"],
  N: ["Network", "New", "National", "Neighborhood", "Novel", "Nexus"],
  O: ["Office", "Organization", "Open", "Original", "Operations", "Order"],
  P: ["Project", "People", "Public", "Partners", "Pacific", "Portland"],
  Q: ["Quality", "Quest", "Quarterly", "Quick", "Quantum", "Quorum"],
  R: ["Research", "Regional", "Resource", "Retail", "Responsible", "Real"],
  S: ["Society", "Studio", "Service", "Smart", "Shared", "Systems"],
  T: ["Trust", "Team", "Technology", "Thinkers", "Trade", "Tomorrow"],
  U: ["Union", "United", "Urban", "Universal", "Useful", "Unlimited"],
  V: ["Ventures", "Vision", "Voice", "Verified", "Village", "Value"],
  W: ["Works", "World", "Workshop", "Wise", "Wide", "Wonder"],
  X: ["Exchange", "X-factor", "Xenial", "Xpress", "Xlab", "Xchange"],
  Y: ["Youth", "Yearly", "Yard", "Yes", "Yield", "Young"],
  Z: ["Zone", "Zeitgeist", "Zero", "Zenith", "Zest", "Zoom"],
}

const topicWords: Record<string, Record<string, string[]>> = {
  candy: { A: ["Atlanta", "Artisan", "Authority"], C: ["Candy", "Confections", "Confectionery", "Chocolate"], E: ["Edible", "Elevated", "Enjoyable"], I: ["Indulgence", "Ingredients", "Industry"], P: ["Portland", "Premium"], R: ["Retail", "Recipes", "Regional"], S: ["Sweets", "Sugar", "Shop"], T: ["Treats", "Taste"] },
  music: { A: ["Artists", "Audio"], B: ["Bands", "Beats"], C: ["Concert", "Composition"], I: ["Instruments", "Independent"], M: ["Music", "Musicians", "Melody"], R: ["Records", "Rhythm"], S: ["Sound", "Songs", "Studio"] },
  tech: { A: ["Automation", "Applied"], C: ["Computing", "Code"], D: ["Digital", "Data"], I: ["Intelligence", "Infrastructure"], N: ["Network"], S: ["Software", "Systems"], T: ["Technology", "Tools"] },
}

const connectors = new Set(["a", "an", "and", "for", "in", "of", "on", "the", "to", "with"])
const clean = (value: string) => value.trim().replace(/\s+/g, " ")
const titleCase = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase())
const initials = (value: string) => value.split(/\s+/).filter((w) => !connectors.has(w.toLowerCase())).map((w) => w.match(/[a-z]/i)?.[0] ?? "").join("").toUpperCase()

function topicFor(meaning: string) {
  const lower = meaning.toLowerCase()
  if (/candy|sweet|sugar|chocolate|confection|treat/.test(lower)) return "candy"
  if (/music|song|audio|band|sound|melody/.test(lower)) return "music"
  if (/tech|software|code|computer|ai|digital/.test(lower)) return "tech"
  return ""
}

function options(letter: string, meaning: string) {
  const topic = topicWords[topicFor(meaning)]?.[letter] ?? []
  const supplied = meaning.split(/\s+/).map((w) => w.replace(/[^a-z]/gi, "")).filter((w) => w[0]?.toUpperCase() === letter).map(titleCase)
  return [...new Set([...supplied, ...topic, ...(general[letter] ?? [letter])])]
}

function expansions(abbreviation: string, meaning: string): Result[] {
  const letters = (abbreviation || initials(meaning) || "IDEA").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8)
  const rows = Array.from({ length: 12 }, (_, variant) => letters.split("").map((letter, position) => {
    const pool = options(letter, meaning)
    return pool[(variant + position * 2) % pool.length]
  }).join(" "))
  const scored = [...new Set(rows)].sort((a, b) => scoreExpansion(b, letters, meaning) - scoreExpansion(a, letters, meaning))
  return scored.slice(0, 5).map((detail, index) => ({ title: letters, detail, kind: index === 0 ? "best fit" : index < 3 ? "strong" : "unexpected" }))
}

function scoreExpansion(phrase: string, letters: string, meaning: string) {
  const words = phrase.split(" ")
  const exact = words.filter((word, i) => word[0]?.toUpperCase() === letters[i]).length * 20
  const topic = topicFor(meaning)
  const topical = words.filter((word) => Object.values(topicWords[topic] ?? {}).flat().includes(word)).length * 9
  const supplied = words.filter((word) => meaning.toLowerCase().includes(word.toLowerCase())).length * 12
  const repeats = words.length - new Set(words).size
  return exact + topical + supplied - repeats * 30 - phrase.length * .03
}

function alternatives(meaning: string, abbreviation: string): Result[] {
  const subject = clean(meaning) || "creative ideas"
  const topic = topicFor(subject)
  const candidates: string[] = [titleCase(subject)]
  const subjectWords = titleCase(subject).split(" ")
  if (topic) {
    const patterns = topic === "candy" ? ["PCA", "CAA", "CIG", "PCT", "CDA", "SAT"] : topic === "music" ? ["IMS", "MAS", "SOUND", "MIX"] : ["AIT", "CIS", "DIGI", "STACK"]
    for (const pattern of patterns) candidates.push(pattern.split("").map((letter, i) => options(letter, subject)[i % options(letter, subject).length]).join(" "))
  }
  candidates.push(`${subjectWords[0]} ${general.A[0]}`, `${general.C[0]} ${subjectWords.at(-1)}`)
  return [...new Set(candidates)].map((detail) => ({ title: initials(detail) || abbreviation.toUpperCase(), detail, kind: "alternative" })).filter((r) => r.title.length > 1).slice(0, 5).map((r, i) => ({ ...r, kind: i === 0 ? "direct" : i < 3 ? "clean" : "surprising" }))
}

export default function App() {
  const [abbreviation, setAbbreviation] = useState("")
  const [meaning, setMeaning] = useState("")
  const [submitted, setSubmitted] = useState<{ abbreviation: string; meaning: string } | null>(null)
  const [running, setRunning] = useState(false)
  const reduceMotion = useReducedMotion()
  const meanings = useMemo(() => submitted ? expansions(submitted.abbreviation, submitted.meaning) : [], [submitted])
  const alternates = useMemo(() => submitted ? alternatives(submitted.meaning, submitted.abbreviation) : [], [submitted])
  function submit(event: FormEvent) { event.preventDefault(); if (!clean(abbreviation) && !clean(meaning)) return; setRunning(true); window.setTimeout(() => { setSubmitted({ abbreviation: clean(abbreviation), meaning: clean(meaning) }); setRunning(false) }, reduceMotion ? 0 : 700) }
  return <main className="app-shell"><header><span className="mark">/meaning</span><span className="hint">one thing, many ways to say it</span></header><section className="workbench"><form onSubmit={submit} className="search-form"><label><span>abbreviation</span><input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} placeholder="CIA" autoComplete="off" /></label><label><span>meaning</span><input value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="candy in Atlanta" autoComplete="off" /></label><button disabled={running || (!abbreviation.trim() && !meaning.trim())}>{running ? <span className="pulse">searching</span> : "generate"}<span aria-hidden="true">↗</span></button></form><AnimatePresence mode="wait">{submitted && !running && <motion.section key={`${submitted.abbreviation}-${submitted.meaning}`} className="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .3 }}><ResultList label="could mean" items={meanings} delay={.04} /><ResultList label="could also be" items={alternates} delay={.14} /></motion.section>}</AnimatePresence></section><footer><span>enter one or both</span><span>results are invented, not indexed</span></footer></main>
}

function ResultList({ label, items, delay }: { label: string; items: Result[]; delay: number }) { return <div className="result-list"><div className="list-label">{label}<span>{String(items.length).padStart(2, "0")}</span></div>{items.map((item, index) => <motion.article key={`${item.title}-${item.detail}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay + index * .065, duration: .32, ease: "easeOut" }}><div className="result-top"><strong>{item.title}</strong><small>{item.kind}</small></div><p>{item.detail}</p></motion.article>)}</div> }
