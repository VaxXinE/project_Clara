import { Fragment, type ReactNode } from "react";

/**
 * Menampilkan teks markdown sederhana (judul, daftar, tabel, kutipan, tebal, miring, kode) sebagai elemen React.
 * Isinya tidak pernah dimasukkan sebagai HTML mentah, jadi tag di dalam teks tampil apa adanya sebagai teks.
 * Tautan sengaja tidak dibuat bisa diklik.
 */

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "rule" };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseBlocks(source: string): Block[] {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    if (line.trim().startsWith("```")) {
      flushParagraph();
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index++;
      }
      blocks.push({ type: "code", text: codeLines.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      continue;
    }

    if (RULE.test(line)) {
      flushParagraph();
      blocks.push({ type: "rule" });
      continue;
    }

    if (
      TABLE_ROW.test(line) &&
      index + 1 < lines.length &&
      TABLE_SEPARATOR.test(lines[index + 1])
    ) {
      flushParagraph();
      const header = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && TABLE_ROW.test(lines[index])) {
        rows.push(splitRow(lines[index]));
        index++;
      }
      index--;
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      flushParagraph();
      const ordered = NUMBERED.test(line) && !BULLET.test(line);
      const items: string[] = [];
      while (
        index < lines.length &&
        (ordered ? NUMBERED : BULLET).test(lines[index])
      ) {
        items.push(
          (
            (ordered ? NUMBERED : BULLET).exec(lines[index]) as RegExpExecArray
          )[1].trim(),
        );
        index++;
      }
      index--;
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (line.trim().startsWith(">")) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index++;
      }
      index--;
      blocks.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  return blocks;
}

/** Tebal, miring, dan kode di dalam satu baris. Selain itu tampil sebagai teks biasa. */
function renderInline(text: string): ReactNode {
  const parts = text.split(
    /(\*\*[^*]+\*\*|`[^`]+`|(?<![*\w])\*[^*\s][^*]*\*(?![*\w]))/g,
  );

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-semibold clara-text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={index}
          className="rounded bg-clara-sunken px-1.5 py-0.5 text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-xl font-bold",
  2: "text-lg font-bold",
  3: "text-base font-bold",
  4: "text-base font-semibold",
  5: "text-sm font-semibold",
  6: "text-sm font-semibold",
};

export function MarkdownView({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="space-y-4 text-[15px] leading-7 clara-text-secondary">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading": {
            const className = `${HEADING_CLASS[block.level] ?? "text-base font-semibold"} mt-6 clara-text-primary first:mt-0`;
            return block.level <= 2 ? (
              <h3 key={index} className={className}>
                {renderInline(block.text)}
              </h3>
            ) : (
              <h4 key={index} className={className}>
                {renderInline(block.text)}
              </h4>
            );
          }
          case "paragraph":
            return (
              <p key={index} className="break-words">
                {renderInline(block.text)}
              </p>
            );
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag
                key={index}
                className={`space-y-1.5 pl-6 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-clara-gold`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="break-words pl-1">
                    {renderInline(item)}
                  </li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return (
              <blockquote
                key={index}
                className="border-l-4 border-clara-line bg-clara-sunken px-4 py-2 italic"
              >
                {renderInline(block.text)}
              </blockquote>
            );
          case "code":
            return (
              <pre
                key={index}
                className="clara-scrollbar overflow-x-auto rounded-xl bg-clara-sunken p-4 text-sm leading-6 clara-text-primary"
              >
                {block.text}
              </pre>
            );
          case "table":
            return (
              <div
                key={index}
                className="clara-scrollbar overflow-x-auto rounded-xl border border-clara-line-subtle"
              >
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-clara-sunken">
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th
                          key={cellIndex}
                          scope="col"
                          className="whitespace-nowrap px-3 py-2 text-left font-semibold clara-text-primary"
                        >
                          {renderInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-t border-clara-line-subtle"
                      >
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 align-top">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "rule":
            return <hr key={index} className="border-clara-line-subtle" />;
        }
      })}
    </div>
  );
}

/** Cuplikan teks biasa dari markdown, untuk pratinjau di daftar. Tanda markdown dibuang. */
export function markdownPreview(content: string, maxLength = 150): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|?\s*:?-{2,}[-:|\s]*$/gm, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•>]\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return plain.length <= maxLength
    ? plain
    : `${plain.slice(0, maxLength).trimEnd()}...`;
}
