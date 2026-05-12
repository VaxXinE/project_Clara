const originalConsoleError = console.error

console.error = (...args) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes('Error fetching package information for "plasmo"')
  ) {
    return
  }

  originalConsoleError(...args)
}

await import("plasmo/bin/index.mjs")
