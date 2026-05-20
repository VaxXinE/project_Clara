import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import path from "node:path"
import process from "node:process"

const backendDir = path.resolve("clara-backend")
const dashboardDir = path.resolve("clara-dashboard")

const npmCliPath =
  process.platform === "win32"
    ? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
    : null

const npmRunner =
  process.platform === "win32"
    ? {
        command: process.execPath,
        baseArgs: [npmCliPath]
      }
    : {
        command: "npm",
        baseArgs: []
      }

const uvCommand = process.platform === "win32" ? "uv.exe" : "uv"

const backendHost = process.env.BACKEND_HOST ?? "0.0.0.0"
const backendPort = process.env.BACKEND_PORT ?? "8000"
const dashboardHost = process.env.DASHBOARD_HOST ?? "0.0.0.0"
const dashboardPort = process.env.DASHBOARD_PORT ?? "3000"

const services = new Map()
let shuttingDown = false
let exitCode = 0

const prefixedWrite = (stream, name, line) => {
  stream.write(`[${name}] ${line}\n`)
}

const attachLogs = (stream, name, target) => {
  const reader = createInterface({ input: stream })
  reader.on("line", (line) => prefixedWrite(target, name, line))
}

const stopService = (child) => {
  if (process.platform === "win32") {
    spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore"
    })
    return
  }

  child.kill("SIGINT")
}

const stopAllServices = () => {
  for (const child of services.values()) {
    stopService(child)
  }

  setTimeout(() => {
    for (const child of services.values()) {
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

  if (services.size === 0) {
    process.exit(exitCode)
  }

  stopAllServices()
}

const runCommand = ({ name, command, args, cwd, env }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    })

    attachLogs(child.stdout, name, process.stdout)
    attachLogs(child.stderr, name, process.stderr)

    child.on("error", (error) => {
      reject(error)
    })

    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${name} exited with code ${code ?? 1}`))
    })
  })

const startService = ({ name, command, args, cwd, env }) => {
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  services.set(name, child)
  attachLogs(child.stdout, name, process.stdout)
  attachLogs(child.stderr, name, process.stderr)

  child.on("error", (error) => {
    prefixedWrite(process.stderr, name, `failed to start: ${error.message}`)
    shutdown(1)
  })

  child.on("exit", (code, signal) => {
    services.delete(name)

    if (!shuttingDown) {
      const message = signal
        ? `stopped by signal ${signal}`
        : `exited with code ${code ?? 0}`
      prefixedWrite(process.stderr, name, message)
      shutdown(code ?? 1)
      return
    }

    if (services.size === 0) {
      process.exit(exitCode)
    }
  })
}

const main = async () => {
  prefixedWrite(process.stdout, "prod", "installing dashboard dependencies")
  await runCommand({
    name: "dashboard:install",
    command: npmRunner.command,
    args: [...npmRunner.baseArgs, "ci"],
    cwd: dashboardDir
  })

  prefixedWrite(process.stdout, "prod", "building dashboard production bundle")
  await runCommand({
    name: "build:dashboard",
    command: npmRunner.command,
    args: [...npmRunner.baseArgs, "run", "build"],
    cwd: dashboardDir
  })

  prefixedWrite(process.stdout, "prod", "running backend migrations")
  await runCommand({
    name: "backend:migrate",
    command: uvCommand,
    args: ["run", "--no-dev", "--frozen", "alembic", "upgrade", "head"],
    cwd: backendDir
  })

  prefixedWrite(process.stdout, "prod", "bootstrapping owner if needed")
  await runCommand({
    name: "backend:bootstrap",
    command: uvCommand,
    args: ["run", "--no-dev", "--frozen", "python", "scripts/bootstrap_owner.py"],
    cwd: backendDir
  })

  prefixedWrite(process.stdout, "prod", "importing product knowledge")
  await runCommand({
    name: "backend:knowledge",
    command: uvCommand,
    args: ["run", "--no-dev", "--frozen", "python", "scripts/import_clara_knowledge.py"],
    cwd: backendDir
  })

  prefixedWrite(
    process.stdout,
    "prod",
    `starting backend on ${backendHost}:${backendPort} and dashboard on ${dashboardHost}:${dashboardPort}`
  )

  startService({
    name: "backend",
    command: uvCommand,
    args: [
      "run",
      "--no-dev",
      "--frozen",
      "uvicorn",
      "app.main:app",
      "--host",
      backendHost,
      "--port",
      backendPort
    ],
    cwd: backendDir
  })

  startService({
    name: "dashboard",
    command: npmRunner.command,
    args: [
      ...npmRunner.baseArgs,
      "run",
      "start",
      "--",
      "--hostname",
      dashboardHost,
      "--port",
      dashboardPort
    ],
    cwd: dashboardDir
  })
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

main().catch((error) => {
  prefixedWrite(process.stderr, "prod", error.message)
  process.exit(1)
})
