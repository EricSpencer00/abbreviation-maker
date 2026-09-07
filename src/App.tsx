import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import "./App.css"

type Result = { title: string; detail: string; kind: string }
const phraseBank: Record<string, string[]> = {
  candy: ["Candy Intelligence Agency", "Candy in Atlanta", "Creative Indulgence Authority", "Confectionery Industry Alliance", "Candy Is Amazing"],
  music: ["Creative Instrument Makers Union", "Culture Is Making Us", "Community of Independent Musicians", "Melody In Common", "Curated Ideas in Music"],
  space: ["Cosmic Inquiry Alliance", "Celestial Ideas in Action", "Constellation Intelligence Agency", "Circuits In Atmospheric Space", "Curious Interplanetary Assembly"],
}
const words = ["Creative", "Curious", "Common", "Central", "Community", "Collective", "Confectionery", "Cultural", "Portland", "Pacific", "People's", "Public"]
const nouns = ["Intelligence", "Ideas", "Industry", "Initiative", "Insight", "Imagination", "Innovation", "Institute", "Authority", "Alliance", "Assembly", "Association"]
const endings = ["Agency", "Group", "Office", "Network", "Project", "Trust", "Company", "Collective", "Laboratory", "Department"]
function clean(value: string) { return value.trim().replace(/\s+/g, " ") }
function initials(text: string) { return text.split(/\s+/).map((word) => word.replace(/[^a-z]/gi, "")[0] ?? "").join("").toUpperCase() }
function titleCase(text: string) { return text.replace(/\b\w/g, (char) => char.toUpperCase()) }
function makeMeaningResults(abbreviation: string, meaning: string): Result[] {
  const key = meaning.toLowerCase().split(/\s+/).find((word) => phraseBank[word])
  const seeded = key ? phraseBank[key] : []
  const letters = abbreviation.toUpperCase().replace(/[^A-Z]/g, "") || "CIA"
  const generated = Array.from({ length: 8 }, (_, index) => {
    const letter = letters[index % letters.length] ?? "C"
    return `${words[(letter.charCodeAt(0) + index * 2) % words.length]} ${nouns[(letter.charCodeAt(0) * 3 + index) % nouns.length]} ${endings[(letter.charCodeAt(0) + index * 2) % endings.length]}`
  })
  const candidates = [...(meaning ? seeded : []), ...generated]
  return Array.from(new Map(candidates.map((text, index) => [text, { title: letters, detail: text, kind: index < seeded.length ? "strong fit" : "invented" }])).values()).slice(0, 5)
}
function makeAbbreviationResults(meaning: string, abbreviation: string): Result[] {
  const subject = titleCase(meaning || "creative ideas")
  const tokens = subject.split(/\s+/).filter(Boolean)
  const base = initials(subject) || abbreviation.toUpperCase() || "CIA"
  const candy = subject.toLowerCase().includes("candy")
  const candidates = candy
    ? [["CIA", "Candy Intelligence Agency"], ["PCA", "Portland Candy Authority"], ["CAA", "Candy Appreciation Alliance"], ["CIG", "Candy Intelligence Group"], ["PCT", "Portland Confectionery Trust"], ["CDA", "Confectionery Development Authority"]]
    : [[base, subject], [initials(`${tokens[0] ?? "Creative"} ${tokens.at(-1) ?? "Authority"}`), `${tokens[0] ?? "Creative"} ${tokens.at(-1) ?? "Authority"}`], ["CAA", "Creative Appreciation Alliance"], ["CIG", "Curious Ideas Group"], ["PCT", "Public Culture Trust"], ["CIA", "Community Imagination Agency"]]
  return Array.from(new Map(candidates.map(([title, detail], index) => [`${title}-${detail}`, { title, detail, kind: index === 0 ? "closest fit" : index < 3 ? "clean" : "surprising" }])).values()).slice(0, 5)
}
export default function App() {
  const [abbreviation, setAbbreviation] = useState(""); const [meaning, setMeaning] = useState(""); const [submitted, setSubmitted] = useState<{ abbreviation: string; meaning: string } | null>(null); const [running, setRunning] = useState(false); const reduceMotion = useReducedMotion()
  const query = submitted ?? { abbreviation: "", meaning: "" }
  const meanings = useMemo(() => makeMeaningResults(query.abbreviation, query.meaning), [query]); const alternatives = useMemo(() => makeAbbreviationResults(query.meaning, query.abbreviation), [query])
  function submit(event: FormEvent) { event.preventDefault(); if (!clean(abbreviation) && !clean(meaning)) return; setRunning(true); window.setTimeout(() => { setSubmitted({ abbreviation: clean(abbreviation), meaning: clean(meaning) }); setRunning(false) }, reduceMotion ? 0 : 850) }
  return <main className="app-shell"><header><span className="mark">/meaning</span><span className="hint">one thing, many ways to say it</span></header><section className="workbench"><form onSubmit={submit} className="search-form"><label><span>abbreviation</span><input value={abbreviation} onChange={(event) => setAbbreviation(event.target.value)} placeholder="CIA" autoComplete="off" /></label><label><span>meaning</span><input value={meaning} onChange={(event) => setMeaning(event.target.value)} placeholder="candy in Atlanta" autoComplete="off" /></label><button disabled={running || (!abbreviation.trim() && !meaning.trim())}>{running ? <span className="pulse">searching</span> : "generate"}<span aria-hidden="true">↗</span></button></form><AnimatePresence mode="wait">{submitted && !running && <motion.section key={`${submitted.abbreviation}-${submitted.meaning}`} className="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .35 }}><ResultList label="could mean" items={meanings} delay={.04} /><ResultList label="could also be" items={alternatives} delay={.16} /></motion.section>}</AnimatePresence></section><footer><span>enter one or both</span><span>results are invented, not indexed</span></footer></main>
}
function ResultList({ label, items, delay }: { label: string; items: Result[]; delay: number }) { return <div className="result-list"><div className="list-label">{label}<span>05</span></div>{items.map((item, index) => <motion.article key={`${item.title}-${item.detail}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay + index * .07, duration: .35, ease: "easeOut" }}><div className="result-top"><strong>{item.title}</strong><small>{item.kind}</small></div><p>{item.detail}</p></motion.article>)}</div> }
