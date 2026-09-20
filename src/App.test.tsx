import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import App from "./App"

describe("abbreviation expansion quality", () => {
  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  function generate(abbreviation: string, meaning: string) {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText("CIA"), { target: { value: abbreviation } })
    fireEvent.change(screen.getByPlaceholderText("candy in Atlanta"), { target: { value: meaning } })
    fireEvent.click(screen.getByRole("button", { name: /generate/i }))
    act(() => {
      vi.advanceTimersByTime(700)
    })
  }

  it("keeps long abbreviations productive without enumerating every combination", () => {
    generate("COMPUTER", "software tools for teams")

    expect(screen.getAllByRole("article")).toHaveLength(10)
    expect(screen.getAllByText("COMPUTER", { exact: true })).toHaveLength(5)
  })

  it("falls back to meaning initials when the supplied abbreviation has no letters", () => {
    generate("123!!!", "candy in Atlanta")

    const meaningResults = screen.getAllByRole("article").slice(0, 5)
    expect(meaningResults).toHaveLength(5)
    expect(meaningResults.every((article) => article.querySelector("strong")?.textContent === "CIA")).toBe(true)
    expect(screen.getAllByText("CIA", { exact: true })).toHaveLength(5)
    expect(screen.getAllByText(/Candy/).length).toBeGreaterThan(0)
  })
})
