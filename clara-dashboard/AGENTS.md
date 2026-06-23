<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CLARA Dashboard Rules

## Scope

File ini memberi instruction khusus untuk area `clara-dashboard`.
Selalu baca bersamaan dengan root [AGENTS.md](/Users/newsmaker23/Projects/clara/AGENTS.md:1).

Dokumen acuan utama:

- `docs/UX_FLOW.md`
- `docs/UI_SPEC.md`
- `docs/PRD.md`
- `docs/API_SPEC.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/TEST_PLAN.md`

## Dashboard Mission

Dashboard CLARA adalah **operational workspace**, bukan dashboard statistik semata.

Prioritas utama UI:

1. queue-to-action cepat
2. context before action
3. role-based clarity
4. AI as copilot, bukan pengganggu
5. drill-down yang jelas

## UX Priorities

Saat mengubah UI:

- utamakan flow `queue -> conversation detail -> reply/follow-up`
- jangan membuat user tenggelam di card statistik
- informasi penting harus muncul duluan
- CTA utama harus jelas
- source data harus lebih dominan daripada derived insight
- empty/loading/error state wajib dipikirkan

## Role Awareness

Perbedaan role harus terlihat dan konsisten:

- `sales`: kerja harian, queue, lead, follow-up
- `manager`: review center, team insights
- `head`: monitoring lintas team, KPI, knowledge
- `superadmin`: access control dan governance

Jangan menampilkan navigasi atau action yang membuat role terlihat punya akses yang sebenarnya tidak dimiliki backend.

## Security Expectations

- jangan menyimpan secret di bundle frontend
- semua mutating request berbasis cookie harus tetap kirim `X-CSRF-Token`
- jangan menganggap hidden button = authorization
- jangan bocorkan data lintas org/team lewat prefetch, cache, atau client state

## API Contract Discipline

- jangan mengubah asumsi payload/response tanpa cek `docs/API_SPEC.md`
- kalau backend contract berubah, update konsumsi UI dengan eksplisit
- tangani error API secara operasional, bukan generik

## AI UX Rules

Untuk AI analysis dan reply suggestion:

- tampilkan AI sebagai bantuan, bukan keputusan final
- jangan framing output AI seolah selalu benar
- approval, sent status, dan context harus jelas
- fallback UI harus tetap usable saat AI gagal atau lambat

## Coding Direction

- pertahankan komponen yang mudah dibaca
- jangan refactor besar tanpa kebutuhan jelas
- lebih baik perubahan kecil yang menjaga flow daripada abstraction berat
- hati-hati dengan state yang bisa bikin context conversation hilang saat navigasi

## Validation Checklist

Sebelum selesai, cek:

- apakah sales masih bisa bergerak cepat dari queue ke detail?
- apakah role tertentu melihat halaman/action yang tepat?
- apakah state error/loading tidak merusak workflow?
- apakah request mutating tetap bawa CSRF?
- apakah perubahan aman untuk demo flow?
