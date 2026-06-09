import { writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const htmlPath = path.join(
  rootDir,
  "docs",
  "CLARA_PROJECT_FLOWCHART_READABLE.html"
);

const canvas = {
  width: 1600,
  height: 3600,
};

const palette = {
  bg: "#050505",
  panel: "#0b0b0b",
  line: "#cfcfcf",
  boxFill: "#f2f2f2",
  boxStroke: "#d7d7d7",
  boxText: "#111111",
  title: "#ffffff",
  tagFill: "#f2f2f2",
  tagText: "#111111",
};

const centerX = 800;
const boxWidth = 360;
const boxHeight = 88;
const diamondSize = 140;

const leftX = 320;
const rightX = 1280;
const mainX = centerX;

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function textLines(text, x, y, options = {}) {
  const lines = text.split("\n");
  const lineHeight = options.lineHeight ?? 26;
  const fontSize = options.fontSize ?? 22;
  const weight = options.weight ?? 600;
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${fontSize}" font-weight="${weight}" fill="${palette.boxText}">
${lines
  .map((line, index) => {
    const dy = index === 0 ? 0 : lineHeight;
    return `<tspan x="${x}" dy="${index === 0 ? 0 : dy}">${escapeXml(line)}</tspan>`;
  })
  .join("\n")}
</text>`;
}

function createBox(id, x, y, label, width = boxWidth, height = boxHeight) {
  return {
    id,
    type: "box",
    x,
    y,
    width,
    height,
    label,
  };
}

function createDiamond(id, x, y, label, size = diamondSize) {
  return {
    id,
    type: "diamond",
    x,
    y,
    width: size,
    height: size,
    label,
  };
}

const nodes = [
  createBox("start", mainX, 150, "Start", 140, 64),
  createBox("login", mainX, 270, "User login ke Clara\nDashboard / Extension\nsesuai role"),
  createDiamond("source_decision", mainX, 420, "Channel sumber\nchat masuk?", 170),

  createBox("upload", leftX, 600, "Upload TXT /\nPaste chat manual"),
  createBox("extension", mainX, 600, "Extension sync\nchat WhatsApp Web"),
  createBox("webhook", rightX, 600, "Webhook masuk dari\nWhatsApp Meta"),
  createBox("sgcc", rightX, 760, "Integrasi SGCC /\nsistem eksternal"),

  createBox("intake", mainX, 860, "Conversation intake\n+ parsing + normalisasi\nmessage", 420, 112),
  createDiamond("existing_conv", mainX, 1020, "Conversation\nsudah ada?", 170),
  createBox("update_conv", leftX, 1180, "Update conversation existing\n+ dedupe message"),
  createBox("create_conv", rightX, 1180, "Create conversation baru"),
  createBox("sync_entities", mainX, 1340, "Create / update Lead,\nCustomer Profile,\nFollow-up Queue,\ndan ownership sales", 440, 128),

  createBox("queue_detail", mainX, 1520, "Sales buka Queue /\nConversation Detail\nuntuk eksekusi"),
  createDiamond("need_ai", mainX, 1680, "Perlu AI\nanalysis?", 170),
  createBox("analyze", leftX, 1860, "AI analyze conversation\n+ update lead/customer\ncontext"),
  createBox("skip_ai", rightX, 1860, "Lanjut workflow tanpa\nAI analysis"),
  createBox("reply", mainX, 2020, "Generate reply suggestion\nberbasis knowledge,\npolicy, dan context chat", 440, 112),

  createDiamond("sales_action", mainX, 2190, "Aksi sales\nselanjutnya?", 180),
  createBox("send_reply", leftX, 2380, "Approve / kirim\nreply ke customer"),
  createBox("update_crm", mainX, 2380, "Update CRM,\nfollow-up, task,\natau discipline log"),
  createBox("escalate", rightX, 2380, "Escalate ke manager /\nChat Review Center"),

  createBox("log_activity", mainX, 2560, "Simpan sent message,\nlead activity,\naudit log, dan status task", 440, 112),
  createBox("monitoring", mainX, 2740, "Manager / Head monitor\nInbox, Worklist,\nReview, KPI, Alerts,\ndan bottleneck tim", 460, 128),
  createDiamond("new_knowledge", mainX, 2920, "Ada insight baru\nuntuk knowledge\nbase?", 180),
  createBox("publish_knowledge", leftX, 3100, "Review proposal\n+ publish ke\nProduct Knowledge", 360, 112),
  createBox("skip_knowledge", rightX, 3100, "Tidak ada update\nknowledge"),
  createBox("knowledge_loop", mainX, 3270, "Knowledge aktif dipakai\nlagi untuk grounding\nanalysis dan reply\nberikutnya", 440, 128),
  createBox("end", mainX, 3460, "End", 140, 64),
];

const nodeMap = new Map(nodes.map((node) => [node.id, node]));

function boxTop(node) {
  return node.y - node.height / 2;
}

function boxBottom(node) {
  return node.y + node.height / 2;
}

function boxLeft(node) {
  return node.x - node.width / 2;
}

function boxRight(node) {
  return node.x + node.width / 2;
}

function pointBottom(node) {
  return [node.x, boxBottom(node)];
}

function pointTop(node) {
  return [node.x, boxTop(node)];
}

function pointLeft(node) {
  return [boxLeft(node), node.y];
}

function pointRight(node) {
  return [boxRight(node), node.y];
}

function straightVertical(fromId, toId, label = "") {
  const from = nodeMap.get(fromId);
  const to = nodeMap.get(toId);
  return {
    kind: "poly",
    points: [pointBottom(from), pointTop(to)],
    label,
  };
}

function sideBranch(fromId, toId, side = "left", label = "") {
  const from = nodeMap.get(fromId);
  const to = nodeMap.get(toId);

  const start = side === "left" ? pointLeft(from) : pointRight(from);
  const end = side === "left" ? pointTop(to) : pointTop(to);
  const elbowX = side === "left" ? to.x : to.x;
  const laneX = side === "left" ? start[0] - 120 : start[0] + 120;

  return {
    kind: "poly",
    points: [
      start,
      [laneX, start[1]],
      [laneX, end[1] - 30],
      [elbowX, end[1] - 30],
      end,
    ],
    label,
  };
}

function mergeToCenter(fromId, toId, side = "left", label = "") {
  const from = nodeMap.get(fromId);
  const to = nodeMap.get(toId);
  const start = pointBottom(from);
  const end = pointTop(to);
  const laneX = side === "left" ? from.x + 120 : from.x - 120;

  return {
    kind: "poly",
    points: [
      start,
      [laneX, start[1] + 30],
      [laneX, end[1] - 30],
      [end[0], end[1] - 30],
      end,
    ],
    label,
  };
}

function decisionLabel(x, y, text) {
  return `<rect x="${x - 18}" y="${y - 14}" width="36" height="28" rx="2" fill="#ffffff" />
<text x="${x}" y="${y + 8}" text-anchor="middle" font-size="16" font-weight="700" fill="#111111">${escapeXml(text)}</text>`;
}

const edges = [
  straightVertical("start", "login"),
  straightVertical("login", "source_decision"),

  sideBranch("source_decision", "upload", "left"),
  straightVertical("source_decision", "extension"),
  sideBranch("source_decision", "webhook", "right"),
  straightVertical("webhook", "sgcc"),

  mergeToCenter("upload", "intake", "left"),
  mergeToCenter("extension", "intake", "left"),
  mergeToCenter("webhook", "intake", "right"),
  mergeToCenter("sgcc", "intake", "right"),

  straightVertical("intake", "existing_conv"),
  sideBranch("existing_conv", "update_conv", "left"),
  sideBranch("existing_conv", "create_conv", "right"),
  mergeToCenter("update_conv", "sync_entities", "left"),
  mergeToCenter("create_conv", "sync_entities", "right"),

  straightVertical("sync_entities", "queue_detail"),
  straightVertical("queue_detail", "need_ai"),
  sideBranch("need_ai", "analyze", "left", "Ya"),
  sideBranch("need_ai", "skip_ai", "right", "Tidak"),
  mergeToCenter("analyze", "reply", "left"),
  mergeToCenter("skip_ai", "reply", "right"),

  straightVertical("reply", "sales_action"),
  sideBranch("sales_action", "send_reply", "left"),
  straightVertical("sales_action", "update_crm"),
  sideBranch("sales_action", "escalate", "right"),

  mergeToCenter("send_reply", "log_activity", "left"),
  mergeToCenter("update_crm", "log_activity", "left"),
  mergeToCenter("escalate", "log_activity", "right"),

  straightVertical("log_activity", "monitoring"),
  straightVertical("monitoring", "new_knowledge"),
  sideBranch("new_knowledge", "publish_knowledge", "left", "Ya"),
  sideBranch("new_knowledge", "skip_knowledge", "right", "Tidak"),
  mergeToCenter("publish_knowledge", "knowledge_loop", "left"),
  mergeToCenter("skip_knowledge", "knowledge_loop", "right"),
  straightVertical("knowledge_loop", "end"),
];

function renderNode(node) {
  if (node.type === "box") {
    return `
      <g>
        <rect
          x="${node.x - node.width / 2}"
          y="${node.y - node.height / 2}"
          width="${node.width}"
          height="${node.height}"
          rx="0"
          fill="${palette.boxFill}"
          stroke="${palette.boxStroke}"
          stroke-width="2"
        />
        ${textLines(node.label, node.x, node.y - (node.label.includes("\n") ? 10 : -8))}
      </g>
    `;
  }

  const half = node.width / 2;
  const points = [
    `${node.x},${node.y - half}`,
    `${node.x + half},${node.y}`,
    `${node.x},${node.y + half}`,
    `${node.x - half},${node.y}`,
  ].join(" ");

  return `
    <g>
      <polygon points="${points}" fill="${palette.boxFill}" stroke="${palette.boxStroke}" stroke-width="2" />
      ${textLines(node.label, node.x, node.y - (node.label.includes("\n") ? 8 : -8), { fontSize: 21 })}
    </g>
  `;
}

function renderEdge(edge) {
  const path = edge.points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point[0]} ${point[1]}`)
    .join(" ");

  return `<path d="${path}" fill="none" stroke="${palette.line}" stroke-width="2.5" marker-end="url(#arrow)" stroke-linecap="round" stroke-linejoin="round" />`;
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <defs>
    <marker id="arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="${palette.line}" />
    </marker>
  </defs>

  <rect width="${canvas.width}" height="${canvas.height}" fill="${palette.bg}" />

  <g>
    <rect x="70" y="50" width="255" height="48" rx="0" fill="${palette.tagFill}" />
    <text x="198" y="80" text-anchor="middle" font-size="22" font-weight="700" fill="${palette.tagText}">CLARA FLOWCHART</text>
    <text x="${centerX}" y="122" text-anchor="middle" font-size="54" font-weight="800" fill="${palette.title}">Readable Master Flow</text>
  </g>

  <g>
    ${edges.map(renderEdge).join("\n")}
  </g>

  <g>
    ${decisionLabel(505, 1710, "Ya")}
    ${decisionLabel(1100, 1710, "Tidak")}
    ${decisionLabel(505, 2950, "Ya")}
    ${decisionLabel(1100, 2950, "Tidak")}
  </g>

  <g>
    ${nodes.map(renderNode).join("\n")}
  </g>
</svg>
`.trim();

const html = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CLARA Readable Flowchart</title>
    <style>
      html, body {
        margin: 0;
        background: #050505;
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
