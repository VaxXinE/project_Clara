/** Kategori knowledge di database memakai kode internal. Ini kata sehari-harinya, urut dari yang paling penting dibaca. */
const TOPICS: Array<{ key: string; label: string }> = [
  { key: "product_reference", label: "Produk, kontrak, dan biaya" },
  { key: "faq", label: "Tanya jawab (FAQ)" },
  { key: "official_legality", label: "Legalitas dan izin" },
  { key: "official_source", label: "Sumber resmi perusahaan" },
  { key: "general", label: "Pengetahuan umum" },
  { key: "product_facts", label: "Fakta produk" },
  { key: "positioning", label: "Posisi produk" },
  { key: "objection_handling", label: "Menjawab keberatan customer" },
  { key: "closing_engine", label: "Mengarahkan ke closing" },
  { key: "conversion_engine", label: "Alur menuju closing" },
  { key: "workflow", label: "Alur percakapan" },
  { key: "handoff", label: "Serah terima ke Sales" },
  { key: "guardrail", label: "Batas yang tidak boleh dilanggar Clara" },
  { key: "instruction", label: "Instruksi dasar Clara" },
  { key: "personality_mode", label: "Gaya bicara Clara" },
  { key: "auto_adapt", label: "Menyesuaikan gaya ke customer" },
  { key: "training_examples", label: "Contoh percakapan latihan" },
];

function humanize(value: string): string {
  const text = value.replaceAll("_", " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Lainnya";
}

export function knowledgeTopic(category: string): {
  label: string;
  order: number;
} {
  const index = TOPICS.findIndex((topic) => topic.key === category);

  return index >= 0
    ? { label: TOPICS[index].label, order: index }
    : { label: humanize(category), order: TOPICS.length };
}

/**
 * Judul dokumen sering berbentuk "Mini | 02 Solid Prime FAQ Answer Library". Awalan jenis akun dan nomor urut
 * dipisahkan supaya judulnya enak dibaca, dan jenis akunnya bisa tampil sebagai tag.
 */
export function parseKnowledgeTitle(title: string): {
  account: "mini" | "reguler" | null;
  name: string;
} {
  const match = /^\s*(mini|regular|reguler)\s*\|\s*(.*)$/i.exec(title);
  const rest = (match ? match[2] : title).replace(/^\d{1,2}\s+/, "").trim();

  return {
    account: match
      ? match[1].toLowerCase() === "mini"
        ? "mini"
        : "reguler"
      : null,
    name: rest || title,
  };
}

export type AccountFilter = "all" | "mini" | "reguler";

export function matchesAccount(title: string, filter: AccountFilter): boolean {
  return filter === "all" || parseKnowledgeTitle(title).account === filter;
}
