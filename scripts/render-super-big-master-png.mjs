import { writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const htmlPath = path.join(
  rootDir,
  "docs",
  "CLARA_PROJECT_FLOWCHART_SUPER_BIG_MASTER.html"
);

const canvas = {
  width: 3200,
  height: 2200,
};

const palette = {
  bgA: "#f6f1e7",
  bgB: "#eee5d3",
  frame: "#fffdf8",
  frameBorder: "#dbcdb4",
  clusterFill: "#faf6ee",
  clusterBorder: "#d4c4a7",
  nodeFill: "#f8e8bf",
  nodeBorder: "#a26b1c",
  nodeText: "#172033",
  title: "#162033",
  muted: "#5d667c",
  line: "#776b59",
  accent: "#8a6120",
};

const nodeHeight = 74;
const nodeGap = 14;
const clusterHeaderHeight = 48;
const clusterPadding = 16;

const columns = [
  {
    title: "Actors",
    x: 70,
    y: 360,
    width: 320,
    nodes: [
      "Customer",
      "Sales",
      "Manager",
      "Head",
      "Superadmin",
      "WhatsApp Meta",
      "SGCC",
    ],
  },
  {
    title: "Client Layer",
    x: 450,
    y: 440,
    width: 290,
    nodes: [
      "Clara Dashboard",
      "Clara Extension",
      "WhatsApp Web",
    ],
  },
  {
    title: "Security Boundary",
    x: 790,
    y: 270,
    width: 340,
    nodes: [
      "/auth/login",
      "Auth Cookie",
      "CSRF Token",
      "RBAC + Scope Filter",
      "Integration API Key",
      "Webhook Signature",
      "Login Rate Limit",
    ],
  },
  {
    title: "Intake Layer",
    x: 1190,
    y: 360,
    width: 340,
    nodes: [
      "Manual Upload /\nPaste Chat",
      "Channel Detection",
      "WhatsApp /\nTelegram Parser",
      "Extension Snapshot\nSync",
      "Meta Webhook Ingest",
    ],
  },
  {
    title: "Core Operational Domain",
    x: 1590,
    y: 270,
    width: 380,
    nodes: [
      "Conversation",
      "Message",
      "Lead / CRM",
      "Customer Profile",
      "Lead Task /\nFollow-up Queue",
      "Discipline Log",
      "Lead Activity\nTimeline",
      "Sent Message",
    ],
  },
  {
    title: "AI & Knowledge Domain",
    x: 2030,
    y: 330,
    width: 360,
    nodes: [
      "AI Extraction",
      "Policy Engine",
      "Reply Suggestion",
      "Knowledge Proposal",
      "Product Knowledge",
      "Clara Playbook",
      "OpenAI Responses API",
    ],
  },
  {
    title: "Oversight & Management",
    x: 2450,
    y: 220,
    width: 430,
    nodes: [
      "Sales Inbox",
      "Sales Worklist",
      "Chat Review Center",
      "Manager Insights",
      "Marketing Insights",
      "KPI Command Center",
      "Ops Notifications /\nKPI Alerts",
      "Approval Log",
      "Audit Log",
    ],
  },
  {
    title: "Administration Domain",
    x: 980,
    y: 1490,
    width: 420,
    nodes: [
      "Organization",
      "Sales Unit",
      "Sales Team",
      "User Management",
    ],
  },
  {
    title: "Storage",
    x: 1540,
    y: 1510,
    width: 420,
    nodes: [
      "PostgreSQL",
      "Redis",
      "Markdown Knowledge\nSource",
    ],
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderTextLines(text, x, options = {}) {
  const lines = text.split("\n");
  const lineHeight = options.lineHeight ?? 28;
  return lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
}

function buildColumns() {
  return columns.map((column) => {
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
      return {
        label,
        x,
        y,
        width,
        height: nodeHeight,
        cx: x + width / 2,
        cy: y + nodeHeight / 2,
      };
    });

    return {
      ...column,
      height: clusterHeight,
      nodes,
    };
  });
}

const builtColumns = buildColumns();
const getNode = (columnIndex, nodeIndex) => builtColumns[columnIndex].nodes[nodeIndex];

const edges = [
  [getNode(0, 0), getNode(1, 2)],
  [getNode(0, 0), getNode(0, 5)],
  [getNode(0, 1), getNode(1, 0)],
  [getNode(0, 1), getNode(1, 2)],
  [getNode(0, 2), getNode(1, 0)],
  [getNode(0, 3), getNode(1, 0)],
  [getNode(0, 4), getNode(1, 0)],
  [getNode(0, 6), getNode(2, 4)],

  [getNode(1, 0), getNode(2, 0)],
  [getNode(1, 1), getNode(2, 1)],
  [getNode(1, 2), getNode(1, 1)],

  [getNode(2, 0), getNode(2, 6)],
  [getNode(2, 6), getNode(2, 1)],
  [getNode(2, 1), getNode(2, 2)],
  [getNode(2, 2), getNode(2, 3)],
  [getNode(2, 3), getNode(7, 3)],
  [getNode(2, 4), getNode(4, 2)],
  [getNode(2, 5), getNode(3, 4)],

  [getNode(1, 0), getNode(3, 0)],
  [getNode(3, 0), getNode(3, 1)],
  [getNode(3, 1), getNode(3, 2)],
  [getNode(3, 2), getNode(4, 0)],
  [getNode(1, 1), getNode(3, 3)],
  [getNode(3, 3), getNode(4, 0)],
  [getNode(0, 5), getNode(2, 5)],
  [getNode(2, 5), getNode(3, 4)],
  [getNode(3, 4), getNode(4, 0)],

  [getNode(4, 0), getNode(4, 1)],
  [getNode(4, 0), getNode(4, 2)],
  [getNode(4, 2), getNode(4, 3)],
  [getNode(4, 2), getNode(4, 4)],
  [getNode(4, 2), getNode(4, 5)],
  [getNode(4, 2), getNode(4, 6)],
  [getNode(4, 1), getNode(5, 0)],
  [getNode(4, 0), getNode(5, 0)],
  [getNode(5, 0), getNode(5, 1)],
  [getNode(5, 1), getNode(5, 2)],
  [getNode(5, 4), getNode(5, 2)],
  [getNode(5, 5), getNode(5, 2)],
  [getNode(8, 2), getNode(5, 4)],
  [getNode(5, 0), getNode(5, 6)],
  [getNode(5, 2), getNode(5, 6)],
  [getNode(0, 3), getNode(5, 4)],
  [getNode(0, 3), getNode(5, 3)],

  [getNode(4, 0), getNode(6, 0)],
  [getNode(4, 0), getNode(6, 1)],
  [getNode(4, 0), getNode(6, 2)],
  [getNode(4, 2), getNode(6, 3)],
  [getNode(4, 2), getNode(6, 4)],
  [getNode(4, 2), getNode(6, 5)],
  [getNode(4, 4), getNode(6, 1)],
  [getNode(4, 5), getNode(6, 3)],
  [getNode(4, 6), getNode(6, 3)],
  [getNode(6, 1), getNode(6, 6)],
  [getNode(6, 3), getNode(6, 6)],
  [getNode(6, 5), getNode(6, 6)],
  [getNode(5, 2), getNode(6, 7)],
  [getNode(5, 2), getNode(4, 7)],
  [getNode(4, 7), getNode(6, 1)],
  [getNode(6, 7), getNode(6, 8)],

  [getNode(0, 4), getNode(7, 0)],
  [getNode(0, 4), getNode(7, 1)],
  [getNode(0, 4), getNode(7, 2)],
  [getNode(0, 4), getNode(7, 3)],
  [getNode(0, 3), getNode(7, 1)],
  [getNode(0, 3), getNode(7, 2)],
  [getNode(7, 0), getNode(7, 3)],
  [getNode(7, 1), getNode(7, 2)],
  [getNode(7, 2), getNode(7, 3)],
  [getNode(7, 3), getNode(2, 3)],

  [getNode(4, 0), getNode(6, 8)],
  [getNode(4, 2), getNode(6, 8)],
  [getNode(4, 3), getNode(6, 8)],
  [getNode(6, 2), getNode(6, 8)],
  [getNode(5, 4), getNode(6, 8)],
  [getNode(6, 6), getNode(6, 8)],
  [getNode(7, 0), getNode(6, 8)],
  [getNode(7, 2), getNode(6, 8)],
  [getNode(7, 3), getNode(6, 8)],

  [getNode(4, 0), getNode(8, 0)],
  [getNode(4, 1), getNode(8, 0)],
  [getNode(4, 2), getNode(8, 0)],
  [getNode(4, 3), getNode(8, 0)],
  [getNode(4, 4), getNode(8, 0)],
  [getNode(4, 5), getNode(8, 0)],
  [getNode(4, 6), getNode(8, 0)],
  [getNode(4, 7), getNode(8, 0)],
  [getNode(5, 0), getNode(8, 0)],
  [getNode(5, 2), getNode(8, 0)],
  [getNode(5, 3), getNode(8, 0)],
  [getNode(5, 4), getNode(8, 0)],
  [getNode(6, 0), getNode(8, 0)],
  [getNode(6, 1), getNode(8, 0)],
  [getNode(6, 2), getNode(8, 0)],
  [getNode(6, 3), getNode(8, 0)],
  [getNode(6, 4), getNode(8, 0)],
  [getNode(6, 5), getNode(8, 0)],
  [getNode(6, 6), getNode(8, 0)],
  [getNode(6, 7), getNode(8, 0)],
  [getNode(6, 8), getNode(8, 0)],
  [getNode(7, 0), getNode(8, 0)],
  [getNode(7, 1), getNode(8, 0)],
  [getNode(7, 2), getNode(8, 0)],
  [getNode(7, 3), getNode(8, 0)],
  [getNode(2, 6), getNode(8, 1)],
];

function edgePath(from, to) {
  const startX = from.x + from.width;
  const startY = from.cy;
  const endX = to.x;
  const endY = to.cy;
  const midX = startX + (endX - startX) * 0.42;
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
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#1d263a2a" />
    </filter>
    <marker id="arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="${palette.line}" />
    </marker>
  </defs>

  <rect width="${canvas.width}" height="${canvas.height}" fill="url(#bg)" />
  <rect x="46" y="46" width="3108" height="2108" rx="34" fill="${palette.frame}" stroke="${palette.frameBorder}" stroke-width="2" filter="url(#shadow)" />

  <g>
    <rect x="86" y="86" width="292" height="48" rx="24" fill="#f8ebcf" />
    <text x="232" y="116" text-anchor="middle" font-size="20" font-weight="800" fill="${palette.accent}" letter-spacing="1.3">CLARA FLOWCHART</text>
    <text x="86" y="205" font-size="70" font-weight="800" fill="${palette.title}">CLARA Super Big Master Diagram</text>
    <text x="86" y="251" font-size="27" fill="${palette.muted}">Satu diagram besar yang menghubungkan actor, client layer, security boundary, intake, core domain, AI, oversight,</text>
    <text x="86" y="289" font-size="27" fill="${palette.muted}">administration, dan storage dalam satu pandangan arsitektur Clara yang lebih detail.</text>
  </g>

  <g fill="none" stroke="${palette.line}" stroke-width="3.5" marker-end="url(#arrow)" stroke-linecap="round" opacity="0.82">
    ${edges.map(([from, to]) => `<path d="${edgePath(from, to)}" />`).join("\n")}
  </g>

  <g>
    ${builtColumns
      .map((column) => `
        <g>
          <rect x="${column.x}" y="${column.y}" width="${column.width}" height="${column.height}" rx="26" fill="${palette.clusterFill}" stroke="${palette.clusterBorder}" stroke-width="2.2" />
          <text x="${column.x + column.width / 2}" y="${column.y + 31}" text-anchor="middle" font-size="23" font-weight="700" fill="${palette.title}">${escapeXml(column.title)}</text>
          ${column.nodes
            .map((node) => `
              <g>
                <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="16" fill="${palette.nodeFill}" stroke="${palette.nodeBorder}" stroke-width="2.2" />
                <text x="${node.cx}" y="${node.cy - (node.label.includes("\n") ? 10 : -7)}" text-anchor="middle" font-size="21" font-weight="700" fill="${palette.nodeText}">
                  ${renderTextLines(node.label, node.cx)}
                </text>
              </g>`)
            .join("\n")}
        </g>`)
      .join("\n")}
  </g>

  <text x="86" y="2098" font-size="18" fill="${palette.muted}">Generated for Clara super big master diagram PNG.</text>
</svg>
`.trim();

const html = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CLARA Super Big Master Diagram</title>
    <style>
      html, body {
        margin: 0;
        background: #f6f1e7;
      }
      svg {
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
