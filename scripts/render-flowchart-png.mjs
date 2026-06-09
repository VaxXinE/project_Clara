import { writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const htmlPath = path.join(
  rootDir,
  "docs",
  "CLARA_PROJECT_FLOWCHART_PRESENTATION.html"
);

const canvas = {
  width: 2400,
  height: 1800,
};

const columns = [
  {
    title: "1. Sumber Data Masuk",
    x: 90,
    y: 320,
    width: 290,
    nodes: [
      "Manual Upload\nTXT / Paste Chat",
      "WhatsApp Web\nvia Extension",
      "WhatsApp Meta\nWebhook",
      "Sistem Eksternal\nSGCC",
    ],
  },
  {
    title: "2. Clara Intelligence Engine",
    x: 430,
    y: 250,
    width: 360,
    nodes: [
      "Auth, Session,\nCSRF, RBAC",
      "Conversation Intake\n+ Message Normalization",
      "Lead & Customer Sync",
      "AI Analysis",
      "Reply Suggestion",
      "Knowledge Grounding",
      "Audit & Approval Trail",
    ],
  },
  {
    title: "3. Operasional Harian",
    x: 840,
    y: 320,
    width: 300,
    nodes: [
      "Sales Inbox",
      "Conversation Detail",
      "CRM & Lead Detail",
      "Follow-up Queue",
      "Sent Reply Tracking",
    ],
  },
  {
    title: "4. Monitoring & Improvement",
    x: 1190,
    y: 300,
    width: 320,
    nodes: [
      "Chat Review Center",
      "Manager Insights",
      "KPI Command Center",
      "Ops Notifications",
      "Knowledge Proposal Loop",
    ],
  },
  {
    title: "5. Tata Kelola",
    x: 1560,
    y: 390,
    width: 300,
    nodes: [
      "Organization /\nTeam Structure",
      "User & Role\nAccess Control",
      "Global Superadmin\nOversight",
    ],
  },
  {
    title: "6. Data Foundation",
    x: 1910,
    y: 390,
    width: 300,
    nodes: [
      "PostgreSQL",
      "Redis",
      "Knowledge\nSource Files",
      "OpenAI API",
    ],
  },
];

const palette = {
  bgA: "#f7f3ea",
  bgB: "#f1eadc",
  frame: "#fffdf8",
  frameBorder: "#ddcfb9",
  clusterFill: "#fbf7f0",
  clusterBorder: "#d8ccb7",
  nodeFill: "#f8ebcf",
  nodeBorder: "#b27a25",
  nodeText: "#172033",
  title: "#162033",
  muted: "#586179",
  line: "#7a6e5c",
  accent: "#8f6320",
};

const nodeHeight = 96;
const nodeGap = 18;
const clusterHeaderHeight = 54;
const clusterPadding = 18;

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderTextLines(text, x, y, options = {}) {
  const lines = text.split("\n");
  const fontSize = options.fontSize ?? 24;
  const lineHeight = options.lineHeight ?? 30;
  const anchor = options.anchor ?? "middle";

  return lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="${x}" dy="${index === 0 ? 0 : dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");
}

function buildColumns() {
  const built = [];

  for (const column of columns) {
    const clusterHeight =
      clusterHeaderHeight +
      clusterPadding * 2 +
      column.nodes.length * nodeHeight +
      (column.nodes.length - 1) * nodeGap;

    const nodes = column.nodes.map((label, index) => {
      const x = column.x + clusterPadding;
      const y =
        column.y +
        clusterHeaderHeight +
        clusterPadding +
        index * (nodeHeight + nodeGap);
      const width = column.width - clusterPadding * 2;
      const height = nodeHeight;

      return {
        label,
        x,
        y,
        width,
        height,
        cx: x + width / 2,
        cy: y + height / 2,
      };
    });

    built.push({
      ...column,
      height: clusterHeight,
      nodes,
    });
  }

  return built;
}

const builtColumns = buildColumns();

function getNode(columnIndex, nodeIndex) {
  return builtColumns[columnIndex].nodes[nodeIndex];
}

const edges = [
  [getNode(0, 0), getNode(1, 1)],
  [getNode(0, 1), getNode(1, 1)],
  [getNode(0, 2), getNode(1, 1)],
  [getNode(0, 3), getNode(1, 2)],
  [getNode(1, 0), getNode(1, 1)],
  [getNode(1, 1), getNode(1, 2)],
  [getNode(1, 2), getNode(1, 3)],
  [getNode(1, 3), getNode(1, 4)],
  [getNode(1, 5), getNode(1, 4)],
  [getNode(1, 4), getNode(1, 6)],
  [getNode(1, 1), getNode(2, 0)],
  [getNode(1, 1), getNode(2, 1)],
  [getNode(1, 2), getNode(2, 2)],
  [getNode(1, 2), getNode(2, 3)],
  [getNode(1, 4), getNode(2, 4)],
  [getNode(2, 0), getNode(3, 0)],
  [getNode(2, 2), getNode(3, 1)],
  [getNode(2, 3), getNode(3, 1)],
  [getNode(2, 4), getNode(3, 2)],
  [getNode(3, 1), getNode(3, 3)],
  [getNode(3, 0), getNode(3, 4)],
  [getNode(3, 4), getNode(1, 5)],
  [getNode(4, 0), getNode(4, 1)],
  [getNode(4, 1), getNode(1, 0)],
  [getNode(4, 2), getNode(4, 1)],
  [getNode(4, 2), getNode(3, 2)],
  [getNode(4, 2), getNode(3, 3)],
  [getNode(1, 1), getNode(5, 0)],
  [getNode(1, 2), getNode(5, 0)],
  [getNode(1, 3), getNode(5, 0)],
  [getNode(1, 4), getNode(5, 0)],
  [getNode(1, 6), getNode(5, 0)],
  [getNode(3, 0), getNode(5, 0)],
  [getNode(3, 1), getNode(5, 0)],
  [getNode(3, 2), getNode(5, 0)],
  [getNode(3, 3), getNode(5, 0)],
  [getNode(4, 1), getNode(5, 0)],
  [getNode(1, 0), getNode(5, 1)],
  [getNode(1, 5), getNode(5, 2)],
  [getNode(1, 3), getNode(5, 3)],
  [getNode(1, 4), getNode(5, 3)],
];

function edgePath(from, to) {
  const startX = from.x + from.width;
  const startY = from.cy;
  const endX = to.x;
  const endY = to.cy;
  const midX = startX + (endX - startX) * 0.45;

  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.bgA}" />
      <stop offset="100%" stop-color="${palette.bgB}" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#1b274033" />
    </filter>
    <marker id="arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="${palette.line}" />
    </marker>
  </defs>

  <rect width="${canvas.width}" height="${canvas.height}" fill="url(#bg)" />

  <rect x="50" y="50" width="2300" height="1700" rx="34" fill="${palette.frame}" stroke="${palette.frameBorder}" stroke-width="2" filter="url(#shadow)" />

  <g>
    <rect x="92" y="92" width="240" height="44" rx="22" fill="#f8ebcf" />
    <text x="212" y="121" text-anchor="middle" font-size="18" font-weight="800" fill="${palette.accent}" letter-spacing="1.2">CLARA FLOWCHART</text>
    <text x="92" y="208" font-size="66" font-weight="800" fill="${palette.title}">CLARA Presentation Diagram</text>
    <text x="92" y="254" font-size="26" fill="${palette.muted}">Satu gambar ringkas yang menunjukkan aliran utama Clara dari sumber data masuk, pemrosesan intelligence engine,</text>
    <text x="92" y="292" font-size="26" fill="${palette.muted}">operasional harian, monitoring manajemen, sampai tata kelola dan fondasi data.</text>
  </g>

  <g fill="none" stroke="${palette.line}" stroke-width="4" marker-end="url(#arrow)" stroke-linecap="round">
    ${edges.map(([from, to]) => `<path d="${edgePath(from, to)}" opacity="0.8" />`).join("\n")}
  </g>

  <g>
    ${builtColumns
      .map((column) => {
        return `
        <g>
          <rect x="${column.x}" y="${column.y}" width="${column.width}" height="${column.height}" rx="28" fill="${palette.clusterFill}" stroke="${palette.clusterBorder}" stroke-width="2.5" />
          <text x="${column.x + column.width / 2}" y="${column.y + 34}" text-anchor="middle" font-size="26" font-weight="700" fill="${palette.title}">${escapeXml(column.title)}</text>

          ${column.nodes
            .map((node) => {
              return `
              <g>
                <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="18" fill="${palette.nodeFill}" stroke="${palette.nodeBorder}" stroke-width="2.5" />
                <text x="${node.cx}" y="${node.cy - (node.label.includes("\n") ? 12 : -8)}" text-anchor="middle" font-size="24" font-weight="700" fill="${palette.nodeText}">
                  ${renderTextLines(node.label, node.cx, node.cy, { fontSize: 24, lineHeight: 30 })}
                </text>
              </g>`;
            })
            .join("\n")}
        </g>`;
      })
      .join("\n")}
  </g>

  <text x="92" y="1694" font-size="18" fill="${palette.muted}">Generated for Clara presentation flowchart PNG.</text>
</svg>
`.trim();

const html = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CLARA Presentation Flowchart</title>
    <style>
      html, body {
        margin: 0;
        background: #f7f3ea;
      }
      img, svg {
        display: block;
        width: ${canvas.width}px;
        height: ${canvas.height}px;
      }
    </style>
  </head>
  <body>
    ${svg}
  </body>
</html>`;

writeFileSync(htmlPath, html, "utf8");
console.log(`Generated ${path.relative(rootDir, htmlPath)}`);
