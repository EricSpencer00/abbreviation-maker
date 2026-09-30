import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import App from "./App.tsx"

describe("App abbreviation and meaning generation", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("normalizes punctuation-delimited meaning initials when abbreviation is punctuation-only", async () => {
    render(<App />)

    const abbrInput = screen.getByPlaceholderText("CIA")
    const meaningInput = screen.getByPlaceholderText("candy in Atlanta")
    const submitButton = screen.getByRole("button", { name: /generate/i })

    // Input punctuation-only abbreviation and hyphen-delimited meaning
    fireEvent.change(abbrInput, { target: { value: "-" } })
    fireEvent.change(meaningInput, { target: { value: "candy-in-Atlanta" } })
    fireEvent.click(submitButton)

    act(() => {
      vi.runAllTimers()
    })

    // Primary results ("could mean") must satisfy the 5-result contract
    const couldMeanSection = screen.getByText("could mean").closest(".result-list")
    expect(couldMeanSection).not.toBeNull()

    const primaryArticles = couldMeanSection!.querySelectorAll("article")
    expect(primaryArticles).toHaveLength(5)

    // Primary results should all have the derived "CIA" title (preserving connector 'in')
    primaryArticles.forEach((article) => {
      const title = article.querySelector(".result-top strong")?.textContent
      expect(title).toBe("CIA")
    })

    // Alternatives ("could also be")
    const couldAlsoBeSection = screen.getByText("could also be").closest(".result-list")
    expect(couldAlsoBeSection).not.toBeNull()

    const alternativeArticles = couldAlsoBeSection!.querySelectorAll("article")
    expect(alternativeArticles.length).toBeGreaterThanOrEqual(1)
    expect(alternativeArticles.length).toBeLessThanOrEqual(5)

    // The direct alternative should have CIA title for Candy-In-Atlanta
    const directAltTitle = alternativeArticles[0].querySelector(".result-top strong")?.textContent
    expect(directAltTitle).toBe("CIA")
    const directAltDetail = alternativeArticles[0].querySelector("p")?.textContent
    expect(directAltDetail).toBe("Candy-In-Atlanta")

    // Alternative details must be distinct (de-duplicated)
    const details = Array.from(alternativeArticles).map((a) => a.querySelector("p")?.textContent)
    expect(new Set(details).size).toBe(details.length)
  })

  it("handles various punctuation separators (slash, comma) in meaning", () => {
    render(<App />)

    const abbrInput = screen.getByPlaceholderText("CIA")
    const meaningInput = screen.getByPlaceholderText("candy in Atlanta")
    const submitButton = screen.getByRole("button", { name: /generate/i })

    fireEvent.change(abbrInput, { target: { value: "..." } })
    fireEvent.change(meaningInput, { target: { value: "candy/in/Atlanta" } })
    fireEvent.click(submitButton)

    act(() => {
      vi.runAllTimers()
    })

    const couldMeanSection = screen.getByText("could mean").closest(".result-list")
    const primaryArticles = couldMeanSection!.querySelectorAll("article")
    expect(primaryArticles).toHaveLength(5)
    primaryArticles.forEach((article) => {
      expect(article.querySelector(".result-top strong")?.textContent).toBe("CIA")
    })
  })

  it("preserves standard whitespace-delimited meaning behavior", () => {
    render(<App />)

    const meaningInput = screen.getByPlaceholderText("candy in Atlanta")
    const submitButton = screen.getByRole("button", { name: /generate/i })

    fireEvent.change(meaningInput, { target: { value: "candy in Atlanta" } })
    fireEvent.click(submitButton)

    act(() => {
      vi.runAllTimers()
    })

    const couldMeanSection = screen.getByText("could mean").closest(".result-list")
    const primaryArticles = couldMeanSection!.querySelectorAll("article")
    expect(primaryArticles).toHaveLength(5)
    primaryArticles.forEach((article) => {
      expect(article.querySelector(".result-top strong")?.textContent).toBe("CIA")
    })
  })

  it("respects explicit valid abbreviation inputs", () => {
    render(<App />)

    const abbrInput = screen.getByPlaceholderText("CIA")
    const meaningInput = screen.getByPlaceholderText("candy in Atlanta")
    const submitButton = screen.getByRole("button", { name: /generate/i })

    fireEvent.change(abbrInput, { target: { value: "SWEET" } })
    fireEvent.change(meaningInput, { target: { value: "candy treats" } })
    fireEvent.click(submitButton)

    act(() => {
      vi.runAllTimers()
    })

    const couldMeanSection = screen.getByText("could mean").closest(".result-list")
    const primaryArticles = couldMeanSection!.querySelectorAll("article")
    expect(primaryArticles).toHaveLength(5)
    primaryArticles.forEach((article) => {
      expect(article.querySelector(".result-top strong")?.textContent).toBe("SWEET")
    })
  })
})
