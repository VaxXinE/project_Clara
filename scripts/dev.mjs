import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import path from "node:path"
import process from "node:process"

const apps = [
  {
    name: "dashboard",
    cwd: path.resolve("clara-dashboard")
  },
  {
    name: "extension",
    cwd: path.resolve("clara-extension")
  }
]

const npmCliPath =
  process.platform === "win32"
    ? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
    : null

const runner =
  process.platform === "win32"
    ? {
        command: process.execPath,
        args: [npmCliPath, "run", "dev"]
      }
    : {
        command: "npm",
        args: ["run", "dev"]
      }
const children = new Map()
let shuttingDown = false
let exitCode = 0

const writeLine = (stream, name, line) => {
  stream.write(`[${name}] ${line}\n`)
}

const stopChild = (child) => {
  if (process.platform === "win32") {
    spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore"
    })
    return
  }

  child.kill("SIGINT")
}

const stopChildren = () => {
  for (const child of children.values()) {
    stopChild(child)
  }

  setTimeout(() => {
    for (const child of children.values()) {
      child.kill("SIGTERM")
    }
  }, 1500).unref()
}

const shutdown = (code = 0) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  exitCode = code

  if (children.size === 0) {
    process.exit(exitCode)
  }

  stopChildren()
}

const attachLogs = (stream, name, target) => {
  const reader = createInterface({ input: stream })
  reader.on("line", (line) => writeLine(target, name, line))
}

const startApp = ({ name, cwd }) => {
  const child = spawn(runner.command, runner.args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  })

  children.set(name, child)
  attachLogs(child.stdout, name, process.stdout)
  attachLogs(child.stderr, name, process.stderr)

  child.on("error", (error) => {
    writeLine(process.stderr, name, `failed to start: ${error.message}`)
    shutdown(1)
  })

  child.on("exit", (code, signal) => {
    children.delete(name)

    if (!shuttingDown) {
      const message = signal
        ? `stopped by signal ${signal}`
        : `exited with code ${code ?? 0}`
      writeLine(process.stderr, name, message)
      shutdown(code ?? 1)
      return
    }

    if (children.size === 0) {
      process.exit(exitCode)
    }
  })
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

for (const app of apps) {
  startApp(app)
}
