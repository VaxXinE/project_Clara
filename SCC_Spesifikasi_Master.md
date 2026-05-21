# SCC_Spesifikasi_Master

## SGB Sales Command Center --- Master System Documentation v1

# 1. System Purpose

SCC (Sales Command Center) adalah execution operating system untuk
operasional harian sales.

Masalah yang diselesaikan:

-   Follow-up chaos
-   Data tercecer (WA, spreadsheet, catatan)
-   Tidak ada audit trail
-   Sulit mengukur disiplin operasional
-   Tidak jelas siapa mengerjakan apa

User:

-   Sales
-   Head
-   Superadmin

------------------------------------------------------------------------

# 2. System Philosophy

Prinsip:

-   SCC = operational truth
-   Execution \> reporting
-   Queue \> dashboard
-   Human owns workflow
-   Timeline = audit trail
-   Derived intelligence tidak boleh overwrite truth

Operational stance:

Dashboard → orientasi\
Queue → kerja\
Timeline → audit

------------------------------------------------------------------------

# 3. Role Structure

## Sales

Tugas:

-   Menjalankan queue
-   Follow up
-   Chat
-   Update aktivitas

Akses:

-   Lead milik sendiri
-   Queue milik sendiri
-   Aktivitas

## Head

Tugas:

-   Supervisi
-   Rebalance beban
-   Monitor SLA

## Superadmin

Tugas:

-   Governance
-   Audit
-   Konfigurasi sistem

------------------------------------------------------------------------

# 4. Feature Map

## Lead

Input: - Quick capture - WA - Assignment

Output: - Status - Owner - Pipeline

Dependencies: - Timeline - Snapshot

## Queue

Purpose:

Work mode harian

CTA:

-   Chat now
-   Done
-   Snooze
-   Dismiss

## Action Center

Operational pressure:

-   overdue
-   warm uncontacted
-   ghost risk
-   hot opportunity

## Timeline

Audit trail event

## Snapshot Layer

Generate:

-   priority_score
-   overdue
-   ghost risk
-   next action

## WhatsApp

Sumber aktivitas utama

------------------------------------------------------------------------

# 5. Domain Model

Truth:

-   Lead
-   Timeline
-   Messages

Derived:

-   Snapshot
-   Queue

Relationship:

Lead → Timeline Events → Messages → Snapshot → Queue State

------------------------------------------------------------------------

# 6. Workflow

Lead Created → Assignment → Queue → Action → Timeline → Snapshot
Recompute → Progress → Closing/Lost

Loop berjalan sampai selesai.

------------------------------------------------------------------------

# 7. Event Map

-   lead.created
-   lead.status_changed
-   lead.owner_changed
-   whatsapp.message_received
-   queue.action_done
-   queue.action_snooze
-   queue.action_dismiss

Pattern:

Write truth → Timeline → Snapshot → Queue rerank

------------------------------------------------------------------------

# 8. System Context

External:

-   Ads
-   WhatsApp WebJS
-   Arya
-   Queue Worker
-   Redis
-   MySQL

Flow:

Ads → WA → SCC → Queue → API → Arya → Insight → SCC

------------------------------------------------------------------------

# 9. Non Functional Requirements

Queue response: \<500ms

Snapshot recompute: \<5s

AI callback: \<30s

Queue page: 25 item default

System target:

20--500 sales

------------------------------------------------------------------------

# 10. Architecture Decision Record

ADR-001

Decision: Queue-first architecture

Reason:

Sales membutuhkan next action, bukan dashboard KPI.

Tradeoff:

Dashboard menjadi sekunder.

------------------------------------------------------------------------

# 11. Current Technical Debt

-   Scoring masih rule heavy
-   Queue belum bulk action
-   Recompute bisa berat
-   WebJS masih operational risk

------------------------------------------------------------------------

# 12. Future Roadmap

Sprint:

1.  Queue lifecycle hardening
2.  SLA countdown
3.  Timeline maturity
4.  Assignment evolution
5.  Performance scaling
6.  Arya integration

------------------------------------------------------------------------

# Final Principle

SCC bukan reporting app.

SCC adalah execution cockpit.

Pertanyaan utama:

"Apakah sistem membuat sales bekerja lebih cepat, jelas, dan terukur?"
