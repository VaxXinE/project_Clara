import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const inputPath = path.join(rootDir, "docs", "CLARA_PROJECT_FLOWCHART.md");
const outputPath = path.join(rootDir, "docs", "CLARA_PROJECT_FLOWCHART_PDF.html");

const markdown = readFileSync(inputPath, "utf8");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatInline(text) {
  return escapeHtml(text).replaceAll(/`([^`]+)`/g, "<code>$1</code>");
}

function renderMarkdown(md) {
  const lines = md.replaceAll("\r\n", "\n").split("\n");
  const html = [];

  let paragraph = [];
  let listItems = [];
  let listType = null;
  let tableLines = [];
  let codeFence = null;
  let codeLines = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${formatInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!listItems.length || !listType) return;
    const tag = listType === "ol" ? "ol" : "ul";
    html.push(`<${tag}>`);
    for (const item of listItems) {
      const formattedItem = item
        .split("\n")
        .map((part) => formatInline(part))
        .join("<br />");
      html.push(`<li>${formattedItem}</li>`);
    }
    html.push(`</${tag}>`);
    listItems = [];
    listType = null;
  }

  function isTableLine(line) {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
  }

  function isTableSeparator(cells) {
    return (
      cells.length > 0 &&
      cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
    );
  }

  function parseTableCells(line) {
    return line
      .trim()
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
  }

  function flushTable() {
    if (!tableLines.length) return;

    const rows = tableLines.map(parseTableCells);
    const hasHeaderSeparator = rows.length >= 2 && isTableSeparator(rows[1]);
    const header = hasHeaderSeparator ? rows[0] : null;
    const bodyRows = hasHeaderSeparator ? rows.slice(2) : rows;

    html.push(`<div class="table-wrap"><table>`);

    if (header) {
      html.push("<thead><tr>");
      for (const cell of header) {
        html.push(`<th>${formatInline(cell)}</th>`);
      }
      html.push("</tr></thead>");
    }

    html.push("<tbody>");
    for (const row of bodyRows) {
      html.push("<tr>");
      for (const cell of row) {
        html.push(`<td>${formatInline(cell)}</td>`);
      }
      html.push("</tr>");
    }
    html.push("</tbody></table></div>");

    tableLines = [];
  }

  function flushCode() {
    if (codeFence === null) return;
    const code = codeLines.join("\n").trimEnd();
    if (codeFence === "mermaid") {
      html.push(
        `<section class="diagram-block"><div class="diagram-toolbar">Mermaid Diagram</div><div class="mermaid">${escapeHtml(
          code
        )}</div></section>`
      );
    } else {
      html.push(
        `<pre class="code-block"><code>${escapeHtml(code)}</code></pre>`
      );
    }
    codeFence = null;
    codeLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (codeFence !== null) {
      if (line.startsWith("```")) {
        flushCode();
      } else {
        codeLines.push(rawLine);
      }
      continue;
    }

    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      flushTable();
      codeFence = line.slice(3).trim();
      codeLines = [];
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushTable();
      const level = headingMatch[1].length;
      const text = formatInline(headingMatch[2]);
      html.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    if (isTableLine(line)) {
      flushParagraph();
      flushList();
      tableLines.push(line);
      continue;
    }

    flushTable();

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[1]);
      continue;
    }

    const unorderedMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      const indent = unorderedMatch[1].length;

      if (indent > 0 && listItems.length) {
        listItems[listItems.length - 1] += `\n- ${unorderedMatch[2]}`;
        continue;
      }

      if (listType && listType !== "ul") {
        flushList();
      }

      listType = "ul";
      listItems.push(unorderedMatch[2]);
      continue;
    }

    const listContinuationMatch = rawLine.match(/^\s{2,}(.*)$/);
    if (listContinuationMatch && listItems.length) {
      listItems[listItems.length - 1] += `\n${listContinuationMatch[1].trim()}`;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushTable();
  flushCode();

  return html.join("\n");
}

const renderedBody = renderMarkdown(markdown);

const htmlDocument = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CLARA Project Flowchart</title>
    <style>
      @page {
        size: A2 landscape;
        margin: 14mm;
      }

      :root {
        --bg: #f7f4ee;
        --paper: #fffdf8;
        --ink: #172033;
        --muted: #5c647a;
        --line: #ded6c8;
        --accent: #b27a25;
        --accent-soft: #f7e7c7;
        --code-bg: #0f1728;
        --code-ink: #edf2ff;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        font-size: 13px;
        line-height: 1.6;
      }

      .page {
        padding: 10mm;
      }

      .hero {
        background: linear-gradient(135deg, #18243f, #2f3f68);
        color: white;
        padding: 18mm 16mm;
        border-radius: 18px;
        margin-bottom: 10mm;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .hero .eyebrow {
        display: inline-block;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,.12);
        border: 1px solid rgba(255,255,255,.18);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .12em;
        text-transform: uppercase;
      }

      .hero h1 {
        margin: 14px 0 10px;
        font-size: 30px;
        line-height: 1.15;
      }

      .hero p {
        max-width: 980px;
        margin: 0;
        color: rgba(255,255,255,.86);
        font-size: 13px;
      }

      h1, h2, h3, h4, h5, h6 {
        margin: 0 0 8px;
        line-height: 1.2;
        break-after: avoid;
      }

      h1 { font-size: 24px; }
      h2 {
        margin-top: 18px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--line);
        font-size: 18px;
      }
      h3 {
        margin-top: 16px;
        font-size: 14px;
        color: #283659;
      }

      p, ul, ol, pre, .diagram-block {
        margin: 0 0 10px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        background: var(--paper);
      }

      .table-wrap {
        margin: 0 0 14px;
        border: 1px solid var(--line);
        border-radius: 14px;
        overflow: hidden;
        break-inside: avoid;
        page-break-inside: avoid;
        box-shadow: 0 8px 24px rgba(30, 38, 54, 0.05);
      }

      th, td {
        padding: 10px 12px;
        vertical-align: top;
        text-align: left;
        border-bottom: 1px solid var(--line);
        border-right: 1px solid var(--line);
        word-break: break-word;
      }

      th:last-child, td:last-child {
        border-right: none;
      }

      tbody tr:last-child td {
        border-bottom: none;
      }

      th {
        background: #f2e6d1;
        color: #5f3d00;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .03em;
        text-transform: uppercase;
      }

      ul, ol {
        padding-left: 18px;
      }

      li {
        margin-bottom: 4px;
      }

      code {
        background: var(--accent-soft);
        color: #5f3d00;
        padding: 1px 5px;
        border-radius: 6px;
        font-size: 0.95em;
      }

      .code-block {
        background: var(--code-bg);
        color: var(--code-ink);
        padding: 12px 14px;
        border-radius: 12px;
        overflow: auto;
        white-space: pre-wrap;
        border: 1px solid rgba(255,255,255,.08);
      }

      .code-block code {
        background: transparent;
        color: inherit;
        padding: 0;
      }

      .diagram-block {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 16px;
        break-inside: avoid;
        page-break-inside: avoid;
        box-shadow: 0 8px 24px rgba(30, 38, 54, 0.05);
        overflow: visible;
      }

      .diagram-toolbar {
        display: inline-block;
        margin-bottom: 10px;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: #6d4a08;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .mermaid {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        overflow: visible;
        text-align: center;
      }

      .mermaid svg {
        max-width: 100%;
        max-height: 300mm;
        width: auto;
        height: auto;
      }

      .footer {
        margin-top: 16mm;
        padding-top: 8px;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 10px;
      }
    </style>
    <script src="./assets/vendor/mermaid.min.js"></script>
    <script>
      window.addEventListener("load", async () => {
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          flowchart: {
            htmlLabels: true,
            curve: "basis"
          },
          themeVariables: {
            primaryColor: "#f7e7c7",
            primaryTextColor: "#172033",
            primaryBorderColor: "#b27a25",
            lineColor: "#667085",
            secondaryColor: "#f8f2e6",
            tertiaryColor: "#fffdf8",
            clusterBkg: "#fbf7f0",
            clusterBorder: "#d7c8b2"
          }
        });

        await mermaid.run({
          querySelector: ".mermaid",
        });

        document.documentElement.setAttribute("data-mermaid-rendered", "true");
      });
    </script>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <span class="eyebrow">Clara Architecture</span>
        <h1>CLARA Project Flowchart</h1>
        <p>
          Versi PDF ini dibuat dari dokumentasi flowchart Clara untuk kebutuhan presentasi,
          review arsitektur, onboarding developer, dan pembacaan operasional lintas role.
        </p>
      </section>
      ${renderedBody}
      <section class="footer">
        Generated from <code>docs/CLARA_PROJECT_FLOWCHART.md</code> by <code>scripts/render-flowchart-pdf.mjs</code>.
      </section>
    </main>
  </body>
</html>`;

writeFileSync(outputPath, htmlDocument, "utf8");
console.log(`Generated ${path.relative(rootDir, outputPath)}`);
