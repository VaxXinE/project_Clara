--
-- PostgreSQL database dump
--

\restrict qml3vHpDUaQZa93PfaMVEcbgF0WFVLT4eQaRSl6Zmw0LLMu7avYzarblbucoqm7

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_extractions; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.ai_extractions (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    model_name character varying(100) NOT NULL,
    schema_version character varying(50) NOT NULL,
    lead_temperature character varying(20) NOT NULL,
    pipeline_stage character varying(50) NOT NULL,
    buying_intent character varying(20) NOT NULL,
    sentiment character varying(30) NOT NULL,
    risk_level character varying(20) NOT NULL,
    main_objections jsonb NOT NULL,
    budget_signal jsonb NOT NULL,
    recommended_reply_strategy jsonb NOT NULL,
    customer_summary text NOT NULL,
    next_best_action text NOT NULL,
    content_insight text NOT NULL,
    internal_notes text NOT NULL,
    confidence_score double precision NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.ai_extractions OWNER TO clara_user;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO clara_user;

--
-- Name: approval_logs; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.approval_logs (
    id uuid NOT NULL,
    reply_suggestion_id uuid NOT NULL,
    reviewer_name character varying(255) NOT NULL,
    action character varying(50) NOT NULL,
    before_text text,
    after_text text,
    reason text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.approval_logs OWNER TO clara_user;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    actor_user_id character varying(100),
    actor_email character varying(255),
    actor_role character varying(50),
    action character varying(100) NOT NULL,
    resource_type character varying(100) NOT NULL,
    resource_id character varying(100),
    ip_address character varying(100),
    user_agent text,
    metadata_json jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    organization_id character varying(100)
);


ALTER TABLE public.audit_logs OWNER TO clara_user;

--
-- Name: chat_review_cases; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.chat_review_cases (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    organization_id uuid,
    lead_id uuid,
    submitted_by_user_id uuid,
    reviewer_user_id uuid,
    status character varying(50) NOT NULL,
    review_label character varying(50) NOT NULL,
    review_summary text,
    coaching_focus text,
    recommended_action text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    workflow_scope character varying(50) NOT NULL,
    feedback_status character varying(30) NOT NULL,
    feedback_sent_at timestamp with time zone,
    feedback_acknowledged_at timestamp with time zone,
    feedback_resolved_at timestamp with time zone
);


ALTER TABLE public.chat_review_cases OWNER TO clara_user;

--
-- Name: chat_review_notes; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.chat_review_notes (
    id uuid NOT NULL,
    review_case_id uuid NOT NULL,
    author_user_id uuid,
    note_type character varying(50) NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.chat_review_notes OWNER TO clara_user;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.conversations (
    id uuid NOT NULL,
    title character varying(255) NOT NULL,
    source character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    current_stage character varying(50) NOT NULL,
    lead_temperature character varying(20) NOT NULL,
    raw_filename character varying(255),
    raw_text text,
    started_at timestamp with time zone,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    organization_id uuid,
    sales_user_id uuid,
    lead_id uuid,
    provider_key character varying(50),
    external_thread_key character varying(255)
);


ALTER TABLE public.conversations OWNER TO clara_user;

--
-- Name: customer_profiles; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.customer_profiles (
    id uuid NOT NULL,
    organization_id uuid,
    assigned_user_id uuid,
    display_name character varying(255) NOT NULL,
    canonical_key character varying(255) NOT NULL,
    last_contact_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    identity_confidence double precision NOT NULL,
    match_strategy character varying(50) NOT NULL,
    merge_notes text,
    merged_into_profile_id uuid,
    phone character varying(50),
    email character varying(255),
    address text,
    status character varying(20) NOT NULL,
    temperature character varying(20) NOT NULL,
    temperature_source character varying(20) NOT NULL
);


ALTER TABLE public.customer_profiles OWNER TO clara_user;

--
-- Name: knowledge_update_proposals; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.knowledge_update_proposals (
    id uuid NOT NULL,
    organization_id uuid,
    conversation_id uuid NOT NULL,
    chat_review_case_id uuid,
    lead_id uuid,
    proposed_by_user_id uuid,
    reviewed_by_user_id uuid,
    published_product_knowledge_id uuid,
    title character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    proposed_content text NOT NULL,
    source_type character varying(50) NOT NULL,
    rationale text,
    status character varying(50) NOT NULL,
    review_decision_note text,
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    published_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.knowledge_update_proposals OWNER TO clara_user;

--
-- Name: kpi_alert_records; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.kpi_alert_records (
    id uuid NOT NULL,
    organization_id uuid,
    acknowledged_by_user_id uuid,
    scope_type character varying(20) NOT NULL,
    alert_key character varying(255) NOT NULL,
    severity character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    recommended_action text NOT NULL,
    target_href character varying(255),
    status character varying(30) NOT NULL,
    first_detected_at timestamp with time zone NOT NULL,
    last_detected_at timestamp with time zone NOT NULL,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    resolved_by_user_id uuid,
    resolution_note text
);


ALTER TABLE public.kpi_alert_records OWNER TO clara_user;

--
-- Name: kpi_command_snapshots; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.kpi_command_snapshots (
    id uuid NOT NULL,
    organization_id uuid,
    scope_type character varying(20) NOT NULL,
    snapshot_type character varying(30) NOT NULL,
    metrics_json jsonb NOT NULL,
    observations_json jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.kpi_command_snapshots OWNER TO clara_user;

--
-- Name: lead_activity_events; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.lead_activity_events (
    id uuid NOT NULL,
    lead_id uuid NOT NULL,
    organization_id uuid,
    actor_user_id uuid,
    event_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    from_value text,
    to_value text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.lead_activity_events OWNER TO clara_user;

--
-- Name: lead_deals; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.lead_deals (
    id uuid NOT NULL,
    lead_id uuid NOT NULL,
    organization_id uuid,
    owner_user_id uuid,
    status character varying(30) NOT NULL,
    currency character varying(10) NOT NULL,
    expected_value numeric(18,2) NOT NULL,
    deposit_amount numeric(18,2) NOT NULL,
    expected_close_date date,
    closed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.lead_deals OWNER TO clara_user;

--
-- Name: lead_discipline_logs; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.lead_discipline_logs (
    id uuid NOT NULL,
    lead_id uuid NOT NULL,
    organization_id uuid,
    actor_user_id uuid,
    log_date date NOT NULL,
    activity_type character varying(100) NOT NULL,
    result_status character varying(100) NOT NULL,
    main_objection text,
    customer_mood character varying(100),
    notes text,
    next_follow_up_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.lead_discipline_logs OWNER TO clara_user;

--
-- Name: lead_task_events; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.lead_task_events (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    actor_user_id uuid,
    event_type character varying(50) NOT NULL,
    from_status character varying(20),
    to_status character varying(20),
    previous_due_at timestamp with time zone,
    next_due_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.lead_task_events OWNER TO clara_user;

--
-- Name: lead_tasks; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.lead_tasks (
    id uuid NOT NULL,
    lead_id uuid NOT NULL,
    organization_id uuid,
    assigned_user_id uuid,
    task_type character varying(50) NOT NULL,
    status character varying(30) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    due_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    completed_by_user_id uuid,
    last_status_changed_at timestamp with time zone NOT NULL,
    workflow_scope character varying(50) NOT NULL,
    requested_by_role character varying(30)
);


ALTER TABLE public.lead_tasks OWNER TO clara_user;

--
-- Name: leads; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.leads (
    id uuid NOT NULL,
    organization_id uuid,
    assigned_user_id uuid,
    display_name character varying(255) NOT NULL,
    source character varying(50) NOT NULL,
    current_stage character varying(50) NOT NULL,
    lead_temperature character varying(20) NOT NULL,
    summary text,
    notes text,
    last_contact_at timestamp with time zone,
    next_follow_up_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    customer_profile_id uuid,
    account_category character varying(20) NOT NULL
);


ALTER TABLE public.leads OWNER TO clara_user;

--
-- Name: marketing_execution_items; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.marketing_execution_items (
    id uuid NOT NULL,
    organization_id uuid,
    created_by_user_id uuid,
    assigned_user_id uuid,
    item_type character varying(50) NOT NULL,
    source_kind character varying(50) NOT NULL,
    status character varying(30) NOT NULL,
    priority character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    summary text NOT NULL,
    recommended_action text NOT NULL,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    campaign_name character varying(255),
    result_notes text,
    published_at timestamp with time zone,
    leads_generated integer NOT NULL,
    qualified_leads integer NOT NULL,
    won_leads integer NOT NULL,
    attributed_pipeline_value numeric(18,2) NOT NULL,
    attributed_won_value numeric(18,2) NOT NULL,
    attributed_deposit_amount numeric(18,2) NOT NULL
);


ALTER TABLE public.marketing_execution_items OWNER TO clara_user;

--
-- Name: marketing_insight_snapshots; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.marketing_insight_snapshots (
    id uuid NOT NULL,
    organization_id uuid,
    scope_type character varying(20) NOT NULL,
    snapshot_type character varying(20) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    metrics_json jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.marketing_insight_snapshots OWNER TO clara_user;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.messages (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    sender_name character varying(255) NOT NULL,
    sender_type character varying(50) NOT NULL,
    message_text text NOT NULL,
    message_timestamp timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    external_message_id character varying(255)
);


ALTER TABLE public.messages OWNER TO clara_user;

--
-- Name: ops_notifications; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.ops_notifications (
    id uuid NOT NULL,
    organization_id uuid,
    user_id uuid,
    acknowledged_by_user_id uuid,
    source_type character varying(50) NOT NULL,
    source_key character varying(255) NOT NULL,
    severity character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    target_href character varying(255),
    status character varying(20) NOT NULL,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    delivery_channel character varying(30) NOT NULL,
    delivery_status character varying(20) NOT NULL,
    escalation_level character varying(20) NOT NULL,
    resolution_note text,
    delivered_at timestamp with time zone,
    escalated_at timestamp with time zone,
    workflow_scope character varying(50) NOT NULL,
    owner_role character varying(30) NOT NULL,
    target_role character varying(30) NOT NULL
);


ALTER TABLE public.ops_notifications OWNER TO clara_user;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.organizations (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.organizations OWNER TO clara_user;

--
-- Name: product_knowledge; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.product_knowledge (
    id uuid NOT NULL,
    organization_id uuid,
    title character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    content text NOT NULL,
    source_type character varying(50) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    created_by_user_id uuid
);


ALTER TABLE public.product_knowledge OWNER TO clara_user;

--
-- Name: reply_suggestions; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.reply_suggestions (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    ai_extraction_id uuid NOT NULL,
    model_name character varying(100) NOT NULL,
    schema_version character varying(50) NOT NULL,
    risk_level character varying(20) NOT NULL,
    action_mode character varying(50) NOT NULL,
    approval_status character varying(50) NOT NULL,
    suggested_replies jsonb NOT NULL,
    policy_reasons jsonb NOT NULL,
    selected_reply_text text,
    final_reply_text text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.reply_suggestions OWNER TO clara_user;

--
-- Name: sales_teams; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.sales_teams (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    unit_id uuid,
    manager_user_id uuid,
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.sales_teams OWNER TO clara_user;

--
-- Name: sales_units; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.sales_units (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.sales_units OWNER TO clara_user;

--
-- Name: sent_messages; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.sent_messages (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    reply_suggestion_id uuid,
    send_mode character varying(50) NOT NULL,
    message_text text NOT NULL,
    sent_by_name character varying(255) NOT NULL,
    external_message_id character varying(255),
    sent_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.sent_messages OWNER TO clara_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: clara_user
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    hashed_password character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    organization_id uuid,
    created_by_user_id uuid,
    team_id uuid
);


ALTER TABLE public.users OWNER TO clara_user;

--
-- Data for Name: ai_extractions; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.ai_extractions (id, conversation_id, model_name, schema_version, lead_temperature, pipeline_stage, buying_intent, sentiment, risk_level, main_objections, budget_signal, recommended_reply_strategy, customer_summary, next_best_action, content_insight, internal_notes, confidence_score, created_at) FROM stdin;
723b3a90-9562-4e40-a933-42fe526e5cf0	3db559c2-41f6-425c-ada3-e6564da25422	gpt-4.1-mini	v1	warm	qualification	medium	neutral	medium	["legalitas program"]	{"notes": "Tidak ada informasi mengenai budget", "detected": false, "amount_text": null}	{"tone": "professional", "key_points": ["Jelaskan legalitas dengan bukti resmi", "Bersikap responsif dan meyakinkan"], "avoid_topics": ["harga", "promosi yang belum jelas"]}	Customer mempertanyakan kelegalan program, menunjukkan perhatian pada aspek legalitas sebelum melanjutkan pembicaraan.	Kirim dokumen legalitas resmi dan tindak lanjuti dengan menjelaskan benefit program secara detail.	Fokus customer pada aspek legalitas, menandakan tahap kualifikasi dengan keraguan legalitas.	Perlu segera mengirimkan dokumen legalitas agar customer merasa aman dan percaya.	0.9	2026-05-26 09:15:51.836509+00
b0e8e660-8767-451a-a093-b01198529ffb	3db559c2-41f6-425c-ada3-e6564da25422	gpt-4.1-mini	v1	warm	qualification	medium	cautious	medium	["legalitas program"]	{"notes": "Tidak ada pembicaraan terkait anggaran.", "detected": false, "amount_text": null}	{"tone": "professional", "key_points": ["Berikan informasi legalitas yang jelas dan dokumen resmi", "Yakinkan customer soal keabsahan program"], "avoid_topics": ["harga", "promo yang belum jelas"]}	Customer menanyakan tentang legalitas program, menunjukkan ketertarikan dengan keraguan terkait aspek legal.	Kirim dokumen resmi yang membuktikan legalitas program dan tawarkan kesempatan untuk bertanya lebih lanjut.	Customer masih dalam tahap evaluasi, fokus pada aspek kelegalan produk.	Persiapkan dokumen legalitas dan siapkan jawaban untuk pertanyaan serupa tentang legalitas.	0.9	2026-05-26 09:31:10.857249+00
a71749f6-3566-4aa3-afc0-f210800f9dd5	3db559c2-41f6-425c-ada3-e6564da25422	gpt-4.1-mini	v1	warm	education	medium	neutral	medium	["legalitas program"]	{"notes": "Tidak ada informasi anggaran yang disebutkan dalam percakapan.", "detected": false, "amount_text": null}	{"tone": "professional", "key_points": ["Pastikan untuk memberikan dokumen legalitas resmi sebagai bukti keabsahan program.", "Jelaskan bahwa program diawasi oleh BAPPEBTI sesuai regulasi.", "Tawarkan keterangan lebih lanjut apabila diperlukan."], "avoid_topics": ["harga", "refund", "garansi"]}	Customer menanyakan mengenai legalitas program, menunjukkan keraguan atau kebutuhan konfirmasi mengenai keabsahan program.	Kirim dokumen legalitas resmi dan tawarkan informasi tambahan atau konfirmasi lebih lanjut mengenai program.	Customer memiliki perhatian utama pada aspek legalitas program. Sales sudah memberikan jawaban dan menawarkan dokumen legalitas sebagai bukti.	Pastikan segera follow up pengiriman dokumen legalitas untuk menjaga minat customer.	0.95	2026-05-29 01:36:02.071293+00
83758b7d-bc56-4ad9-990f-2e6b206b9b2a	d8dc1bef-c282-4bcd-9468-19b12d65bc90	gpt-4.1-mini	v1	cold	unknown	low	cautious	low	[]	{"notes": "Tidak ada indikasi anggaran atau pembahasan produk/layanan.", "detected": false, "amount_text": null}	{"tone": "empathetic", "key_points": ["Tunjukkan empati dan dukungan moral", "Hindari pembicaraan terkait penjualan saat suasana emosional"], "avoid_topics": ["Penawaran produk", "Negosiasi harga", "Teknis penjualan"]}	Customer sedang dalam kondisi emosional terkait kondisi pasca operasi kucingnya, menunjukkan dukungan dan empati, tidak ada pembahasan terkait produk atau penawaran.	Fokus memberikan dukungan emosional dan menjalin hubungan personal sebelum melanjutkan pembahasan penjualan.	Percakapan lebih bersifat pribadi dan emosional, bukan diskusi terkait produk atau layanan.	Hindari pendekatan penjualan saat customer sedang menghadapi situasi emosional; tunggu waktu yang lebih tepat untuk pendekatan sales.	0.85	2026-05-29 04:31:07.50561+00
8fcc181c-053f-4d7d-829e-9d9174a2683d	93619231-dc0a-4756-9df3-2b824355d3f1	gpt-4.1-mini	v1	warm	qualification	medium	neutral	low	["keamanan layanan", "proses perpindahan"]	{"notes": "Tidak ada pembahasan tentang budget atau harga dalam percakapan.", "detected": false, "amount_text": null}	{"tone": "professional", "key_points": ["Jelaskan keamanan layanan secara rinci", "Tegaskan prosedur perpindahan dan confirm waktu pelaksanaan", "Jaga komunikasi tetap responsif dan ramah"], "avoid_topics": ["pembahasan harga", "janjian hasil"]}	Pelanggan mulai menunjukkan minat dengan mempertanyakan keamanan dan kepastian perpindahan layanan, menunggu konfirmasi lebih lanjut sambil tetap mempertimbangkan.	Berikan penjelasan detail mengenai aspek keamanan dan proses perpindahan agar pelanggan semakin yakin, kemudian tawarkan opsi langkah selanjutnya.	Terdapat pertanyaan eksplisit tentang keamanan dan perpindahan layanan, yang menjadi point utama pelanggan sebelum melangkah lebih lanjut.	Sales perlu mempersiapkan materi keamanan layanan dan rancangan proses perpindahan yang jelas untuk menjawab kekhawatiran pelanggan.	0.85	2026-05-29 04:33:26.5843+00
87843aad-dcd1-418b-b91b-faaba8cf5f0b	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	gpt-4.1-mini	v1	warm	qualification	medium	neutral	low	[]	{"notes": "Tidak ada pembahasan soal harga atau budget dalam percakapan.", "detected": false, "amount_text": null}	{"tone": "friendly", "key_points": ["Jelaskan prosedur dan dokumen yang diperlukan secara jelas dan ramah", "Bantu customer memahami proses dengan detail agar tidak bingung", "Berikan informasi lokasi dan waktu secara informatif"], "avoid_topics": ["Harga", "Isu hukum atau refund", "Topik sensitif lainnya"]}	Customer bertanya terkait dokumen dan proses administrasi seperti foto 4x6, bukti pembayaran, lokasi pengambilan dokumen, dan tata cara print bukti pembayaran. Customer menunjukkan minat yang cukup tinggi untuk memahami proses namun belum ada indikasi keputusan pembelian yang final.	Sales harus responsif dan memberikan informasi detil serta memastikan customer tidak bingung terkait proses administrasi dan lokasi pengambilan, agar mempermudah langkah selanjutnya.	Percakapan sebagian besar membahas proses administrasi dan persyaratan dokumen dengan customer yang aktif bertanya untuk memastikan kelengkapan. Tidak ditemukan isu signifikan terkait keberatan harga atau risiko tinggi.	Customer tampak kooperatif dan fokus pada hal teknis administrasi. Tidak ada indikasi risiko tinggi atau keberatan serius sehingga pendekatan friendly dan informatif cocok.	0.9	2026-05-29 04:34:44.361676+00
a218a3a8-3fb4-4a3b-80c0-a8053f03eed2	d8dc1bef-c282-4bcd-9468-19b12d65bc90	gpt-4.1-mini	v1	cold	unknown	low	cautious	low	[]	{"notes": "Tidak ada informasi tentang anggaran atau pembahasan harga.", "detected": false, "amount_text": null}	{"tone": "empathetic", "key_points": ["Tunjukkan empati dan dukungan emosional terhadap situasi personal customer."], "avoid_topics": ["penawaran produk", "harga", "pembayaran"]}	Customer menunjukkan perhatian dan empati terhadap kondisi personal sales, bersifat suportif dan penuh perhatian namun tidak ada indikasi minat membeli atau pembahasan produk.	Memberikan dukungan emosional dan menjaga komunikasi hangat tanpa memaksakan penawaran produk.	Percakapan berfokus pada dukungan emosional terkait kondisi personal sales, tidak ada tanda-tanda diskusi bisnis atau produk.	Percakapan lebih bersifat personal dan emosional, bukan sales lead atau pembicaraan terkait transaksi.	0.95	2026-05-29 05:49:29.267165+00
b880f5dc-c2eb-4346-8937-f6435d157fab	d8dc1bef-c282-4bcd-9468-19b12d65bc90	gpt-4.1-mini	v1	cold	unknown	low	cautious	low	[]	{"notes": "Tidak ada informasi tentang budget atau harga dalam percakapan.", "detected": false, "amount_text": null}	{"tone": "empathetic", "key_points": ["Tunjukkan empati terhadap kondisi customer dan keadaan yang dialami.", "Berikan dukungan moral yang positif dan penuh perhatian.", "Hindari pembahasan yang terlalu teknis atau penjualan karena minat beli tidak terlihat."], "avoid_topics": ["promo", "harga", "pembayaran", "penutupan penjualan"]}	Customer sedang dalam kondisi emosional yang sensitif karena kondisi pasca operasi seseorang bernama Mona. Customer menunjukkan dukungan emosional dan perhatian besar, tetapi tidak ada indikasi terkait niat membeli produk atau jasa dari sales.	Fokus pada dukungan empati dan bangun hubungan kepercayaan sebelum mencoba menawarkan sesuatu lebih lanjut.	Percakapan didominasi oleh dukungan emosional dan perhatian atas situasi pribadi yang sulit, tanpa diskusi terkait produk atau layanan.	Lead ini sedang tidak menunjukkan minat pembelian atau diskusi terkait produk. Lebih tepat dianggap sebagai kontak personal bukan prospek penjualan saat ini.	0.85	2026-05-29 05:51:08.258963+00
069e0561-dc29-4569-9479-5cb4de903a1b	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	gpt-4.1-mini	v1	cold	new_lead	low	neutral	low	[]	{"notes": "Tidak ada informasi tentang budget atau harga.", "detected": false, "amount_text": null}	{"tone": "friendly", "key_points": ["Menjawab pertanyaan customer dengan ramah", "Mengajak untuk percakapan lanjut namun tidak memaksa"], "avoid_topics": ["harga", "negosiasi", "komitmen pembelian"]}	Customer hanya memberikan informasi singkat tentang lokasi turun kereta dan moda transportasi berikutnya.	Menindaklanjuti dengan pertanyaan ringan yang relevan untuk membangun hubungan, tanpa memaksa penawaran.	Customer belum menunjukkan minat atau keberatan terkait produk, hanya menjawab pertanyaan sederhana dari sales.	Interaksi awal, belum ada sinyal minat atau keberatan serius dari customer.	0.85	2026-05-29 05:51:57.792133+00
f9f91105-87f3-4048-af43-61adf64115e5	59f1578d-d6a6-47a6-9950-541c2659e2f1	gpt-4.1-mini	v1	cold	new_lead	low	neutral	low	[]	{"notes": "Tidak ada pembicaraan terkait budget atau harga", "detected": false, "amount_text": null}	{"tone": "friendly", "key_points": ["Bangun hubungan baik dengan customer", "Berikan informasi produk secara singkat dan jelas", "Ajak customer untuk berdiskusi lebih lanjut jika berminat"], "avoid_topics": ["teknis rumit", "masalah pembayaran", "komplain"]}	Customer memberikan respon singkat dan terbatas, belum menunjukkan minat yang kuat terhadap produk atau penawaran. Percakapan sering bersifat santai dan tidak fokus pada pembelian.	Membangun komunikasi yang lebih menarik dan memberikan informasi produk dengan cara mudah dipahami untuk menggugah minat customer.	Percakapan banyak berisi sapaan dan interaksi santai; customer belum menunjukkan pertanyaan mendalam atau ketertarikan spesifik pada produk.	Customer masih pasif, perlu pendekatan yang lebih proaktif dan edukatif. Hindari tekanan langsung jual beli karena customer masih belum siap.	0.85	2026-05-29 05:53:11.086509+00
b1af4939-0af5-43ce-92f1-77723dea27db	67343055-cd9f-4943-abcd-0016838210cd	gpt-4.1-mini	v1	cold	unknown	low	neutral	low	[]	{"notes": "Tidak ada indikasi pembicaraan tentang anggaran atau harga.", "detected": false, "amount_text": null}	{"tone": "friendly", "key_points": ["Sapa dengan ramah", "Informasikan keuntungan promo cashback", "Tanyakan kebutuhan lebih lanjut"], "avoid_topics": []}	Customer mengirimkan informasi promosi cashback dan promo pembayaran QRIS di OCTO secara berulang, tanpa respons langsung terhadap sales. Tidak ada indikasi minat beli atau tindakan lebih lanjut.	Tanyakan secara sopan apakah customer memerlukan informasi lebih lanjut atau bantuan terkait promo yang disebutkan.	Customer lebih banyak menyebarkan atau menampilkan informasi promo dari CIMB Niaga terkait cashback top up e-wallet dan pembayaran QRIS di OCTO, tanpa interaksi atau pertanyaan jelas.	Percakapan hanya berisi salinan promo dari customer tanpa diskusi, minat beli masih sangat rendah, dan tidak terdapat tanda-tanda prospek aktif.	0.85	2026-05-29 05:54:20.491037+00
b3f1b3e7-36a7-4302-b980-77d4d3e857ba	d8dc1bef-c282-4bcd-9468-19b12d65bc90	gpt-4.1-mini	v1	cold	unknown	low	cautious	low	[]	{"notes": "Tidak ada informasi terkait budget.", "detected": false, "amount_text": null}	{"tone": "empathetic", "key_points": ["Berikan dukungan emosional yang hangat dan pengertian.", "Hindari membahas penjualan secara langsung mengingat situasi emosional.", "Dorong komunikasi terbuka tanpa tekanan jualan."], "avoid_topics": ["Penjualan", "Harga", "Pembayaran", "Legalitas", "Garansi", "Refund"]}	Customer menunjukkan perhatian dan dukungan emosional kepada sales yang sedang mengalami kesulitan pribadi, tanpa membicarakan kebutuhan atau ketertarikan terhadap produk atau layanan. Interaksi lebih bersifat personal dan suportif.	Fokus pada membina hubungan personal dan memberikan dukungan emosional. Tunda pendekatan penjualan hingga kondisi customer lebih kondusif.	Percakapan lebih banyak berisi ungkapan empati dan dukungan dibandingkan pembicaraan bisnis atau penjualan.	Situasi percakapan mengindikasikan kondisi emosional sales yang sedang sulit sehingga kemungkinan besar customer belum siap untuk diskusi penjualan.	0.95	2026-05-29 06:31:43.367356+00
f911af02-6c29-40a6-a26a-717f7ae42c28	93619231-dc0a-4756-9df3-2b824355d3f1	gpt-4.1-mini	v1	warm	qualification	medium	neutral	medium	["keamanan", "perpindahan"]	{"notes": "Tidak ada informasi budget atau harga spesifik dalam percakapan", "detected": false, "amount_text": null}	{"tone": "professional", "key_points": ["Tegaskan keamanan produk atau layanan", "Jelaskan proses perpindahan secara jelas", "Tangani keraguan dengan memberikan detail teknis dan jaminan"], "avoid_topics": ["klaim hasil", "garansi berlebihan"]}	Customer menunjukkan minat dan bertanya tentang keamanan dan perpindahan layanan. Mereka terlihat cukup siap untuk melanjutkan, namun membutuhkan kepastian terkait aspek teknis dan keamanan.	Berikan penjelasan detail mengenai keamanan layanan dan proses perpindahan agar customer merasa yakin dan dapat melangkah ke tahap edukasi atau closing.	Customer menanyakan aspek keamanan dan apakah perpindahan layanan dilakukan, menunjukkan concern pada stabilitas dan risiko perpindahan.	Percakapan mengandung link google meet dan dokumen yang mungkin perlu dianalisis lebih lanjut oleh tim sales. Tidak terdapat diskusi harga atau penawaran spesifik.	0.85	2026-05-29 06:32:30.239099+00
70e8b571-985a-4f61-a5e7-032e619cfc16	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	gpt-4.1-mini	v1	cold	new_lead	low	neutral	low	[]	{"notes": "Tidak ada informasi mengenai budget atau harga", "detected": false, "amount_text": null}	{"tone": "friendly", "key_points": ["Beri salam dan kenalan", "Tanyakan kebutuhan dengan sopan", "Berikan info dasar produk atau layanan jika memungkinkan"], "avoid_topics": []}	Customer hanya memberikan jawaban singkat tentang lokasi turun kereta dan moda transportasi tanpa menunjukkan minat beli.	Melanjutkan dengan pertanyaan lebih spesifik tentang kebutuhan customer untuk membuka percakapan lebih lanjut.	Percakapan masih sangat dasar dan belum ada indikasi minat beli atau keberatan.	Customer belum menunjukkan ketertarikan terhadap produk atau layanan. Status lead masih sangat awal.	0.9	2026-05-29 06:33:20.689725+00
03a8af0e-aed5-4651-9537-168d0695b5e9	59f1578d-d6a6-47a6-9950-541c2659e2f1	gpt-4.1-mini	v1	cold	new_lead	low	neutral	low	[]	{"notes": "Tidak ada informasi terkait budget atau harga dalam percakapan.", "detected": false, "amount_text": null}	{"tone": "friendly", "key_points": ["Bangun rapport dengan customer secara santai dan ringan", "Jelaskan produk dengan sederhana jika customer bertanya", "Tanyakan kebutuhan customer secara langsung untuk memancing minat"], "avoid_topics": ["teknis rumit", "komplain", "negosiasi harga"]}	Customer cenderung memberikan respons singkat dan tidak menunjukkan minat kuat terhadap penawaran. Percakapan lebih bersifat santai dan casual tanpa arahan pembelian jelas.	Berikan penjelasan lebih jelas tentang produk dan keunggulannya, serta tanyakan kebutuhan atau masalah yang ingin diselesaikan customer untuk meningkatkan minat.	Customer belum memahami atau tertarik dengan produk yang ditawarkan, interaksi masih sangat santai dan tidak fokus pada penjualan.	Tidak ada sinyal kuat untuk melanjutkan pitching atau closing. Sales disarankan untuk mempererat hubungan dengan pendekatan non-teknis dan personal.	0.85	2026-05-29 06:35:16.971098+00
e84c29ec-553c-4569-93e0-7ff02d7136d7	b7191080-f685-4c04-b8a5-e7a48caeb188	gpt-4.1-mini	v1	cold	qualification	low	neutral	low	[]	{"notes": "Tidak ada indikasi pembicaraan mengenai anggaran atau harga", "detected": false, "amount_text": null}	{"tone": "friendly", "key_points": ["Berikan informasi lokasi dengan jelas dan akurat", "Jaga komunikasi tetap santai dan ramah", "Tanyakan kebutuhan spesifik customer secara langsung"], "avoid_topics": ["Pembicaraan pribadi yang tidak terkait penjualan", "Penggunaan bahasa kasar atau slang"]}	Customer menunjukkan ketertarikan ringan dengan pertanyaan lokasi dan beberapa percakapan santai tentang aktivitas bermain, namun tidak menunjukkan sinyal kuat untuk membeli atau negosiasi serius.	Follow up dengan memberikan informasi produk atau layanan yang relevan dan tanyakan kebutuhan spesifik customer untuk mengarahkan ke tahap berikutnya.	Percakapan lebih banyak berupa interaksi santai dan tanya lokasi, tanpa diskusi terkait produk, harga, atau penutupan transaksi.	Percakapan cenderung informal, perlu diingatkan sales untuk menjaga professionalism dan fokus pada informasi yang dibutuhkan customer.	0.8	2026-06-02 01:55:31.498296+00
24f93c8f-24af-44d8-895f-bb06460870c4	fe84cb9f-5247-4e0a-8921-8e51b911c774	gpt-4.1-mini	v1	cold	qualification	low	positive	low	[]	{"notes": "Tidak ada diskusi mengenai harga atau anggaran", "detected": false, "amount_text": null}	{"tone": "friendly", "key_points": ["Jaga interaksi tetap santai dan ramah", "Tawarkan informasi produk/game dengan penjelasan ringan", "Beri alternatif sesuai minat customer"], "avoid_topics": ["diskusi ilegal soal bajakan", "topik pribadi yang tidak relevan dengan penjualan"]}	Customer menunjukkan minat ringan pada jenis game survival dan cerita dengan durasi panjang serta bisa bermain bersama. Tidak ada sinyal kuat untuk pembelian produk resmi. Percakapan sebagian besar bersifat santai dan informal.	Berikan informasi lebih lanjut tentang produk resmi yang sesuai minat customer dan coba gali kebutuhan spesifik untuk meningkatkan minat beli.	Percakapan banyak berisi diskusi mengenai jenis game dan preferensi, ada pembahasan terkait game bajakan, yang harus dihindari dalam penjualan resmi.	Sales perlu mengarahkan diskusi ke produk resmi dan menghindari pembahasan tentang bajakan. Customer bersikap ramah dan santai, cocok pendekatan ringan.	0.85	2026-06-02 02:49:12.534278+00
e1352eee-fe8d-46ce-9865-119982a8ebe7	a1f51fee-463c-4356-b702-9f6555241c18	gpt-4.1-mini	v1	warm	qualification	medium	positive	low	[]	{"notes": "Tidak ada penyebutan nilai biaya atau anggaran spesifik selain angka 4450 dan 500 point yang konteksnya kurang jelas", "detected": false, "amount_text": null}	{"tone": "friendly", "key_points": ["Sambut antusias minat customer terhadap produk", "Konfirmasi kebutuhan detail dan manfaat", "Tawarkan informasi tambahan atau demo jika diperlukan"], "avoid_topics": ["Isu harga sensitif tanpa validasi", "Diskusi legalitas tanpa data jelas"]}	Customer menunjukkan ketertarikan dengan menyebut angka harga dan menyarankan pembelian sambil menggunakan istilah seperti 'insyaallah lancar berkah manfaat'. Ada interaksi santai antar kelompok pelanggan dengan sentimen positif dan penuh semangat.	Follow up dengan pertanyaan klarifikasi kebutuhan dan tawarkan informasi produk lebih lengkap untuk memperkuat keputusan pembelian.	Beberapa link TikTok dibagikan oleh customer, kemungkinan sebagai bukti sosial atau referensi produk.	Perlu klarifikasi konteks angka 4450 dan 500 point, juga konteks 'analisa spiritual' yang mungkin berkaitan dengan strategi pemasaran khusus atau konsep produk.	0.75	2026-06-02 05:21:41.174422+00
e10cd7b3-2451-4492-b382-d874b7248426	2a377930-58c3-473f-a9b6-dd56909f54d3	gpt-4.1-mini	v1	cold	unknown	low	neutral	low	[]	{"notes": "Tidak ada pembicaraan terkait budget atau pembelian.", "detected": false, "amount_text": null}	{"tone": "friendly", "key_points": ["Menjaga komunikasi santai dan ramah sesuai konteks obrolan.", "Tidak perlu mendorong transaksi atau penjualan saat ini."], "avoid_topics": ["Penawaran produk", "Harga", "Penutupan penjualan"]}	Percakapan didominasi oleh obrolan santai terkait rencana pertemuan/kondangan dan koordinasi waktu dan tempat. Tidak terdapat sinyal minat pembelian atau diskusi terkait produk/jasa.	Menunggu sinyal minat lebih jelas dari customer atau inisiatif customer untuk membahas produk/jasa.	Percakapan tidak mengandung konten bisnis atau penjualan, lebih ke obrolan personal dan koordinasi sosial.	Percakapan menunjukkan hubungan yang cukup santai antara sales dan customer. Tidak ada tanda-tanda urgency atau ketertarikan bisnis.	0.75	2026-06-02 06:35:22.133922+00
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.alembic_version (version_num) FROM stdin;
a2b3c4d5e6f7
fab2c3d4e5f6
\.


--
-- Data for Name: approval_logs; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.approval_logs (id, reply_suggestion_id, reviewer_name, action, before_text, after_text, reason, created_at) FROM stdin;
f9fdad53-1b59-4c42-b7f0-1b9ced9d4f70	73060462-9662-49a1-a01c-73dce532c0e4	Sales Dashboard	approved	Halo Kak,┬áprogram Solid Prime ini diawasi BAPPEBTI, jadi sudah resmi kok≡ƒÿè. Kalau mau, aku bisa kirim dokumen legalitasnya biar Kakak bisa lihat langsung, gimana?	Halo Kak,┬áprogram Solid Prime ini diawasi BAPPEBTI, jadi sudah resmi kok≡ƒÿè. Kalau mau, aku bisa kirim dokumen legalitasnya biar Kakak bisa lihat langsung, gimana?	\N	2026-05-26 09:37:46.637148+00
9f95d1b5-96f2-4cbd-a3e6-bd21e33ae99f	a4aac0a4-3471-455a-b984-df5e4fb684be	Sales Dashboard	approved	Terima kasih ya sudah perhatian. Kalau kamu mau, kita bisa ngobrol santai dulu soal trading, mulai dari yang kecil dan nyaman aja.	Terima kasih ya sudah perhatian. Kalau kamu mau, kita bisa ngobrol santai dulu soal trading, mulai dari yang kecil dan nyaman aja.	\N	2026-05-29 04:31:46.808655+00
c7e04065-1433-4071-a5dc-acd5d36f8ed1	7d4b8a5b-d59d-4db0-8e0a-bb4b5fff27dc	Sales Dashboard	approved	Sedih dan butuh waktu itu wajar banget, sayang. Jangan paksakan diri untuk cepat ceria, aku di sini kalau kamu butuh dengar atau pelan-pelan kalau mau tahu soal cara mulai yang benar nanti ya.	Sedih dan butuh waktu itu wajar banget, sayang. Jangan paksakan diri untuk cepat ceria, aku di sini kalau kamu butuh dengar atau pelan-pelan kalau mau tahu soal cara mulai yang benar nanti ya.	\N	2026-05-29 04:32:22.559442+00
33d53e48-4c5e-44ab-9bf6-16773d5ba2ec	5e8be481-3a05-4309-9e62-b968ce50bbf1	Sales Dashboard	approved	Aku ngerti kok, kadang bingung mau arah mana setelah situasi kayak gini. Tidak masalah kalau butuh waktu buat mikir dulu, yang penting mulai dari kecil dan pelan aja ya.	Aku ngerti kok, kadang bingung mau arah mana setelah situasi kayak gini. Tidak masalah kalau butuh waktu buat mikir dulu, yang penting mulai dari kecil dan pelan aja ya.	\N	2026-05-29 05:50:24.653606+00
17b9fb76-6e21-458b-9d23-44e0be3b904b	6f8a72b1-d79c-4503-b4f7-5b49bd51aafe	extension_user	approved_via_extension_send	Pagi sayang! Kalau kamu tertarik soal investasi atau trading yang terstruktur dan resmi, aku siap bantu jelasin. Jangan khawatir, kita jalankan dengan sistem yang jelas dan pengelolaan risiko yang matang ya.	Pagi sayang! Kalau kamu tertarik soal investasi atau trading yang terstruktur dan resmi, aku siap bantu jelasin. Jangan khawatir, kita jalankan dengan sistem yang jelas dan pengelolaan risiko yang matang ya.	\N	2026-06-02 02:49:50.324622+00
2d0dac14-18be-4a56-9453-59a8c6762335	12765cf7-e660-4cc5-a7f0-f9cfd412dead	Sales Dashboard	approved	Halo! Senang ngobrol santai bareng kamu. Kalau ada waktu dan kamu penasaran soal investasi yang lebih serius, saya siap jelasin kok. Santai aja ya, nggak perlu buru-buru.	Halo! Senang ngobrol santai bareng kamu. Kalau ada waktu dan kamu penasaran soal investasi yang lebih serius, saya siap jelasin kok. Santai aja ya, nggak perlu buru-buru.	\N	2026-06-02 06:55:28.983998+00
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.audit_logs (id, actor_user_id, actor_email, actor_role, action, resource_type, resource_id, ip_address, user_agent, metadata_json, created_at, organization_id) FROM stdin;
7e3f8ae7-845f-4f55-8bc5-c62a7559e7bf	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-05-26 02:04:28.773397+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ec38e7e4-ddc7-4dd0-85a4-2bdd5f17f8b6	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.user.create	user	4ecdbaf1-8c3a-4802-80ae-06e50067763f	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"role": "sales", "email": "user1@gmail.com", "organization_id": "6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd"}	2026-05-26 02:05:43.499389+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e4063c35-9ecc-40ee-bc1a-b47d6b501271	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	auth.login	user	4ecdbaf1-8c3a-4802-80ae-06e50067763f	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "user1@gmail.com"}	2026-05-26 02:05:59.397347+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b96108db-4c12-445c-a04e-c7cdc66a6d68	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-05-26 02:45:49.544437+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8dda7d8f-3176-442e-8c37-28cf8d459dcc	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-05-26 03:33:26.374275+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ee80fa11-ccce-4fb6-8e02-0f6f1d7cca25	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.user.create	user	3c94e3d2-fb01-470a-a45c-7b00be2d208e	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"role": "manager", "email": "arya.aa@gmail.com", "organization_id": "6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd"}	2026-05-26 07:54:50.233583+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6939e6b8-23f7-40c2-a355-9d6ccf850c45	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.user.create	user	c4fdae7a-d761-41ea-9016-f27c91c9d19b	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"role": "head", "email": "kresnonm@gmail.com", "organization_id": "6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd"}	2026-05-26 07:56:54.938469+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f97c608d-b8d1-4c58-be04-cdbc29eb3e24	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	conversation.upload_whatsapp_text	conversation	3db559c2-41f6-425c-ada3-e6564da25422	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"mode": "paste", "message_count": 2}	2026-05-26 08:08:24.310404+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
68b32a18-2945-4be3-95f6-98068a5e1e77	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	reply_suggestion.approve	reply_suggestion	73060462-9662-49a1-a01c-73dce532c0e4	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{}	2026-05-26 09:37:46.643983+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4a002ec9-67cc-4d51-a959-1f8b20edde26	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	reply_suggestion.mark_sent	reply_suggestion	73060462-9662-49a1-a01c-73dce532c0e4	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{}	2026-05-26 09:37:55.049408+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d899a9c6-02a0-4fdc-99b4-47da32ccedbf	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-05-29 01:07:51.909635+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
520bf782-4361-4738-a602-04fe5be4a056	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	auth.login	user	4ecdbaf1-8c3a-4802-80ae-06e50067763f	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "user1@gmail.com"}	2026-05-29 04:28:55.738462+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bbbd7fbd-8ca4-4ecb-b5a8-40f69106a03f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 12}	2026-05-29 04:30:48.542897+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c1912b05-488d-4c96-aee9-6f34ac4d89bd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:30:53.564148+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b5645784-8851-40fd-9431-69c43b188f45	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:30:56.070492+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fb678ecd-b5e2-4433-82b7-da887c1ab64f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:30:58.577736+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9d8029cd-9c83-46a4-9c95-2874a16eb91b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:01.068415+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9c30a7f6-4a5c-4013-bf9d-e37be9acb2be	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:03.570685+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b34616a8-0d31-4f52-89ea-867c76e8ee7e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:06.078738+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a5b1058e-2767-4fe1-8cf3-c7158e5ebc00	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:08.581663+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
99fad697-9ace-4531-b9f7-2180353856bf	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:11.063086+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bc347468-e11b-4a30-baa9-7f9951d72e0e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:28.566075+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
92f55e99-8695-447d-a72f-56299849a588	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:41.073813+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
893047ee-74b9-42d1-a495-f97082a0c250	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:51.072442+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
965f4fc0-8c30-4759-bb71-8ef5193d8cf4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:56.071879+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d18c3e6a-b125-4a03-a406-05104dcb9099	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:06.071277+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1ac31125-1cce-4361-84af-0e9d73993bce	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:18.571446+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
51d106a2-06ff-4f23-baf9-29ef36e5e2ae	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	reply_suggestion.approve	reply_suggestion	7d4b8a5b-d59d-4db0-8e0a-bb4b5fff27dc	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{}	2026-05-29 04:32:22.565237+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9d393e4c-d94e-4071-a396-5d795558bba9	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	7d4b8a5b-d59d-4db0-8e0a-bb4b5fff27dc	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": true, "status": "duplicate", "duplicate": true, "message_count": 12, "conversation_id": "d8dc1bef-c282-4bcd-9468-19b12d65bc90"}	2026-05-29 04:32:37.214093+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2f268a00-0738-4bb2-84c2-509808064483	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	93619231-dc0a-4756-9df3-2b824355d3f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 22}	2026-05-29 04:33:22.165562+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ef7ae612-c0ae-4a9c-9947-c2a389e09ee0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	93619231-dc0a-4756-9df3-2b824355d3f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 22}	2026-05-29 04:34:10.368044+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6452bfb1-f084-44ad-9960-949a0cc55696	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:13.582333+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
00be6aa0-14c0-43df-9488-4801e94e7467	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:36.063974+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6241ffd6-7f35-417c-8206-d48cf113792e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:08.577373+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c92912f4-51ce-47ec-8157-f215a1e55714	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:21.063768+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7e50ed0e-e2a5-4d1d-8f62-3089e487b6e0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:26.067912+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
62d8366c-6029-4bff-bf81-5590708d5f81	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:31.070334+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
47eac903-2f45-482b-9878-30f0aa7cda28	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	f0f609f4-9795-473b-8d86-8434e4ef0bd1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "updated", "duplicate": false, "message_count": 22, "conversation_id": "93619231-dc0a-4756-9df3-2b824355d3f1"}	2026-05-29 04:33:36.046529+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
57c2ee3c-191b-4477-89c2-6226cdb205d5	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:16.077256+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c58e5b2c-6508-4316-b12b-4c44bfee2e7d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:18.568052+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
23b928f7-aa80-44ef-b83b-6afba6740ac8	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:21.073024+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
dbd90f95-26fb-4df4-812d-855691c4c509	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:23.58905+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c93d30b7-fb17-4aa5-aa38-d3181cfb80f5	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:26.075535+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a022ec2e-25ec-40e7-82e2-2dcd64904a50	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:33.573414+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
83d5da95-63a1-493b-8c67-1a6ac8bc7784	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:38.577466+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
51414360-16a4-407f-8364-125959bc9913	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:46.073434+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
afe0ca3b-4f7b-4016-865d-5cefea42afe8	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:48.589378+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5a0d79fc-4e60-479e-b38c-dfbc82bb64b7	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:53.569204+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
924eb264-0aad-4841-8fc5-9228a3115724	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:58.581489+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f1f39d75-21b9-41ad-8506-af1122d40399	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:01.075132+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d88e6d79-45bb-4a91-a2df-c266032f1894	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:11.071211+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3b47ec44-4f79-45b8-9d16-bd663b1cb253	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:13.588165+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4430c36c-e446-4e4a-8bf4-a628f1ac4a12	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:23.570356+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
502a39b7-0429-439c-8e1b-166e4b7dfb2e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	reply_suggestion.mark_sent	reply_suggestion	7d4b8a5b-d59d-4db0-8e0a-bb4b5fff27dc	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{}	2026-05-29 04:32:27.704671+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
15d303c4-0b95-4d4d-a4df-a8955e236963	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 12}	2026-05-29 04:32:37.209891+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bef2a8f1-3ec1-4122-bcbc-26fe9c82812b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	93619231-dc0a-4756-9df3-2b824355d3f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 22}	2026-05-29 04:33:19.760254+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
df73afab-6e1a-4452-a2d5-a64ceb3f9802	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	93619231-dc0a-4756-9df3-2b824355d3f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 22}	2026-05-29 04:34:09.154999+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d5469c9b-34d7-48d4-b98a-ec024683f12f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:32.355227+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fc133718-1e55-4480-9123-338d6b3564d7	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:31.07537+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cc051a2c-2262-42ca-a418-832ca46666bb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:31:43.566402+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
171a951c-f2ea-4bb7-ae62-550e438c1df4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	reply_suggestion.approve	reply_suggestion	a4aac0a4-3471-455a-b984-df5e4fb684be	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{}	2026-05-29 04:31:46.818107+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
54b94837-a81a-4cdf-9f17-ea35309288e2	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:03.578285+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
94d2408e-aa24-4def-b245-4d31f806d04e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:16.070194+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
959dd88d-81df-4386-b2f9-6cd42c0035fa	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:32:28.576102+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fdc92514-21d7-42bf-947c-e479d84f468f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 12}	2026-05-29 04:32:33.588423+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fe8d70f4-6f28-4647-a021-9d6de4b6aee5	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	f0f609f4-9795-473b-8d86-8434e4ef0bd1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": true, "status": "duplicate", "duplicate": true, "message_count": 22, "conversation_id": "93619231-dc0a-4756-9df3-2b824355d3f1"}	2026-05-29 04:34:09.158144+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0adc3521-bf4b-49db-b1c3-7e1da428233a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	f0f609f4-9795-473b-8d86-8434e4ef0bd1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": true, "status": "duplicate", "duplicate": true, "message_count": 22, "conversation_id": "93619231-dc0a-4756-9df3-2b824355d3f1"}	2026-05-29 04:34:10.370777+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c21ce73a-937d-4d76-a706-4be2ada29deb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 41}	2026-05-29 04:34:35.443044+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3a12bb35-34fe-49ac-8bdc-71117b94184f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 41}	2026-05-29 04:34:38.218337+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f6fc887c-94e0-429d-bb59-e7395927e75f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	00762691-36cb-46d1-8e48-466c4a3187be	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "updated", "duplicate": false, "message_count": 41, "conversation_id": "a3b451c1-a339-4cb5-bfe2-b02fee6568ec"}	2026-05-29 04:34:49.6788+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
03ba4ccc-1a41-4400-92b4-4c6e503b3f2f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 9}	2026-05-29 04:34:52.288428+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f8c16b42-83dc-4c6a-bd4a-8a796eeffc3c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 10}	2026-05-29 04:34:57.230897+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e53541c8-3bcd-48ee-b6c6-b9696315567c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:34:59.719942+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
56f35d38-ff9b-403c-a53b-70794a5fbf45	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:02.224753+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c0b1bb9d-eb64-4704-be7e-5d6604a7335b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:04.719639+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
65a49a25-74ec-4245-b1aa-da0e843a6514	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:07.21914+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6189c3b4-b1b3-4e82-998d-48fa63eba964	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:09.726927+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d8a7378b-aa20-4f88-960f-91c5fb5ee33a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:12.366034+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b4678a24-7267-40d5-a27a-d0a0509f63ad	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:15.351131+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e5bcba1f-854a-4618-8bf8-c5635d821d7c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:17.356169+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9a07338d-4971-4c05-979d-f2cdef28963e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:20.355463+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
13074ea2-c2b6-40b4-a24b-cf07759709bb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:22.361745+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e4fa8627-9ec3-45cc-b296-85716bf59120	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:25.354813+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c6dd749a-4f66-4450-a3f7-0099fef4851b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:27.354927+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a60eb488-2bc5-4aaa-ab2e-2859c0d978ca	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:30.364927+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7f06205e-5c27-40dc-83a1-e80189e1b0b3	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:35.35078+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bec03aa0-0295-46ad-a4d1-115d4dc94eaf	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:47.352899+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ce3ed150-0461-4a98-b6f2-194b815f1ae3	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:36:00.361196+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
138b3b31-1bda-46ba-a5f3-0449b1b16775	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:37.353256+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c089b04c-1de2-4fc1-a1a8-30e9d80b1817	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:50.346742+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b6026dc0-8e50-4f02-84d7-2f10a051b7ef	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:36:02.352882+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4c55087d-bbe7-4c39-b0a5-2c6ac26abde3	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:40:21.363998+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4716a8a0-0d64-402d-8d08-8d8651fddfa6	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:43:34.350992+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d1ee835a-29dd-49db-985c-abc584f3b2af	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:20.35329+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3e5b2509-84bd-436c-9bdb-f618349a4dd2	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:40.348312+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d64c00c5-84e3-4421-ab18-f18957904c48	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:40.345954+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c88738fb-bd75-4b80-b7af-abed3cbe5a1d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:52.355763+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0b98051c-0d75-46a1-90ef-eac51a232c36	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:36:05.360303+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5a850ec1-1c43-41d7-a6f5-f3edf5dee075	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:39:21.354044+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
20f5ff90-ca81-458f-9699-c1157c56188e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:43:31.34558+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d0ca91e8-16fa-4ff5-8c3c-a36971127df2	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:18.344822+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
40d7dd1c-3ed9-4dd2-935c-6b082823fc37	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:38.352315+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b9892909-4cba-409e-ba32-fa212aa97787	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:50.37502+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
aba3070b-01b6-4f22-a48c-cfa15c52e706	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:42.350363+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8a9aae8f-3336-45d3-8eff-741055347095	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:55.352987+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5320e800-9e1f-43e2-ad8f-250eb3b88d7d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:36:07.349595+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e5a2ae56-2994-44cc-83c5-24ebc8762818	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:38:21.359986+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a1d13d4b-549b-421f-94fc-a14394f5ca2f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:43:21.35364+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7392ff62-9cad-4033-ae48-36af814a8408	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:43:29.362536+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a54f977b-dcee-4ebe-8013-d45dc48e9f1b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:15.356741+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6fe75f8b-cdac-42e8-9919-8fb3325d2e97	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:48.364821+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
988dfb73-5bd4-4d7a-89b2-23c2eb0b1640	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:45.345645+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2565b2f1-692a-4a5b-8b1f-51d6e5b9c708	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:35:57.354295+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ca40abf5-b4ce-4c9b-b03a-b209c82333a3	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:36:21.358547+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bf0bf6b1-5691-4856-8189-49efc12d8b05	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:37:21.351962+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
41076e7f-d22e-4cd4-aaca-d0c7d2d680a0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:41:21.378272+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2ad73b2a-ba31-4a6a-83ab-7969e0b902c9	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:42:21.35873+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6fbec953-25ff-4604-918c-bcf858828db5	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:43:26.344685+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9dfc96db-968c-4f8e-9e5d-3868e0b80815	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:43:36.352866+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
86ae8550-f679-444e-b9a4-e23ffc5c1bcb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:43:39.34613+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b2dcc4b5-0a99-46fd-a67b-bb907064549d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:10.360533+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c87983eb-add3-40f7-98d2-2175e433b1b4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:13.360237+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0e068784-1379-4f69-893b-c0fda23217f1	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:23.345387+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c43e4b5f-0ff6-4646-9f8c-f92b63322d48	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:25.351944+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cd590837-ae1f-4736-aa6f-0682060a889e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:43.345145+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
da31281f-3a2a-46a0-b1f4-770343fb2bc1	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:44:45.351223+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0e977773-3e8b-4a1e-bdbe-88a2ba519067	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:45:21.361774+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
849b2518-56dd-49f2-9ddb-0c3d9aceec9c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:46:21.360752+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
072a4bad-9a48-49d1-bde5-093734afd680	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:46:39.360126+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
23a27c53-4e09-476a-b4e0-5b71f965c810	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:46:41.356106+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
de6e387c-1267-4c46-9ee3-19534a91b8ea	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:46:44.34893+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
978c8944-da20-4817-a8ec-2e213dd68939	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:46:46.349081+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6f19522f-b3a2-4ddf-91fa-c3e295d1371b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:46:49.356427+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7064f1c7-6bd9-4e14-a3f1-0384579b6cfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:47:58.702211+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5e676714-0168-4b90-be0f-4aacbae132cd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:48:01.202784+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9d35250c-fa62-4ef6-a760-6ea09308b2cb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 10}	2026-05-29 04:48:06.220498+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2e592925-980c-4461-a5ce-8ff342ec2a5d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:00.406014+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
48ec6d12-afc1-4303-b7e1-8dfdf51ef215	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:02.913594+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ee33b379-186a-4277-8a96-62220daf93b8	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:12.918726+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6529d32e-b16f-4402-9492-4c009ee5c96a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:16.359294+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fa35a9d4-ed1b-4b16-b49c-0eca541d117c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:23.352231+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bde3a359-467a-46f1-a5be-7be7f69d611c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:28.347633+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a905649a-5a51-4b4f-9b27-2715c8ec334b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:36.351778+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0cfc8c5e-c61e-4e4b-9297-e4f2488efd7d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:41.347624+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a95f07c5-4f0c-4834-a400-0a2e0d3b0ba4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:48.35595+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
56fe25b2-b24b-4340-921d-57d1ddbb7fbe	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:53.348886+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8d08b7eb-46ee-4845-96a9-76789f9cc575	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:05.41003+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
df2d508f-69a5-4cfb-8c8d-d97a086a738f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:10.408442+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2aa07b3b-d6cb-4c29-bec0-755aafc8df13	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:17.91534+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
730cf720-fb5e-42e9-b488-9c324d7f326b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:25.418142+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
14b0d9cb-7811-4ad7-a8f5-edd7700d87ce	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:30.430474+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
87be2f31-aa77-49db-ba98-a5b924686d0f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:46:51.359957+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0450096b-f432-4dfe-a92f-604d0c5085bb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:47:51.897617+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e52e4307-550c-4375-b180-7da847adf999	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:48:03.706567+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a9950e92-f240-444d-a25d-3aef7f2977ec	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:05.412946+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
df8189f2-53c0-4f8b-a277-012b962c90ab	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:21.353085+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3a1239fe-4ca2-46de-95a7-b978f25492cb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:33.34728+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e01d0cf5-54c3-45c9-9ca1-319e5142d311	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:46.351315+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e68dcf14-4e8b-499a-9204-f8be5e6449d1	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:58.358461+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2bc979d1-d87e-46db-87a2-39e2963413e8	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:02.915406+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0d1e71eb-0849-4b96-93dc-aaa6e2e44f2e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:20.41399+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
366156f8-9aab-4ec0-a016-76a3831d40aa	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:32.907066+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
04b3ead2-80b4-4fe2-98e1-9dd31f9a112b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:45.418701+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
41f6bbbb-7054-4888-9f70-8f75b781013f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:57.920207+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1d13f0bf-f579-43ea-a3d2-43934148c6d2	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:10.409079+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d97c3a29-5aa6-4e6e-bb77-ced190d87395	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:47:21.369735+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
72643704-8a69-43cc-9ec6-cac5b575cf05	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:47:53.707022+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bd66cc1f-31a2-45df-b36f-cf468c101360	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:07.907999+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cf1bf5c6-dc75-48c5-b124-5a609977f205	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:26.35353+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
570a3dd9-be7c-410a-ac17-7754bf18527e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:38.35483+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
97825f68-1a1f-4389-aee0-1d6261bb562b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:51.362657+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3a7524c3-56ad-4849-9e31-174f37cc463a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:07.905591+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
24a6ad94-f1c4-49f0-83ff-b4cbc7b9c676	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:15.406637+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8c6ab799-6502-4574-927b-071d1471ea11	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:27.911383+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9df63eba-9187-4759-9de8-d87e52ce7faa	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:40.417102+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cffd14a4-9670-49ce-bb03-e695fb20fae3	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:52.929302+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a0e430e5-ca7a-4216-813b-c38738244f1e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:05.408102+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a61c90dc-2b57-4ae6-9d0e-079b4fd8ec50	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:47:56.210287+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
20abe84e-08cf-4917-8992-c696f06afd0e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:10.40453+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
852f33df-0496-49d3-9e11-9374ef36cee4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:18.354381+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e927a254-1e50-49bf-a14e-50b981dd6fb6	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:31.356737+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
098e7eac-af46-4b09-85aa-1780e4eff74d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:43.375181+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
496b6b76-1bee-41e9-9bb0-2760fb47d45f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:50:56.35618+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
00224e98-4f71-46ca-9af1-93193f4d219b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:00.5715+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ed5d6ab5-d64e-4f76-8c50-ca8b0ab3eef6	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:12.91213+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f298ac20-6b9d-4c70-9bea-8df75f95c87a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:22.918215+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a9cf7025-f759-420b-95f2-c2dd23624ca2	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:35.406556+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0ee263ab-6ef7-41e4-b47e-142e98a4c0b8	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:47.912067+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b6019be7-ae99-49fc-acd6-22e23d5c5cf3	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:00.40871+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e38bcdfa-39cb-40eb-814a-d3350b82772d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:12.909058+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e8e3e796-24fe-4805-9e7f-efc27b89a976	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:37.922102+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1a2fa90f-e2ba-41a6-9a95-2930ce13e944	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:50.417385+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
82ffcd88-d995-4bda-9ad9-2702807b9f9b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:02.905317+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
54093aa7-bf1e-4d73-b5ac-728136ade582	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:15.406064+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d76d74d1-dc15-43a6-a3f8-925fa57b3351	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:42.924252+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2cb414ac-da9a-40a7-b54f-89e5ab0db223	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:51:55.417154+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f15faf73-2790-48d0-bba1-571aca18608d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:07.910067+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
168bd851-11b8-4e5d-8ed0-f08e0baf854f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:17.919084+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7dbd9b12-fac2-4eeb-8a89-fa59a55f0fe2	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:20.414132+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9ff9a8f2-e9b3-4395-953e-3900e5c756c4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:22.905+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
308e936e-e38c-4b64-801a-54f09ff1b659	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:25.427036+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
828217d2-e69c-4633-8057-fa6993190fef	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:27.910383+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4980b012-2914-4ef4-ad76-d8dc038434bd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:30.42311+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0aa471ac-e865-49b6-8ed0-8c197b44f917	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:32.909525+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a83c676d-cf43-4693-bcce-e3e675601bdf	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:35.414409+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
40ceaaed-257a-4906-ab89-a81621be98a0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:37.914888+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0bcabe92-77c0-45ec-9217-e792243de327	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:40.408817+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f6e7187a-3605-4c90-9124-cd08ab73a16a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:42.921327+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4632aed2-afa6-4c1e-b35c-83be0a1a0184	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:45.409198+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
74caf4fd-33c2-4c79-98f4-ea9bcd3d8253	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:47.921141+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d17c9671-3f3e-4464-98de-9e77fa3fe832	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:50.414413+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
480966b3-1949-4442-af8f-fee3fe38114a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:52.90517+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d2f0201c-d5c4-4694-9d80-fb1ba1c807ce	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:55.413438+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
dfe69c6f-2b3b-413a-9cff-03e7e1ac3871	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:52:57.906875+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f771718b-866c-4a16-8308-17a855f177ed	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:00.41213+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cb70c5fa-34d8-4372-9726-e6757738cedc	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:12.910092+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
65a7cab5-98c9-4ff9-b1dd-22da2a5a6b5c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:25.411616+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e324a102-4cf9-440d-9af0-0a395c6f3e66	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:37.909512+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8ac0ac56-5684-42f6-a69e-4109c02d4036	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:50.408725+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6a93a517-fdca-43c3-a93b-8b568bd597fe	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 10}	2026-05-29 04:54:12.934271+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
23d006af-aa83-4886-bb8b-07386cbc69be	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:32.955127+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
575c06a6-30c1-44ed-96ac-054858319acf	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:45.450391+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2e8afbe6-5ba4-46eb-887a-7023954ce5fc	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:57.974137+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
54109733-a3ca-45f9-bf06-eba63c63cb3e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:10.448845+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
943057bc-6f52-4385-83bd-f101ebef93cd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:22.965461+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6062ba84-cba5-4afd-9b2c-51f8a5fe73e7	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:35.448215+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1c390d1a-c601-4384-b015-f6116b3b942b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:47.960683+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b82f8aa0-a4a8-4028-9d0b-be92ec93b436	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:00.447278+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1893c3ae-df92-4c24-a531-5375afe3493d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:12.958486+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e62cb414-db6f-43e9-8270-3b6678f5cad5	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:02.920443+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bf34e45c-1c0e-43b1-bc9f-36a3ec931ac0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:15.421353+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b5825f46-b43f-4149-ba23-241ade179f96	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:27.920351+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
62451897-8d45-467e-9a18-9c451e80c809	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:40.419325+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
015d5611-0dce-4561-ad19-6b38ce9c3cfb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:52.908947+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
519a74e3-de4b-4a32-b020-719f4b4b2238	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:22.949251+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3ffb4c06-d537-43c0-9afd-4501e9f24506	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:35.468011+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7d464a97-60d4-4a61-ad82-17995e2c6730	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:47.975098+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
11117a1f-dde3-45ae-9702-28a881541517	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:00.460086+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a6a61fea-9d93-4c7d-9728-4ea90a213919	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:12.952241+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4e5742e3-1dcd-4063-b6b8-261e30d88ebd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:25.447987+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
722c61a6-7b64-43d4-a613-0207f4463865	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:32.962987+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b99715fb-c815-4a6a-be32-9c38e1664dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:45.46621+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ef617768-861f-426d-a63a-30d0d14134c0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:57.966363+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d0cfdf75-cad2-44ff-a588-56c9f69195b7	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:10.464428+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
85e63b8d-58c5-4ad1-b898-55b6636f813f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:05.41658+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f1d053a7-756d-4bcb-82d8-7c5bb1f1e853	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:17.913598+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c7b9abfb-eed2-4002-88f0-d88956788273	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:30.411139+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
44f15a65-e5c9-40a8-948f-76fb07f1b828	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:42.93522+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4d61a029-fbe5-4658-aadc-b1b3390d6af4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:55.419799+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5e00aece-704a-461c-8c35-6f9dd4d0c5a0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:25.448313+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8870f843-1903-4e59-9740-ef34e8ae9223	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:37.948928+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f01f6011-600a-49e2-9897-9ccb57a86132	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:50.448978+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d3eadaa8-0677-4a7a-869d-875248dc6b77	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:02.948026+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
579e32b9-1237-47ce-a410-5954c6ba1030	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:15.45629+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
50532c7b-9d48-474f-97e5-baf06550f94a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:27.949891+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ff104503-e221-4730-b772-c45f0b56d909	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:42.948844+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
80d11a29-5de5-4dea-85ac-b76b22ce5d01	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:55.459784+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2a2587f8-8b90-4ea0-a63a-f94cf32877a8	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:07.953032+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4f945026-c350-4634-ac88-c0a1ba9bc844	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:07.923044+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f9639842-1d8a-43c0-b0d0-e66c6af04f9b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:20.421031+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
83290dc1-6cb0-4591-80ef-1da7cb2e20d5	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:32.91678+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
28007399-dc25-4463-9194-ce62d3a1c060	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:45.409321+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b531258d-906f-4f41-9333-4893b0458ad3	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:57.906422+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
95c5dd5d-290f-45a9-b6ea-e26485422220	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 10}	2026-05-29 04:54:02.932218+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
19fad62f-6f3d-4134-bf49-e0ebe1c2c6f7	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:27.959191+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4c9946bc-c710-4b96-9a22-05b22190b842	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:40.472769+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b5994f23-dd37-440c-857b-2f865dc96d4c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:52.973414+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5d19ad4d-5a79-4ffa-bce6-9f9a87184138	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:05.467515+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4147cc89-ff55-4bf6-8e38-1d14b411200d	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:17.94884+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6e15d46f-e070-4043-8c07-595bed51022a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:40.459625+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b951b7cc-a2c3-466a-a045-6a58812ba19b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:52.953162+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f8549081-c452-4057-8399-a9c638579bb5	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:05.468598+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
199d010f-e343-4d91-ab63-ee9328f1d911	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:10.416249+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f78a6c4f-2029-450f-9351-88fc982f42f1	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:22.931287+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0837f9fc-dda4-4245-9623-2de6120ad6b1	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:35.409154+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c0b16ae7-4ec4-4a36-a266-5b27274009ac	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:53:47.903978+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e384e4ec-a25b-4a5a-abd3-73bc147b0462	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:00.406807+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b7af4171-6d55-4e9b-9a6f-0c5120c16412	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:10.430406+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0ae668c5-9314-474c-a41a-1ddc81a5f14b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:30.462915+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
df3181da-e10e-4483-b12d-541cf363a346	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:42.953624+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0e74ef11-1fc4-48c9-b75a-f7a1934bdb42	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:54:55.448347+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2485c761-07d7-4c20-8db0-66a2bdda82bf	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:07.948918+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7940c383-8258-490f-a4f8-6afac39cb5e3	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:20.447407+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6e9c511b-98dd-4ec9-893a-f589c61e0174	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:30.471542+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c3811ea4-e838-49bb-942a-89ab82ba1657	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:37.953899+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
322c1c15-d8d6-4211-9af7-21da9cb60eed	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:55:50.475927+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4f609056-9819-4f59-937d-7bbae34f9151	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:02.971589+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ec2aba8a-f1fe-43b1-be1d-ff9f8fb85a9e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:15.448561+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
64f55823-0f5d-453b-a0d7-bf2e54b9256a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:17.947838+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b4c2803e-9292-48c4-924d-c2315ad5b05a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:20.451086+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
dbcd8133-c380-4b75-b582-08c86f61d874	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:22.960549+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9c6037f7-3d11-4cae-8515-475fdc256da4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:25.448957+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8067e2a5-727d-4cfb-82b8-3dee87f2e721	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:27.958784+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b8b4fe36-1d53-48ed-9e7d-585712b187ec	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:40.458249+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
69e730a6-b629-4528-be14-8e5fb9b7e9fe	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:52.947181+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
39f1d5b1-8d39-4e47-b551-8fd3e0cd04c4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:05.45275+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c335bc67-31e4-4bac-bed0-87fed15862f1	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:17.969441+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
60c27da2-c863-4994-aec9-f0569e1beb7a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:30.469224+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b1c26a76-6515-4691-a4bb-fb8a171aaabe	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:42.955887+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
60257fab-65e0-420b-a294-07c2e472094a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:55.448377+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
456bbe12-a042-45eb-a1e7-370e7ffe79d1	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:07.980878+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d4642078-9db3-4d70-8ea9-7e12ac4c7fa0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:20.454908+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5edb2ba3-8d3c-4dd9-a96e-8ed8bc39dc85	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:32.958783+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
eb621c77-68c9-4768-a8b7-56dc13d8302b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:45.459873+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4a5a0355-fef2-45bd-8ed9-a5600d11d515	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:57.946467+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6895ef49-ecd4-4be9-b560-f3ae7063154f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:10.448134+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8c5c6387-a929-4bbf-9554-5853f93315d6	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:22.956982+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
478bfa03-ee4e-4a79-9cca-ba44a6dab219	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:35.462597+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
dc61b834-2f3f-4d9f-9d20-f0831667d67c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:47.951913+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
911ed644-a934-4000-b7d2-e8998507ec4c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:00.447164+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f51ce94c-d4f6-4f38-83dc-afc7aedba0e8	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:12.955469+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d2018b4e-9051-4895-b73e-f6a90910f3d0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:25.457295+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e6f87e11-cca3-46c9-b8f3-b601c477fc9b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:37.955218+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
264d55ea-7269-42ab-a9b1-55b0b9e23b42	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:56:50.452389+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f925c4f8-642b-443f-8f67-f0c79299fb5a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:02.958269+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
233eb105-373b-4fb8-ae4d-3124af9b8226	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:15.447885+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e9006b7c-941c-4c2d-9552-f4ada5d390c3	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 04:57:27.958026+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e40afe4b-00e9-42d0-aafc-bc16ff01983a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	reply_suggestion.approve	reply_suggestion	5e8be481-3a05-4309-9e62-b968ce50bbf1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{}	2026-05-29 05:50:24.658742+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
20756935-0377-4105-a84b-68bf130385ba	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	reply_suggestion.mark_sent	reply_suggestion	5e8be481-3a05-4309-9e62-b968ce50bbf1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{}	2026-05-29 05:50:26.331229+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
65e987dd-2a31-46b7-9b60-0928edcfee7a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 05:50:45.168694+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9685a58c-eec6-48fa-adb7-1ccd4fe35f21	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 05:50:47.669856+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
db0dec4d-49e4-402e-9d79-d4ad001a8530	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 05:50:50.168662+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cda9e864-08a1-46c7-9c68-5df181119ac8	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 05:50:52.671695+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5990dac9-6399-404f-9db5-80b94f317ea4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 19}	2026-05-29 05:50:55.302771+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1cbeb8e7-58bd-42c5-a06b-53820c3145cf	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 19}	2026-05-29 05:51:03.977499+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5c3fd9d6-6331-438f-ad53-8cb04ece77e6	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	bf801e3e-988a-494c-bb59-ea20f9671c00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "updated", "duplicate": false, "message_count": 19, "conversation_id": "d8dc1bef-c282-4bcd-9468-19b12d65bc90"}	2026-05-29 05:51:29.544444+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8ff9a202-3b66-49f0-8f5a-259fda365156	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 05:51:32.072118+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4db104e5-3ce0-4578-a18e-a62d74e0d05b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 17}	2026-05-29 05:51:34.665851+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c630eb96-64a5-4496-9fd8-85d8e9fad89b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 27}	2026-05-29 05:51:39.681312+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
89a519e2-1b04-495c-9f64-c2e3bc2268ae	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 5}	2026-05-29 05:51:52.129297+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6057278f-6274-4f86-916e-a4d91eeabcbd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 5}	2026-05-29 05:51:54.137134+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ce96b74b-4925-4199-b379-a28bc0f8601a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	447c6eee-9c8c-40c1-ba5a-caeb4e3f6a43	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "updated", "duplicate": false, "message_count": 5, "conversation_id": "f9dfb897-7af0-4890-b51d-d3e4735f4ea4"}	2026-05-29 05:52:02.616431+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ac029dfb-77c6-4c2b-8390-1101ddbb2aa5	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	59f1578d-d6a6-47a6-9950-541c2659e2f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 24}	2026-05-29 05:53:00.221777+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9c25a634-e988-47cf-b4f5-e152ef6ea735	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	e69f587a-cb60-4fdb-acc2-cb62bbbb8873	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": true, "status": "duplicate", "duplicate": true, "message_count": 24, "conversation_id": "59f1578d-d6a6-47a6-9950-541c2659e2f1"}	2026-05-29 05:53:36.899659+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0fc24d22-ab6e-4767-892e-3d89dc2857ea	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:31:57.736609+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
de7f8ff7-5b38-4cf8-86c3-f053aeec7dcb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:32:10.234947+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6e14d9b3-4a8f-403d-afb4-c8bfcbaafba6	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 17}	2026-05-29 05:52:20.204394+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b8501792-6f7a-411a-af3f-a1eafcac983b	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	d4b97c2d-2cd0-4239-8c31-44f7feaa2d93	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "duplicate", "duplicate": true, "message_count": 7, "conversation_id": "67343055-cd9f-4943-abcd-0016838210cd"}	2026-05-29 05:54:27.514991+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
04789a73-fc15-46aa-b15b-4e780a4431ae	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:31:52.73916+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fc1484bc-9351-42fd-b1fb-cf8a3003b378	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:32:05.243682+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
83902b69-7c4e-4a99-8aba-830b3dfdffcc	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	00b27ccd-7a35-4f49-a42b-cabce1a618d6	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 5}	2026-05-29 05:52:25.163893+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0d7cabf0-d976-4f27-b844-4989561ba1d4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	59f1578d-d6a6-47a6-9950-541c2659e2f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 24}	2026-05-29 05:53:05.161502+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a4eb9b42-ca77-45c8-afe0-50cf1a233d1e	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 17}	2026-05-29 06:31:37.697461+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d4fb76fb-98bf-4baa-b63f-16ac01fdd379	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:31:55.24123+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
28938047-3237-48ca-97db-ff71f08aa9a0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:32:07.735025+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6d6bb22f-eaab-46b7-afe1-f9ff591551f0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	93619231-dc0a-4756-9df3-2b824355d3f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 20}	2026-05-29 06:32:17.827031+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b3924384-a64e-4bb1-8689-acbfa932ec58	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 22}	2026-05-29 06:32:57.465272+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a153c4e2-10b1-408c-ac81-51afc924fb86	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	f1c6e74f-b2ad-46d4-997a-404fbd1a7abf	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "updated", "duplicate": false, "message_count": 5, "conversation_id": "f9dfb897-7af0-4890-b51d-d3e4735f4ea4"}	2026-05-29 06:33:25.182038+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
38457c7d-f99f-4ea2-956d-96d9be6822a7	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	00b27ccd-7a35-4f49-a42b-cabce1a618d6	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 6}	2026-05-29 05:52:27.662165+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d328b85a-c882-49cb-86c4-6ad3ea9a5c61	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	e69f587a-cb60-4fdb-acc2-cb62bbbb8873	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "updated", "duplicate": false, "message_count": 24, "conversation_id": "59f1578d-d6a6-47a6-9950-541c2659e2f1"}	2026-05-29 05:53:19.921022+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9e8c2fef-900a-40c7-bf0b-ec989f11e05a	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	67343055-cd9f-4943-abcd-0016838210cd	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 7}	2026-05-29 05:54:15.93476+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d3fe4833-c9a6-4db2-b151-454cd2049039	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:31:50.23025+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1a91c6c8-e4a8-4256-b515-bdc2e7629bdf	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:32:02.780461+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3e9db119-9c20-4a39-b655-074a4a3d9228	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:32:15.236313+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
227c8491-5fdb-4c6f-a996-09c007311a3c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	93619231-dc0a-4756-9df3-2b824355d3f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 20}	2026-05-29 06:32:24.908757+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cbef84c5-421f-4aaf-868c-66419dd64e7f	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	67343055-cd9f-4943-abcd-0016838210cd	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 1}	2026-05-29 05:52:57.69194+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e5b88958-b212-46f9-b482-305c8621b117	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	59f1578d-d6a6-47a6-9950-541c2659e2f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 24}	2026-05-29 05:53:36.895407+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
95a0218d-2ec7-4987-8915-b3982cd75508	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	67343055-cd9f-4943-abcd-0016838210cd	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 7}	2026-05-29 05:54:14.436867+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
51d9aa18-e748-4438-962c-0dec7656a0a5	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 17}	2026-05-29 05:54:50.050008+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
353fc6f5-2dfe-4777-afa8-baead3a7e3d9	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	5f9fe310-bc8d-4609-bb07-e4a0190e8650	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "updated", "duplicate": false, "message_count": 17, "conversation_id": "d8dc1bef-c282-4bcd-9468-19b12d65bc90"}	2026-05-29 06:31:47.711561+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c9358991-02ea-490e-b583-1ebeaad4a716	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:32:00.23278+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3a580fdc-5339-4b0d-84ac-a99ee07be6fb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-05-29 06:32:12.745785+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
41713443-965b-4785-aed5-c6550c61021c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	f43c0e8e-8b5c-46bc-abaa-c664e27cb56e	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "updated", "duplicate": false, "message_count": 20, "conversation_id": "93619231-dc0a-4756-9df3-2b824355d3f1"}	2026-05-29 06:32:34.792108+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2ba776a1-d0b0-453b-9582-f4658c6e0f55	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 5}	2026-05-29 06:33:15.656733+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d8eee020-34b3-4ad3-86b0-ed4727126f7c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 5}	2026-05-29 06:33:17.344842+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1b6a1157-98e1-41c3-b1da-eb3c8442b44c	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	b7191080-f685-4c04-b8a5-e7a48caeb188	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 35}	2026-05-29 06:35:01.328219+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6a09073b-7fc1-4e79-ac30-29e9129a3dfc	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	59f1578d-d6a6-47a6-9950-541c2659e2f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 24}	2026-05-29 06:35:06.295039+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4f5e08de-76ec-4d62-a9d4-c4477b401c15	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	59f1578d-d6a6-47a6-9950-541c2659e2f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 24}	2026-05-29 06:35:08.074885+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
700d66ee-18e7-4019-a344-f115e2e930cb	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	eeea76e3-82e2-4f60-bd42-c113a261e100	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "updated", "duplicate": false, "message_count": 24, "conversation_id": "59f1578d-d6a6-47a6-9950-541c2659e2f1"}	2026-05-29 06:35:24.152086+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
abd569df-2e8e-4ec3-b19c-0f7588c431f4	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	59f1578d-d6a6-47a6-9950-541c2659e2f1	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 50}	2026-05-29 06:35:46.765899+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
379d60ed-bd62-47c1-812d-b7c6c95f4fe0	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	d8dc1bef-c282-4bcd-9468-19b12d65bc90	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 17}	2026-05-29 06:35:51.798354+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
72f8ccd8-ec58-4a8d-bf53-0974fd5a8f8e	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	ops_notification.resolve	ops_notification	6f709c7a-c229-49e8-b8af-192e6adf544f	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "resolved", "escalation_level": "none"}	2026-05-29 06:46:31.985343+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d3694fd1-89ff-416b-890b-cfc347147ba3	4ecdbaf1-8c3a-4802-80ae-06e50067763f	user1@gmail.com	sales	auth.login	user	4ecdbaf1-8c3a-4802-80ae-06e50067763f	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "user1@gmail.com"}	2026-05-29 07:12:39.126175+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4ea819fa-a243-4381-a710-16e39145171d	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-02 01:18:27.207438+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1670f94d-52c8-4809-ac4c-97f14d5660d1	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-02 01:32:26.239767+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b035801b-1cb9-4168-aa57-d02c69e3ee7e	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.user.create	user	2dfcc01b-ffc0-4da3-a152-db877f6895ab	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"role": "sales", "email": "salessgb@gmail.com", "organization_id": "6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd"}	2026-06-02 01:56:52.663487+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2d49e091-cd21-477f-9ad3-76dcf836f1de	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	sales_structure.team.create	sales_team	9fe8c342-ac88-4919-a22e-c48a733cffea	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"code": "sgb-mini", "organization_id": "6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd"}	2026-06-02 01:57:23.945743+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1d896165-5552-4f27-b64d-d0d46157052f	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.user.update	user	3c94e3d2-fb01-470a-a45c-7b00be2d208e	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"role": "manager", "email": "arya.aa@gmail.com", "organization_id": "6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd"}	2026-06-02 01:57:33.459676+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5d89c4a0-9164-4fa6-9851-941c1d7b0eae	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-02 02:21:33.843668+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a9b85766-8b04-49fa-8145-c0fbc1d0d613	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	auth.login	user	3c94e3d2-fb01-470a-a45c-7b00be2d208e	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "arya.aa@gmail.com"}	2026-06-02 02:43:55.069762+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b5311eb7-620f-47d1-a25c-0ffbba3eb1db	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:46:59.020448+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
25a3254a-c577-4914-9c0c-8c3d03a53cff	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:48:33.199896+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8922ae6d-831b-4eda-8050-961f5b40a74e	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	fe84cb9f-5247-4e0a-8921-8e51b911c774	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 15}	2026-06-02 02:48:40.917286+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
be73b92d-e12f-49b3-9e68-b292c9ad8e12	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	fe84cb9f-5247-4e0a-8921-8e51b911c774	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 15}	2026-06-02 02:49:04.986245+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8297254d-e81c-4ce2-b613-0ed0d212421f	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.reply_suggestions_generate	reply_suggestion	6f8a72b1-d79c-4503-b4f7-5b49bd51aafe	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "updated", "duplicate": false, "message_count": 15, "conversation_id": "fe84cb9f-5247-4e0a-8921-8e51b911c774"}	2026-06-02 02:49:18.904161+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
89650804-0271-4dc9-8628-bbf160422d26	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.reply_suggestion_send	reply_suggestion	6f8a72b1-d79c-4503-b4f7-5b49bd51aafe	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "sent", "already_sent": false, "auto_approved": true, "conversation_id": "fe84cb9f-5247-4e0a-8921-8e51b911c774", "sent_message_id": "ea096ce4-50f7-48d9-8c5d-4943941ecd69"}	2026-06-02 02:49:50.343778+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0a0872c3-aed6-4158-984d-50431721875e	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	a1f51fee-463c-4356-b702-9f6555241c18	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 7}	2026-06-02 02:50:05.396629+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c9f9a811-0b7b-441a-89d0-b0f241c6d687	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	a1f51fee-463c-4356-b702-9f6555241c18	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 15}	2026-06-02 02:50:07.959836+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
633241d2-2834-4569-a70c-febc6fdf34c8	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:50:47.903461+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7c0b14ec-e379-4791-ab10-f09b9d8b3af7	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:50:50.403367+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3c5d0b16-fe74-4d0d-a74c-edfedb720136	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:50:52.903572+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
89c8a555-a33d-4e6a-a69c-8d646c29aee1	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:50:55.40922+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
995e5ac8-84d9-43f7-acc1-2aeda4146d05	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:50:58.349964+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f99bfb8e-d84d-4626-9a68-0f2884309404	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:03.350969+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a99db285-d953-4e87-b5a1-bcbb6ef8530f	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:22.936913+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e774bce0-fada-4ca0-ad8c-22c8972b9ef6	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:33.428321+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
83d90526-9f2a-40b4-b8ed-00e069157540	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:46.358147+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0a0a1bd6-4569-4cb4-8559-9062bb359727	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:58.350953+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8e5b511d-43c5-498b-a08b-f617e76bf311	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-02 02:55:28.845151+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9de8d27f-d713-43c1-bed4-fd904c36dfc3	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:01.348069+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cd3bcaaf-f0ae-4c62-8d82-9cbc35a78f52	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:08.358009+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f5480385-d16d-43c0-8895-972dadbfc0c4	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:13.363135+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
68048408-814e-439d-a457-b00a9ec7f521	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:26.34769+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9cb4b02f-b18c-4e0b-a8da-591067e82ec4	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:38.353869+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
55a8697a-aec6-4dea-a4bc-c9460db26147	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:51.349029+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5a0aafa7-f4ec-4f4d-8ef9-e1cf812c1c20	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:53:17.357143+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
72365925-4fcb-47c1-bc39-035e73de9178	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:54:55.615922+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
08fb2459-134f-43f2-88af-797ca99132fd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:55:30.413699+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f2835073-7cce-48ea-b0f9-19c387c45503	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:56:42.899517+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0c4bd263-3318-42d9-98ca-11be184ebece	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:56:47.908872+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a1882890-f065-43b6-ad15-fb5a716449c0	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:08.357598+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
42278aa8-1a8f-46d9-b69d-f5cc54a7105b	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:19.900448+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c7d2b323-d72f-4930-8743-fddc6cf48aa8	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:31.346567+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c03c41f1-dc09-4d3a-a279-fbc95d9c5a58	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:43.354495+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
57bb52bb-37e4-4c93-a8f4-060c064e7d9c	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:56.347675+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e4a6b7c8-65a0-4658-83a7-046dbbff9bb7	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:55:00.414253+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3224b7cd-a4c5-4583-b604-aa2d600f0b4d	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:55:32.912115+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
efb9f37a-5659-4540-afc2-1d29748065bb	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:56:27.906394+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4b6aaebb-8294-4dcc-9e68-b45def7a4aa6	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:56:50.419155+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ffefebfd-3ebe-492e-8f6e-52228ff82e0a	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:11.35025+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fea005cd-a50b-4fdc-84b5-7b6178b70b4b	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:23.350045+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
801683e1-ff01-4577-8662-5dc26f27b729	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:36.348104+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
33480034-b073-4a66-88a4-e11e95938195	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:48.347376+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
99796f16-cdc8-4896-b849-3019d0cc3e0a	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:52:17.353242+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a0eaabdb-0778-42d9-8e1f-8eb56ca33574	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	auth.login	user	3c94e3d2-fb01-470a-a45c-7b00be2d208e	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "arya.aa@gmail.com"}	2026-06-02 02:56:26.116981+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a65d9f97-a387-45df-a5a5-cc8303bf4a28	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:56:32.908881+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1c33f4a9-85ef-4334-910c-c10ab7f8d997	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:16.754719+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bc3a1ee9-9ee1-4433-bb99-2e9b216684d8	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:28.34779+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ab2fa1a0-2def-4665-bd2b-7f797528a989	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:41.352516+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
748b6f05-a1e6-4859-a854-1ef7898b2131	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:51:53.352969+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2995289f-2fd2-4b9e-9f4c-d4182add0ebd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:54:17.354764+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e6c19415-1502-4b45-9064-69d812cbb709	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:54:57.910516+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
eed5239b-8440-4000-b51c-a1043314adaa	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:55:35.402333+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9e381119-431b-4ec0-8833-416ab759e995	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:56:30.420867+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
92f1c4c0-531f-4d9c-a174-fb4174a356fc	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-02 02:56:41.39412+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f935b7fe-a777-4fee-a20f-50f4b6aaa18c	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:56:45.418085+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ed67910f-6be8-405a-b666-d4f8623d8e4f	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:56:52.905195+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
48d6225e-1558-412c-bbf5-2965a662257b	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:56:55.40644+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
269736b8-dca2-4719-b02c-93f26c60e0db	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:56:57.900213+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8683da98-407f-4bea-b12a-126060985e2a	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:57:00.415046+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4048f000-2e76-40e8-b0df-429b45e70b43	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:57:02.975167+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9dbe3654-9ca8-47b1-a62b-579f368a2951	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:57:05.39931+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9be41138-cf5e-48d3-a260-0bd6de97fe9c	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:57:07.909204+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
dd57d551-96cf-4dc2-abea-c8a3e6d72357	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:57:10.430493+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5e9a9268-afcd-42ac-88ec-0ac27df9c4fb	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:57:12.910204+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bca0c054-2054-47a9-9690-0b5896723150	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:57:15.407778+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c0ab6572-88ff-4483-be86-c04c89799be4	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:57:17.915568+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
54c50e47-c4c4-4dca-96b3-4736f7d70adb	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 02:57:20.439833+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2d0126d0-f0d5-4c22-bd89-1730e25a51bc	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-02 03:20:07.473371+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
479463c4-b7da-46dc-b1a1-512008ed75cc	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	auth.login	user	3c94e3d2-fb01-470a-a45c-7b00be2d208e	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "arya.aa@gmail.com"}	2026-06-02 03:21:04.313463+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
128f5f91-97d0-41ef-a44f-0efab7093062	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	ops_notification.acknowledge	ops_notification	aff7288f-63a5-42c5-9497-985ef9603f73	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "acknowledged", "source_type": "sales_worklist"}	2026-06-02 03:53:44.686298+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
205d361b-78c6-427e-a052-1bcdba1682ea	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	auth.login	user	2dfcc01b-ffc0-4da3-a152-db877f6895ab	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "salessgb@gmail.com"}	2026-06-02 03:57:53.339846+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a8ef9f35-fce6-4847-b1e2-a520fb69c592	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-02 03:58:25.814462+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
86fab85c-419a-4f3a-9e76-f8c7ded118e2	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.user.update	user	2dfcc01b-ffc0-4da3-a152-db877f6895ab	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"role": "sales", "email": "salessgb@gmail.com", "organization_id": "6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd"}	2026-06-02 03:58:36.261162+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
34ad524c-a1e8-43f2-b985-90db8aeb29a7	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.user.create	user	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"role": "head", "email": "headsgb@gmail.com", "organization_id": "6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd"}	2026-06-02 03:59:19.021377+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
23f6b08a-130b-4c05-b784-d05a8077b7bb	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	auth.login	user	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "headsgb@gmail.com"}	2026-06-02 03:59:31.479673+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c20e2390-697f-48d5-83e7-d21be1a83ba9	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	auth.login	user	2dfcc01b-ffc0-4da3-a152-db877f6895ab	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "salessgb@gmail.com"}	2026-06-02 04:11:31.442259+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
283e052b-e938-4962-8cd0-c83f13290035	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	auth.login	user	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "headsgb@gmail.com"}	2026-06-02 04:11:44.38308+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
19421376-bf0f-4eec-9120-a876dffe6066	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	auth.login	user	3c94e3d2-fb01-470a-a45c-7b00be2d208e	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "arya.aa@gmail.com"}	2026-06-02 04:29:33.848647+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0c9bd901-51f5-4ba9-9a5e-189369d371ef	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	auth.login	user	3c94e3d2-fb01-470a-a45c-7b00be2d208e	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "arya.aa@gmail.com"}	2026-06-02 05:21:29.600525+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0db80c5e-42d8-4ee7-bac5-d1c7d929d8db	3c94e3d2-fb01-470a-a45c-7b00be2d208e	arya.aa@gmail.com	manager	chat_review_case.upsert	chat_review_case	4fcdb143-ce30-48b7-89ac-739c995d47f7	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "in_review", "review_label": "unik", "conversation_id": "a1f51fee-463c-4356-b702-9f6555241c18", "reviewer_user_id": "3c94e3d2-fb01-470a-a45c-7b00be2d208e"}	2026-06-02 05:22:41.575441+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f7e4bbf1-1d50-418c-b1b0-57c2cd43dc04	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-02 06:27:51.23158+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5df303da-58eb-4b12-8754-18d706a096d9	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	auth.login	user	2dfcc01b-ffc0-4da3-a152-db877f6895ab	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "salessgb@gmail.com"}	2026-06-02 06:33:59.20267+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4eef151a-729e-4a75-aaac-0def8409aca1	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	auth.login	user	2dfcc01b-ffc0-4da3-a152-db877f6895ab	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "salessgb@gmail.com"}	2026-06-02 06:34:39.681069+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
215d692d-4de2-4cd0-ae76-d26fba3b5569	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:34:40.268382+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
24516bf6-0141-48de-92d0-7f533520562c	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:34:42.766842+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
27fe515f-3676-470c-ab2c-ab9befe11bdc	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:34:45.261872+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0465ba9d-740c-4638-bd3b-4fa98db7d054	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:34:47.774812+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
851101fd-5020-4e45-b578-eaf3817131b0	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:34:50.259582+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c1209c5e-21bc-4a54-8f66-80fbcfa70ee8	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	2a377930-58c3-473f-a9b6-dd56909f54d3	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 37}	2026-06-02 06:34:52.82324+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
69ecff3a-a00a-4e83-ac41-3921ded005d0	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:35:53.583573+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
87adf7c8-2041-42ff-b5b8-40e45287f6ef	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:35:58.603958+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7f5e997e-652c-4840-acac-7408398cc38a	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	2a377930-58c3-473f-a9b6-dd56909f54d3	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 37}	2026-06-02 06:35:07.663541+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5f936c9e-6d65-4a15-8627-8429eb99517e	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:35:51.097685+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6db70289-d9d0-4700-ba7a-aba4dfbca035	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:01.118808+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
05568b89-44d3-412b-bf8a-79db7cc61599	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:16.087855+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
054204a8-758b-4d35-9407-0402c3df92b9	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:29.352429+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a80908a4-c196-43ac-93cb-ac68a1c43b09	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:41.359954+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8cde28cc-ee69-4fe4-a4e6-45a93c3db209	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:54.361389+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
822eab3a-6e6d-4309-a087-8faf01a8e46c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:06.354699+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4cc5ec9d-484a-4f17-a756-c1508bd34bf5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:19.392271+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
115fb304-d28a-45ce-a0d3-9bbad583aace	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:31.355994+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c7f95c66-73ab-4266-9aca-0c425704029b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:44.350771+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bf3ef2b9-9b80-46c2-a630-6c0ef546a669	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	extension.whatsapp.snapshot_sync	conversation	2a377930-58c3-473f-a9b6-dd56909f54d3	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 37}	2026-06-02 06:35:09.36035+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ca1a84b9-d8a2-4342-9aaf-171bd925e238	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	extension.whatsapp.reply_suggestions_generate	reply_suggestion	12765cf7-e660-4cc5-a7f0-f9cfd412dead	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"cached": false, "status": "duplicate", "duplicate": true, "message_count": 37, "conversation_id": "2a377930-58c3-473f-a9b6-dd56909f54d3"}	2026-06-02 06:35:28.555859+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b25d610b-874d-4470-8623-76de568e1d46	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	auth.login	user	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "headsgb@gmail.com"}	2026-06-02 06:35:41.834272+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
14388c95-252b-4eed-9841-6b73cfda24ac	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:35:43.581334+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4d52ed03-7a4e-41b0-8e85-148e9f12b87b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:35:46.084457+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f34e3ffb-97fc-4bc7-8cd6-f4ccee60e383	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:35:48.584817+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
146eada1-1d38-4ae1-bfb6-50721912f34b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:35:56.094671+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bea8bfe9-c4cb-48b2-a726-d24f52931097	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:03.586729+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b5c6fb38-3245-4524-af00-6f4beb11c61f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:06.099278+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9aa38a8e-6dc4-4bc4-be54-a6861c04afc8	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:08.593821+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
852b6ec1-5f90-4451-ae3c-3a4537bda03c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:11.083237+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b8066b6a-7bd1-45cd-8372-6404f45c6bde	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:13.584369+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fe14f986-8f3e-456e-9f2a-8c299042b7d8	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:18.598115+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
36ef60a7-83e8-4b2c-8b2f-35f5bb3a9b80	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:21.084745+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
492edd89-87b1-483e-a611-678732c48749	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:23.587385+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
98b4f6cc-b95a-4d65-9e6f-8877f7273584	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:26.101259+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9ef8d4af-2542-4b85-b4c3-1161fcd8be73	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:31.376602+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1f58c658-f42d-49a4-9369-f6d5220ac3bb	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:34.358411+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1258eb7e-6b60-4647-830b-16b4d0ba86c9	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:36.349465+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
88e901f8-43a4-4298-96aa-c74e8271aef4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:39.350141+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d40aabbd-e9ba-4bbc-a6e5-5c5ccd3319c6	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:51.360477+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bd97c425-f104-4e4a-84df-cf83c02a7cb4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:04.356246+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8bae0195-da1c-4769-b4ed-699de32ff4ce	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:16.357149+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ffc12a79-66cb-48b1-8345-3c7ffbbf7324	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:29.344192+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
718732e1-82a7-4a54-83c9-49f2adad2ebe	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:41.372259+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
24b40479-0375-46a9-b2b9-779644a88bb4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:54.353997+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f3a4cf65-d9d0-4223-9c5c-16035209c03d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:44.351992+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0359b438-8031-49eb-a445-3fb3c72a62ad	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:56.35929+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9189c2bc-9839-4edb-9852-83ba6c882bd3	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:09.358705+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
df336d13-5922-4362-8adc-5eabdd049248	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:21.358205+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f9015d84-f60c-4ee6-a995-75b6a2fb73d3	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:34.355296+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4f534098-6fae-427d-9186-6c99d7d31826	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:46.3562+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8acff944-c774-4b34-a13c-888916bc677b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:56.35016+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4bf8e563-793c-4da9-a140-b67794b7921c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:46.350746+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d0d99882-6d9c-4e46-a05c-96477792d319	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:59.357281+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f8f8bc9c-c6de-4163-8adb-93e47308342b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:11.360812+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ec734709-f9f2-407b-86ed-b22099fe2e1c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:24.357889+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2d9b1749-3080-41cd-9523-c6a5da6a1ba3	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:36.357598+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1a11d35b-9480-4c22-bc51-deadb861bc40	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:49.352965+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
405ffc5a-ef74-436c-bf71-537ba80787a6	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:36:49.359265+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
213c93d0-2556-4e43-a225-48beaed606cb	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:01.35216+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e8fdc148-c1e7-4a8d-b9f7-c02eb07b1be2	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:14.355901+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
21b5aa64-5c00-4b12-98c0-08468d45d076	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:26.348642+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
85e088a8-8e9b-40ec-9b43-d64a6433c666	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:39.361064+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9beacc15-bb43-4407-b2f4-2195639ed004	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:37:51.352255+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6342309a-95f7-48fd-b4fc-9a1f7303e702	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:00.576068+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3194c062-00a0-4aa1-bf2d-67abd5f68292	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:01.354986+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bcfac76f-a533-4eb0-a39f-22fca8dee3e6	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:04.35576+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
661b35d9-6704-4095-85d5-e52d6e6fe3f9	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:06.358302+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
916e6326-b871-4e8b-9c7a-4e8d415ab82c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:09.357024+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
57e771a0-d74d-4e3e-a102-489475a8738a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:11.355524+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1a4b9b87-4af5-4969-b652-0c37190fc9b0	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:14.357699+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cda77fd5-03f2-461b-9712-dd6172c914c1	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:16.353672+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
232e3c5d-0430-4efe-a619-22e77eba4308	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:19.34826+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5db6de3f-bd84-469c-998f-ba8a00fec4c0	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:21.35572+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fd20195e-9488-4eb4-98bd-0c74ddd98ccb	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:24.352827+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2ed5318b-94dd-4fa9-b127-2ca6d9249891	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:26.359286+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8107c6cc-a1dc-4e56-86e8-d4541e3982a9	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:29.36999+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
69f29f82-6a59-474a-837a-0a569c0c160d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:31.352991+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1f6f2c24-412f-49b5-8b53-2a3f88d06a44	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:34.353718+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d97f7755-0ef3-432b-9801-9d15595da4be	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:36.361043+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
65e05af9-85e3-4921-8306-f36f3287533a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:39.350345+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ee1ab617-45dc-460d-8902-61d7eda6fc1c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:41.348111+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1d7b5e2a-5d75-45be-a4ba-eab9eb894040	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:44.352932+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7f922f1d-0c2c-4e84-a406-4cd8f7d5fd9b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:46.355192+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d16b99c5-6e29-4cdd-8521-c20b1ecf0c04	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:49.353184+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ee932ff9-9a29-4cdf-9781-d753e082a8ce	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:51.353442+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1123425e-2a79-4daf-bde7-8aeb6f3f953b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:54.356643+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4c8768d0-4f44-4532-8772-f7aa381b4e97	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:56.358928+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cd51eb49-f765-494a-854a-af29fd0cda6d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:38:59.348813+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
abc2b2c7-9e97-41ec-a5f8-dd9744126e13	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:01.384811+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9265b148-290c-4213-9cc3-2874e40174a6	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:04.356294+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
18fbd972-11a7-436d-94ac-9bca2f4c4ca1	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:06.37249+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
08236f4a-e49a-40c8-8882-22d4e04057a4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:09.382348+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ccc5ea89-8871-4465-be48-c89fbd080956	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:11.356459+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a6b62255-0b7f-4d33-b2fb-0aa7035aa6ad	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:14.364675+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a697a928-3fea-403a-9c7c-ab4de3361b13	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:16.359941+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
67135639-328e-446b-a53e-617ba4498382	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:19.350303+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a3461653-3827-47e6-96d8-1b2c6aface72	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:21.365808+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
866cc555-aefe-40d1-ba3a-8714bd1206b5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:24.358979+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cdfa2a63-e3eb-4e1e-8117-cf1c770cb709	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:26.349013+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3caa8c01-b3cb-4906-b3da-80496db4d4f9	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:29.353083+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3d73823a-c7f6-49bf-8451-e2b5cfb816cf	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:31.349315+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c5798dcc-05a2-455a-9e8f-bf1a629f369f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:34.353856+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
70af0a0f-0a3d-46b1-bdcf-f8fe378e8fbd	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	auth.login	user	2dfcc01b-ffc0-4da3-a152-db877f6895ab	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "salessgb@gmail.com"}	2026-06-02 06:39:36.026589+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a8f6be2d-aab7-43f7-8e40-fbcda94bdc6b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:36.363112+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
870ab057-694b-4078-862f-4d6ad8c40d7d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:39.353731+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b6d1e244-c33d-44c3-b674-532718402ee4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:41.354076+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
02083ca4-637b-4396-ad41-f6fe23a054f6	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:44.3587+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6ba3a5dc-ac40-4ec3-a053-3a6a0fab006e	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:46.35626+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ffc3e27c-e693-4275-85d4-fac343bbc8b2	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	auth.login	user	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "headsgb@gmail.com"}	2026-06-02 06:39:48.148335+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3bc3b570-8066-45b9-a732-62ed57a9e692	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:49.35743+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a05e621a-dae8-456e-ace1-8106c266c6a3	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:51.346844+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
dfc1aef3-6a82-479c-adc2-cea19384350b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:54.353593+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d8e29324-8784-4470-a818-5026c55cc509	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:56.347573+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6128efc3-255b-472a-b639-388db5fc5440	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:39:59.357504+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
53cb5bdf-ced6-40ef-86d4-be1764f5fb30	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:01.352373+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a5aac718-3274-4fdb-b18a-8a0b945855c7	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:04.35365+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
402dbfaf-0781-4065-8278-aa5616ad0205	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:06.349663+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c0964f95-0a92-4cac-b5af-6259cdeac826	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:09.348655+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
065b98d5-0580-49b4-9901-35b602892547	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:11.382872+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
48218c37-650e-4fe9-9e30-e483471bddbc	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:14.360795+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
03e8737c-9458-490a-bf78-a87aa6d48d58	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:16.353015+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2ede38af-8427-4ca3-be7d-c1f29ef12e9d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:21.358769+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
64bc902d-acd9-451e-94c4-929b18c764b0	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:24.34916+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f3a8ac0f-adeb-405d-9b44-d62e05dcb808	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:29.345197+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
976efea5-60bf-479b-b974-bfcaa8717617	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:36.350979+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0636c761-cc07-4703-874e-04aaaab42992	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:39.349068+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cedadf66-ef29-4a10-b8e6-cbabf270cc5c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:41.350978+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e4a30bfd-76b4-46b6-bd3f-9a9ac6d5ff52	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:46.35972+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
69d4ee22-8128-4255-b9b3-f2e992be352c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:51.362272+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
58e46278-64ed-423b-ab09-38d74d168154	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:54.350159+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4c4f51cf-8a46-4b05-bf25-a0dc9c84d3e7	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:01.353583+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bfdc07cc-1372-4232-baa4-1b20df25259b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:04.349148+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c1a4f9eb-fef6-485b-a074-72fbafd1a781	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:11.355975+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cc65c6a0-e15b-4273-9ca2-5000c23296a1	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:14.357456+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
943740ad-af84-43b4-a1b4-db781f503a78	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:16.3639+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
74620964-93a2-46e5-a3dd-51bc48280092	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:24.362446+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
08c6c860-7bd3-40d1-b6c6-0ab55b0e4373	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:26.354498+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
72b91318-5bd8-4005-834a-5955a477d99d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:19.359279+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
67aaab68-c587-4dd0-9084-0652dfe3ae8a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:26.34995+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4ac95256-bb4a-4fed-af5a-8769bad2fa11	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:31.345699+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c0c1be80-8eee-458e-8ed8-a777ec99a1a5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:34.346907+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
085616e1-c754-4934-94b0-605b46fde4cc	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:44.355329+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c36155ff-43f7-4e9e-b76a-ae53d8087422	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:49.360263+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
367f02bb-30bc-484b-9ff3-b14c657a40dd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:56.36313+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3df5ac79-491d-4ba2-aac7-75d9f804e1d0	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:40:59.369754+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
13b8ba99-3e96-461b-b97f-089e5bdceb97	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:06.357491+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
23bfd45e-a2a6-42d3-bd5a-f0bfd1b53322	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:09.359321+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d4b0bc9a-8667-44bd-991c-d8b1cbcb275f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:19.357422+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b9f91aa9-0f10-4c3d-ba66-32aafc5a6b56	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:41:21.347055+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ff53c817-c215-45bf-a7ac-a992bafeb3ae	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:43:17.370203+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
eca71285-754e-49d7-be95-4518d3030b2e	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:44:17.365663+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9f8b6b5d-91a1-467c-9739-cd3066afe357	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:48:17.394707+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0e6f7969-79a7-4d24-963d-f4fa0948b097	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:49:17.392445+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8e12a3bc-0823-4b57-90b8-bedf74237466	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:53:17.354847+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
732e4e56-5eff-4215-a561-e9421c72aa34	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:42:17.368343+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
08575e7f-656a-4ac9-8fee-45310a57f21f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:47:17.38287+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2dc70e2d-e715-4e4a-862b-544170982349	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:52:17.37304+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7d4747bd-76a2-498c-8fbd-b851747ba82a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:45:17.363164+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b2bd8a01-01ef-49e0-9f47-d075507911bf	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:50:17.371416+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5492f8a3-7ff6-4b3e-9c24-c664615653d6	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:46:17.364874+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
80908724-3d20-4987-812d-4c01ef68d2a2	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:51:17.363045+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6f1e2e5c-3344-4f38-9048-b49085d7536d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:54:17.363346+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
dfabb191-7978-4df2-b521-f15a36da340a	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	auth.login	user	2dfcc01b-ffc0-4da3-a152-db877f6895ab	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "salessgb@gmail.com"}	2026-06-02 06:55:14.403615+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a7129137-d146-4018-b299-881b24f334cf	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:55:17.37093+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3ec03aad-a4a1-4cd2-a742-27f7d9e9f2c2	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	reply_suggestion.approve	reply_suggestion	12765cf7-e660-4cc5-a7f0-f9cfd412dead	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{}	2026-06-02 06:55:28.993395+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c21ebb53-0907-488f-8d10-bc5e775235a1	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	reply_suggestion.mark_sent	reply_suggestion	12765cf7-e660-4cc5-a7f0-f9cfd412dead	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{}	2026-06-02 06:55:35.275102+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
88104a12-3232-4d33-a31a-7f0589ffaf9e	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:55:41.928327+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
33499e92-9e15-47c8-bca4-e142d7a9c6ee	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	edac28ad-d5ca-48a8-be7f-f36d30985d7f	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 37}	2026-06-02 06:55:43.646519+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
df53f846-840f-4140-918e-e019dd098fb2	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 20}	2026-06-02 06:55:48.639149+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2242b06c-ad21-4176-a453-f6533446c290	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 20}	2026-06-02 06:55:53.732442+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
dc70c6ca-9c03-429b-a5bf-ba82a859eefe	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 22}	2026-06-02 06:55:58.7478+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ec7d05fd-5c80-4dea-927e-8afb5f51bf0f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 23}	2026-06-02 06:56:01.178752+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bc5ea6d4-adc2-4a7d-ae18-0dd59108fad7	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 24}	2026-06-02 06:56:26.394062+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d653c5f0-3b3c-4c3e-b75c-71c5fccbdaf5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:28.869748+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
34dc0702-9ff3-4013-9716-ad07dfa01f70	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:32.346726+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
35617ead-fe9f-43c9-bf58-b484c725e7d5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:34.347658+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3d672d67-eb30-4a8b-a9ac-404815206b2b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:37.361563+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c4b59557-00c3-4fdc-8262-f594385971f7	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:39.352058+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
99d447db-1ddd-469c-b1d8-5d4a2f3fffa5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:42.354973+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3a6665f3-8b5e-4a28-ba28-ee729126b4fd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:44.347785+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
effe63e6-0250-4658-a716-e887fe3e2063	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:07.352731+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
10a27230-23aa-4cb6-ae97-8915c6c184d8	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:19.351225+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4857f492-9928-4606-acc8-d7fa8fdb88c4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:32.346612+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
952a23c0-d6a8-408c-94a2-d76f4ff56477	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 18}	2026-06-02 06:57:41.458541+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7d04f020-2a26-410b-bc95-6136cdc4e18b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:53.907161+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c84d648f-7e46-493f-b496-5a5ca088c5ab	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 17}	2026-06-02 06:58:02.675379+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
60acc280-d3c4-43c9-ba19-af0f33ecdcee	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:35.354948+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
10c528ba-392a-4a4c-b1e8-44cbd59bba36	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:40.206179+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cfb3015e-6d27-4159-a4fc-67e3f52c1d76	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:47.34872+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8b47b3b3-4323-4886-846c-a472a2425900	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:51.377256+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b40a0acc-757a-46af-8962-ba36ac43b506	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:09.35375+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2e73606b-dfc8-4ee0-ada9-3e2b3001da79	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:22.351181+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b3b62982-a78f-4b58-9c34-0f59a39a1972	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:34.359558+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5ee3c146-1d90-4b89-acd4-a371cd2be26c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:38.892236+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4da76138-cc1e-429c-b7ef-80ec9b4d799a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:56.414708+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8a7e6d44-0799-4940-b6de-c7cd0a8471cb	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 17}	2026-06-02 06:58:01.519278+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
41221988-cc13-4668-9279-ed888f71bcce	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:07.703914+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f3bd8cff-e034-4ead-9f1f-12a1674e93e2	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:20.203838+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
79bd7ccc-fe36-49e2-af6d-41ae65095570	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:27.718551+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
31fe8d96-584b-4c0e-be30-a86ffca3262a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:32.706368+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5764ab0b-bbe4-4820-bd97-f9d7f72785bf	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:49.361255+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6f5114e1-8936-4fde-9f0c-551cb27b219b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:54.366721+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8af6eedf-a0ab-4ad3-a33e-e452fee30214	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:58.878817+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8032eefc-657f-4dab-a329-9c59b1bc2761	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:12.347518+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
298e0341-5c20-4754-9f30-fd704d4348f8	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:24.347011+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e0a2056e-5ec2-40d7-bf32-5989002a0ced	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:37.346642+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
635dc97a-5787-48cc-8c76-a0e73fdf8406	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:58.906823+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2d3a14eb-dca5-4a4a-847c-5a24e68c372b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:10.2198+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d2b794a4-6069-4ba1-9247-40b7b70daa1f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 19}	2026-06-02 06:59:00.367483+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c39e3921-53e7-4bb9-8967-ab83af7cd35e	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:56:57.352316+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
96f3eb93-ac4a-40e4-a9ee-5a10912a3f57	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:02.355464+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cd626e30-61b4-4cde-a67c-975673227e2c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:14.355557+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0dcca1ab-3af6-450d-a795-1df5e687b283	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:27.349297+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
83062de6-c42f-4d60-b975-e6575394a1b4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:12.705472+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9191cb67-a2e0-47e0-9748-b390ac2c64ba	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:17.712383+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
386a25b8-de90-40d2-b248-197afb991a14	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:22.714727+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1b0e2614-537a-4e3e-b55f-117abdb74238	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:38.353694+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3b189887-277c-4068-a3a4-4c9b85faf515	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:42.853347+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
26d90645-86b4-41f9-b073-1c544274449d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:04.361382+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fe7b25fe-9443-4bbf-a0f1-4d11d4be8ead	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:17.372846+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b3b87a53-20d4-4285-8e2c-ba577933c67a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:57:29.356704+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5f471da2-1bd0-4d53-915a-4e17c837a8e8	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 18}	2026-06-02 06:57:49.044375+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cf80718f-a92b-4d52-bfb2-746d0537f1d3	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:15.20813+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1d1268a1-7366-41a3-983a-58ea9a3892d9	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:25.217975+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
600e3857-1392-4477-9119-e416e7dc22d0	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:58:30.206284+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fd201f3b-7476-460d-9491-846440e3bae3	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 19}	2026-06-02 06:58:45.241665+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
537c224a-bfd8-45da-8582-14974bc34b94	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 20}	2026-06-02 06:59:07.73202+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
39f699c6-dc41-4217-abe7-2578de97e62d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:59:22.727821+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4fb67c33-e652-4cb5-9726-2f5789e2070b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:59:25.22903+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1051e920-3a14-4799-a4b6-629f5a54218e	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:59:27.724632+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3fb8d406-b677-4b65-b7d5-c955ef64dbae	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:59:30.244322+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
55355e7a-b314-46aa-ad36-cf200b95d1b5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:59:32.725533+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0c1fe1ad-a826-45c4-92cc-f6ca7c7f0a5b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:59:35.23706+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0635a7b5-5ff7-4d7a-aec0-94bb9901c96a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:59:37.740318+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cf0241ec-d29e-4833-8cac-8ec31715614a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 06:59:40.237657+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8e21e07e-b142-4bf7-bf1f-71c9949127c4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 23}	2026-06-02 06:59:42.895985+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d9dcdd2e-71f2-4119-a2b3-f26c9a62e94b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 23}	2026-06-02 06:59:50.41342+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e1894111-86ad-43ff-98b7-7d800c158e02	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 23}	2026-06-02 07:00:07.931436+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
395f8967-394e-4849-99b3-23f9b8aa99f3	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:00:40.34698+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fdd96a3a-b914-4cee-84ca-91420d1cc90a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:00:53.350018+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0236f7bb-120a-4920-a294-d29968bdf41a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:01:05.349449+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4af3e23b-cae0-48bb-b94e-9113755367b4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 20}	2026-06-02 07:01:22.898864+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a1ba08d5-d9b4-40db-a8da-ffe9978b2f1f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 26}	2026-06-02 07:02:34.377494+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
537f56b5-413f-4d46-a37e-7f9716f6cc2a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 30}	2026-06-02 07:03:49.732917+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
beac3ef3-3691-47ac-af46-f2e9c03f1aa8	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:04:45.347435+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
868e7a4d-0805-410f-9815-2ceaf150adae	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:04:57.350376+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9dc63b4b-70e8-4f99-9ffe-9245d4003ec2	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 27}	2026-06-02 07:05:06.934547+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
383605ed-4c5e-4d50-825a-70c0accb4cd2	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:24.453173+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
804109ec-ba8b-4190-9e28-a8175b903bd0	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:36.956897+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b5d1bc95-51a6-4955-85aa-7df6959c6eb4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:50.350959+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
efe7472d-7f6c-4c5f-b62a-3e5545e65127	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:11.962535+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
25e6ec45-452b-412b-af44-1907dade1a7c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:17.362412+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a21923fc-d3ec-4d3c-893a-359ab05affe6	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:30.353213+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2ac4fc33-cedc-4c56-8356-e8e8b61cfb9f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 15}	2026-06-02 07:07:14.523771+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3f5ee180-ea08-45d5-8697-5294ca20502f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:07:42.099531+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c2644fd8-e94b-439f-8f61-3f58338449ad	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:07:54.617655+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c4eb03a9-300b-4dd7-b338-f80c05900f8d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 27}	2026-06-02 07:00:25.353124+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
eb84ad75-c480-47e7-9196-3263e18d4f58	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:00:50.35298+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8c2409aa-7298-4efc-be7a-0d796d7c13dd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:01:03.348011+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
92e98c88-9d49-4192-8735-8a2b60441b78	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:01:07.850815+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ba73b404-6173-484c-be4d-2db45f49e4ec	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 22}	2026-06-02 07:01:28.096578+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
51871c32-da98-484a-93e7-d65213acb159	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 29}	2026-06-02 07:03:54.618294+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
76cc3c60-db5e-4a86-9342-220d3c84e9dd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:04:41.933039+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7626c5b1-0509-4830-a66d-2c9edef9b9d7	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:04:55.349729+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b4e45872-8ed5-487c-aa7f-c5e32d5b5da1	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:21.94352+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7452add7-c8b9-493d-b1be-652e0b5bc66c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:34.445316+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
af9f28ad-9763-4cb3-b05b-46d487368e73	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:47.370558+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3066300a-8b5f-47c2-b1f3-d774d0872fce	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:00.346303+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e1b2cca0-ffc0-418e-91fb-c76fa77c3766	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "duplicate", "duplicate": true, "message_count": 27}	2026-06-02 07:06:04.453632+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d291ceb2-eafd-4534-b3f4-adf5a0e25c45	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:15.356341+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
dbcab661-89f6-4cae-accd-f3087cdd6af7	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:27.360757+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f43bb9b1-8522-43a3-b300-8c35baba5264	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:31.963856+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
cb92956c-c3ce-4bbb-9d26-402d8548d66a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:07:39.59882+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b0be5d23-31ff-4cf7-88f2-f441991b14a6	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:07:52.100256+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d104a0ba-e07b-49fc-aa56-8e549e7d86c1	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:28.358179+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
db9edd26-72d9-403c-b2f0-9447b408da92	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 28}	2026-06-02 07:00:37.800778+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
001ef2f3-34cb-4dc3-a7df-8da5f42215d4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:00:48.353717+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
af4c0ab7-94e9-4eaa-84ab-434299717fc2	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:01:00.34801+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
431c5300-ac5c-4362-a81d-fc23f1acf4ac	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	bf71883a-eedc-4d42-94ef-7ff55934f403	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "created", "duplicate": false, "message_count": 10}	2026-06-02 07:01:10.383797+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6102b69a-1645-47ca-b043-db342af3b372	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 23}	2026-06-02 07:01:40.414957+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ae149733-f317-40b0-adec-3410220220cb	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 28}	2026-06-02 07:04:12.128263+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
05914260-a0e5-420c-b880-ddbdca9428c3	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:04:39.428206+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5fd5cf29-8b0a-4132-908d-588e606a287c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:04:52.35844+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
97d4a697-2390-49b5-b2e9-b942ed5fca1a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:19.456177+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1908f269-72e5-4344-b672-f19affdfe615	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:31.951758+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2145cef8-5d3b-483a-b8a0-4dae82b4539c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:45.360683+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6854a68b-619b-4c1e-adf6-7e27df671c1c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:57.359132+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d2820640-fdee-4fbd-a5d1-cb21a7101682	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:01.945788+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
549b636a-4196-48e7-b66d-4169b5ae4926	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:25.354161+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5f23d6cd-655d-4d62-9bfc-4e592a307a42	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 12}	2026-06-02 07:06:34.56346+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e3f0e3c1-babe-4e9d-a4bb-de947238222c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:07:37.091566+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
50e3ceb4-067d-47c0-aeb8-01e2b7dcaad3	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:07:49.600066+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c4ae58bf-a7eb-429c-b50e-13c238551e58	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:08:02.090718+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
576e4839-0bdc-4458-bf44-936a965eca81	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 15}	2026-06-02 07:09:04.799692+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3420f826-9258-4507-af79-2f558e283c8b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:00:42.855669+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8db725fb-69dd-4086-8086-12a22ac1a657	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:00:55.351306+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
822f869d-bb92-4556-bb0b-f888c9444d33	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 19}	2026-06-02 07:01:20.566193+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
284bb71e-9588-4f2a-b21d-166934e01dbd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 25}	2026-06-02 07:02:28.369017+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7958d486-4aa9-4574-8ed0-921a049b34ce	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 30}	2026-06-02 07:03:36.899243+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bcb5be32-0cc5-4ee3-a5cf-7ddf3683a3df	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:04:47.350218+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
218eefb9-5d47-41ea-858b-fa7dae011292	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:00.355888+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a3670105-b54e-4804-8d4f-804bd5cf0049	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:04.818841+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1faae779-b3f6-4030-ae07-19a7fe94afdb	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:14.441723+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3c752c48-0f2d-4ee0-8f51-ef7885c005b5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:26.949455+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8ba11221-064e-45aa-9c60-1db21cacc9bd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:40.357898+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
30de2d75-8c34-4f30-893e-a2e1edd526df	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:52.347235+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f078c975-7800-49c2-bea5-a214663ab9cd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:20.346561+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
49249efb-4237-437a-9393-6463e7d6c637	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 14}	2026-06-02 07:07:04.622044+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d3d817f9-0c8f-47fd-abe5-b3a2cf97d819	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:07:44.606613+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
80142ff9-e4cf-4230-aa44-2e2a5ac700bb	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:07:57.096972+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bf1187a9-af69-4fed-a50a-b7640a151407	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 13}	2026-06-02 07:08:17.283729+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
242f7164-b7cc-4056-83c0-96f29579759f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:33.366286+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7bf28656-b832-4c1e-958f-704e882482be	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:56.34784+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
96373b3f-d8ec-4775-8ffc-31dbcd65ac80	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:00:45.361586+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
03506751-09d4-4f23-a14b-c187570cf1ca	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:00:58.355813+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f1df0253-d76a-4b38-8717-de3c6cf68f41	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 19}	2026-06-02 07:01:12.927403+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f7b6dd4f-42f7-42f4-8941-d530e528801e	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 24}	2026-06-02 07:01:57.924022+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9a9ac956-cb5c-467f-acc9-80b8b39e825a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 28}	2026-06-02 07:02:59.3815+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0af25ed6-4e4a-4380-a079-d5c74900d6d4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 27}	2026-06-02 07:04:34.616685+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
358b9ac5-745f-4ba8-8a69-e4bfe6c3069a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:04:50.353507+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
4cc2631e-2b79-4dbe-9691-1fd0b70df20e	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:02.363546+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f0ad2e33-7840-413e-91a3-4f34181ae60d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:16.946839+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
25e903ba-deec-4387-9da0-a89249404869	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:29.441823+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c1d1c1f9-506e-49fa-8728-00f63a855019	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:42.347996+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5ad313d9-aa94-49c8-840c-df0c6477036d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:05:55.348918+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d459b818-57db-4fd6-b047-86fa138ec806	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:06:22.35124+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
84919c92-80f1-4682-a4de-ab6b9216201b	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 12}	2026-06-02 07:06:57.085666+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
02da9a1c-c544-4d87-97ef-f4ae72d7257f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 16}	2026-06-02 07:07:32.063585+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9253f8c8-6149-432a-b309-59efe94a05d7	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:07:47.096425+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
606b9aa5-d575-4dc6-b29b-b206e85af00f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:07:59.599+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
17218a54-e76c-408d-95f0-fcd3b590da57	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 13}	2026-06-02 07:08:04.67466+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
aa21a8ca-c8ac-4f40-aa08-a1bc074256c5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 16}	2026-06-02 07:09:09.663909+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c261979b-a3c2-4dfc-bed2-e6b8fbe68f2a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:25.349954+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a9bd817f-fe2f-4f17-9d23-344e513df9ed	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:38.352645+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5f8c7a4a-5974-4d49-adab-64db64118eac	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:48.350641+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
026bba03-fd8f-4db1-9706-a24da64833ea	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:01.345018+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d6af959a-3031-4fff-9ada-82c7afdca82a	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:31.346994+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3307e06d-1196-492d-9ecd-00ea8f4be330	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:43.347591+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c3d03271-ae2c-47e4-84b8-64a0dad6cb87	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:54.346519+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
9ecaeae0-b18a-4cae-bab8-e7a5a96a3197	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:06.352371+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
85df82f4-f9e7-4a26-971e-2b3a3511bec1	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:36.349397+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b67bf3ea-5c73-411f-9e52-79005458c9c8	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 10}	2026-06-02 07:09:45.417331+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
bf889ea4-19c3-44c6-8580-c585db8746e2	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:59.345533+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6b4e9dea-aa4f-4a95-8132-c50122bf62e5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:41.34616+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d33b5589-200c-46bc-80ea-009ed0e075a2	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:09:51.349331+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d32142e5-93a0-46c9-903c-61222596a81d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:04.345416+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5198982f-aab6-4737-8640-7abdfc98d402	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:09.348086+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
683b3a19-0c91-41d5-9e52-836161bc4b50	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:11.351425+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3315b8b9-2336-4d93-9705-3e81f700703c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:14.353499+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5889fd3b-18c9-4c67-a1ee-62a4e449d913	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:15.860052+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d8300c4e-3515-452e-9a13-cf2b637c4cba	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:19.349524+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1a467a70-4d3d-4883-8f7d-6dbceddccf64	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:21.358452+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c0f301f1-2001-40fd-b7c6-5b683bb08ce3	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:24.354667+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e381b7eb-c384-49da-8cef-3dbed6efa8fd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:26.354063+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0475a7b2-dc36-406a-b080-39a23e918d65	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:29.355931+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3414a1c1-cffa-4325-9f6e-8a93ecc7ba01	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:31.355664+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
7e99fb36-2fef-4997-96ca-717503249742	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:34.348203+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f85bd873-1422-414b-bc47-2d520da03170	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:36.346012+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0bdd233e-1fb1-4828-ad30-0d16425b6185	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:39.345945+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e73aaf96-d323-40e2-a244-e0650297cc21	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:41.348976+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
a5986ae7-be67-4c97-b032-0197411181ed	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:44.349714+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
8cacd6a8-62b7-4c81-88b6-f4ac8e0a9ead	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:46.359246+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2ebe96d2-c394-4374-b2ba-5310dd763940	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:49.349143+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c26751a0-dede-47c3-b850-fb917a55635c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:51.356514+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d506baf6-253e-45e4-82f2-0063e3a8c7ec	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:27.353555+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
ad50cc51-28eb-4cb8-af10-d8d89a9fd82d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:40.350924+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
95f699c0-1162-448d-be1b-c88f09b33fad	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:52.353908+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
79b55a13-ee90-4835-b525-1b50dfb5dfd8	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:12:05.360489+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6c737c09-2b26-4504-97cd-30fd4095ba6f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:54.36792+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
49f50450-e132-4885-946a-b77310f379c6	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 12}	2026-06-02 07:11:10.924944+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
04c2cd66-3970-4059-98a5-896fd22d581f	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:31.407536+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
c5ee1df6-f172-4ebc-8315-f051ee851b80	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:42.353077+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d1398c32-bd1b-41b4-b70c-3b47757dcb10	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:55.345166+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
fc048fa4-63cc-40c9-be3a-420f6260e46d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:12:07.346405+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
3175e614-7fd2-423a-9496-254f52679d4d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:12:11.859355+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
867136f4-0e06-4a37-98f7-beeb5cacaf65	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:56.356084+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
2f0e08da-92e4-4f01-909a-d0b851429645	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 12}	2026-06-02 07:11:05.972653+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5dfbc36d-7dc3-400c-bc52-ad0a6ab503c4	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:19.355153+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
864fc4a6-07ed-4b69-a0b2-388bcf2d1100	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:32.355664+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
0b2d568b-7efd-44ed-ab45-33ed4a364e17	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:45.371169+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
660c8e6d-4e08-4e62-a6dc-2dfb04959f79	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:57.358411+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
b00541b1-2c0d-44a6-876b-15e48f199a20	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:12:10.36623+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
05a7f58c-8b13-46ff-88f2-500874a7583c	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:10:59.350669+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1b92a5b5-7cfd-482f-afce-030888092dac	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:03.35996+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d4def4de-d0db-41f5-a23b-8f4897425c2d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:22.345867+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
522914d6-3e16-45c4-b678-dba36c3567cf	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:35.345357+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
10edafe7-b3f2-47e2-9b40-88f71f1deb60	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:47.360448+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
07e8f78a-6f2d-4ace-bdc1-c0d41f6e6039	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:12:00.347965+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
6742de73-912d-41c0-8954-db498eba1609	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "updated", "duplicate": false, "message_count": 13}	2026-06-02 07:12:14.425379+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
1de45146-dc9f-4559-885b-8245773b88d5	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:01.352596+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
49240e27-0fb9-415b-ac6e-6b949973a537	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:25.354318+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
d58168d5-2e65-4887-ad1f-0d1f40781f9d	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:37.359043+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
45d36e93-82a6-420c-b353-65fcbb6cc2dd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:11:50.355681+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
5dbd02a8-f7c2-4954-b252-6847c318fb08	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	extension.whatsapp.snapshot_sync	conversation	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"status": "cleared", "duplicate": false, "message_count": 0}	2026-06-02 07:12:02.364681+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
61005340-7d82-4390-be43-117a10b1fd1c	2dfcc01b-ffc0-4da3-a152-db877f6895ab	salessgb@gmail.com	sales	auth.login	user	2dfcc01b-ffc0-4da3-a152-db877f6895ab	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "salessgb@gmail.com"}	2026-06-03 01:22:39.230997+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e4c40423-24d2-4e3c-b5ed-577b0f754f66	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-03 01:26:28.57206+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
f0114c7b-0dad-46f8-9343-1597c5bd5411	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-03 01:26:44.328484+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
e8c09c85-ddc5-4bd6-a88b-af18dfdebcbf	ef7c2ccc-3158-49a1-99f8-3550da95eec9	superadmin@clara.local	superadmin	auth.login	user	ef7c2ccc-3158-49a1-99f8-3550da95eec9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "superadmin@clara.local"}	2026-06-03 02:04:48.859107+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
06eda958-023a-4dee-bcff-bd6879127798	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	headsgb@gmail.com	head	auth.login	user	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	{"email": "headsgb@gmail.com"}	2026-06-03 02:23:29.368107+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd
\.


--
-- Data for Name: chat_review_cases; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.chat_review_cases (id, conversation_id, organization_id, lead_id, submitted_by_user_id, reviewer_user_id, status, review_label, review_summary, coaching_focus, recommended_action, reviewed_at, created_at, updated_at, workflow_scope, feedback_status, feedback_sent_at, feedback_acknowledged_at, feedback_resolved_at) FROM stdin;
4fcdb143-ce30-48b7-89ac-739c995d47f7	a1f51fee-463c-4356-b702-9f6555241c18	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	dfe2465b-b9db-41c8-a43b-386ee3819955	3c94e3d2-fb01-470a-a45c-7b00be2d208e	3c94e3d2-fb01-470a-a45c-7b00be2d208e	in_review	unik	Customer menunjukkan ketertarikan dengan menyebut angka harga dan menyarankan pembelian sambil menggunakan istilah seperti 'insyaallah lancar berkah manfaat'. Ada interaksi santai antar kelompok pelanggan dengan sentimen positif dan penuh semangat. Chat terbaru: Photo\nOk	Fokus coaching: cek kualitas follow-up, ketepatan membaca keberatan customer, dan kejelasan langkah berikutnya.	Follow up dengan pertanyaan klarifikasi kebutuhan dan tawarkan informasi produk lebih lengkap untuk memperkuat keputusan pembelian. Review draft balasan yang pending, cek tone, fakta, dan arah closing sebelum approve.	\N	2026-06-02 05:22:41.564075+00	2026-06-02 05:22:41.564078+00	admin_quality_check	sent_to_cs	2026-06-02 05:22:41.562805+00	\N	\N
\.


--
-- Data for Name: chat_review_notes; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.chat_review_notes (id, review_case_id, author_user_id, note_type, body, created_at) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.conversations (id, title, source, status, current_stage, lead_temperature, raw_filename, raw_text, started_at, last_message_at, created_at, organization_id, sales_user_id, lead_id, provider_key, external_thread_key) FROM stdin;
3db559c2-41f6-425c-ada3-e6564da25422	WhatsApp Chat 2026-04-12	whatsapp_txt	replied	education	warm	\N	12/04/26, 09.12 - Customer: Kak, ini programnya legal nggak?\n12/04/26, 09.13 - Sales Ani: Legal kak, nanti saya kirim dokumen resminya.	2026-04-12 02:12:00+00	2026-05-26 09:37:55.037391+00	2026-05-26 08:08:24.288587+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	98c10fd3-6986-49e4-9008-8b7923d2adf7	\N	\N
b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	whatsapp_extension	synced	qualification	cold	\N	title=Daffa Fachreza UG\nsubtitle=click here for contact info\n[12:44 PM, 5/10/2026] Faturrahman Ptra: Di Hutan kota deket tuku\n[12:45 PM, 5/10/2026] Daffa Fachreza UG: jauh yaa dari jcc?\n[12:50 PM, 5/10/2026] Faturrahman Ptra: Pintu yg kita masuk kmrn pas nntn timnas\n[12:50 PM, 5/10/2026] Faturrahman Ptra: Gak jauh jauh amat\n[1:02 PM, 5/10/2026] Faturrahman Ptra: Valo\n[1:03 PM, 5/10/2026] Daffa Fachreza UG: ayo, mandi dlu\n[1:41 PM, 5/10/2026] Faturrahman Ptra: Yapi gak bales\n[1:41 PM, 5/10/2026] Daffa Fachreza UG: mo maen apa kga ni\n[1:43 PM, 5/10/2026] Faturrahman Ptra: Party tebe??\n[1:44 PM, 5/10/2026] Daffa Fachreza UG: lagi main dia?\n[1:44 PM, 5/10/2026] Faturrahman Ptra: Tdi sih main\n[1:45 PM, 5/10/2026] Faturrahman Ptra: Kaga main mereka\n[1:45 PM, 5/10/2026] Daffa Fachreza UG: mau duo?\n[1:46 PM, 5/10/2026] Faturrahman Ptra: Sorean aja dah\n[1:47 PM, 5/10/2026] Daffa Fachreza UG: yodah\n[7:43 AM, 5/11/2026] Faturrahman Ptra: Udh pada nyampe yg sesi pagi?\n[7:46 AM, 5/11/2026] Faturrahman Ptra: Udah masuk bae\n[7:46 AM, 5/11/2026] Faturrahman Ptra: Tbe\n[8:04 AM, 5/11/2026] Daffa Fachreza UG: baru otw anj\n[8:10 AM, 5/11/2026] Faturrahman Ptra: Goblok njng\n[12:13 PM, 5/11/2026] Daffa Fachreza UG: 10121329\n[1:54 PM, 5/11/2026] Daffa Fachreza UG: Photo\nenak lu ye dah makan segala macem\n[2:15 PM, 5/11/2026] Faturrahman Ptra: Aus njg tpi\n[2:15 PM, 5/11/2026] Faturrahman Ptra: enak lu ye dah makan segala macem\nSi margianti ngasih sambutan pake video njng\n[4:07 PM, 5/11/2026] Daffa Fachreza UG: kata gua\n[4:07 PM, 5/11/2026] Daffa Fachreza UG: Aus njg tpi\ngua lupa bat bawa minum tadi\n[6:12 PM, 5/11/2026] Faturrahman Ptra: gua lupa bat bawa minum tadi\nSama njng\n[1:50 PM, 5/14/2026] Daffa Fachreza UG: tur\n[1:50 PM, 5/14/2026] Daffa Fachreza UG: lu ada canva prem ga\n[2:12 PM, 5/14/2026] Faturrahman Ptra: lu ada canva prem ga\nAda tpi email kantor\n[12:27 PM, 5/27/2026] Daffa Fachreza UG: mau trials tur?\n[5:58 PM, 5/27/2026] Daffa Fachreza UG: yah\n[5:59 PM, 5/27/2026] Daffa Fachreza UG: lgi gua tanya\n[7:24 PM, 5/27/2026] Daffa Fachreza UG: valo?\n[7:44 PM, 5/27/2026] Faturrahman Ptra: Masih di luar	2026-05-10 05:44:00+00	2026-05-27 12:44:00+00	2026-05-29 06:35:01.286102+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	50865d10-abb2-4c9d-91d5-63260857be10	\N	\N
a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	whatsapp_extension	synced	qualification	warm	\N	title=defa UG\nsubtitle=\n[8:46 AM, 5/13/2026] defa UG: aduh\n[8:46 AM, 5/13/2026] defa UG: foto 4x6 yak\n[8:46 AM, 5/13/2026] Faturrahman Ptra: Iyaa\n[8:46 AM, 5/13/2026] defa UG: dimintain semua itu tur?\n[8:46 AM, 5/13/2026] Faturrahman Ptra: Cuma klo gaada mah kayanya gpp jga sih\n[8:46 AM, 5/13/2026] Faturrahman Ptra: Soalnya diambil dari foto pas lu sidang\n[8:47 AM, 5/13/2026] defa UG: cetak di kampus bisa ga ya\n[8:47 AM, 5/13/2026] Faturrahman Ptra: Itubkalo foto lu yg di berkas sidang gak sesuai baru dipake foto baru\n[8:59 AM, 5/13/2026] defa UG: tur\n[8:59 AM, 5/13/2026] defa UG: kalau career center gimana maksudnya?\n[9:03 AM, 5/13/2026] Faturrahman Ptra: Photo\nIyaa ssan ini lu print\n[9:03 AM, 5/13/2026] defa UG: semuanya print ya yg bukti2\n[9:03 AM, 5/13/2026] Faturrahman Ptra: Atau gak yang gform\n[9:03 AM, 5/13/2026] Faturrahman Ptra: Iyaa diprint semua soalnya nnti dicap sama orang sananya\n[9:03 AM, 5/13/2026] defa UG: oalahh okeoke thank you tur\n[9:03 AM, 5/13/2026] defa UG: oiya btw yg bukti pembayaran printnya boleh dijadiin satu ga\n[9:04 AM, 5/13/2026] defa UG: atau satu gambar satu hvs?\n[9:04 AM, 5/13/2026] Faturrahman Ptra: oiya btw yg bukti pembayaran printnya boleh dijadiin satu ga\nKayanya sih boleh\n[9:04 AM, 5/13/2026] Faturrahman Ptra: Klo gua krmn sih gua pisah\n[9:04 AM, 5/13/2026] defa UG: satu gambar satu hvs ya\n[9:04 AM, 5/13/2026] defa UG: kemarin lu serahin pas foto atau ngga?\n[9:04 AM, 5/13/2026] Faturrahman Ptra: Gua ngasih\n[9:04 AM, 5/13/2026] Faturrahman Ptra: cuma gak dipake juga\n[9:05 AM, 5/13/2026] defa UG: oalahh\n[9:05 AM, 5/13/2026] defa UG: yaudah gua coba dulu ga bawa pas foto deh\n[9:05 AM, 5/13/2026] defa UG: lokasinya yg di hall itu ya tur>\n[9:05 AM, 5/13/2026] defa UG: ada tulisan ijazah di pintu\n[9:06 AM, 5/13/2026] Faturrahman Ptra: Samping gedung 4\n[9:06 AM, 5/13/2026] defa UG: gua ga apal pula gedung berapa2nya\n[9:06 AM, 5/13/2026] defa UG: pokoknya bank dki nih, belok kiri terus kanan lurus terus ya?\n[9:06 AM, 5/13/2026] Faturrahman Ptra: Yaa kan tangga tengah tuh lu turun lurus aja nnti ruangannya dikanan\n[9:06 AM, 5/13/2026] Faturrahman Ptra: pokoknya bank dki nih, belok kiri terus kanan lurus terus ya?\nIya ituu\n[9:07 AM, 5/13/2026] defa UG: okay thank you tur\n[10:24 AM, 5/13/2026] defa UG: dipanggilnya lama ga lu?\n[10:24 AM, 5/13/2026] Faturrahman Ptra: Gak nyampe 5 menit pas itu gua\n[10:24 AM, 5/13/2026] defa UG: rame?\n[10:24 AM, 5/13/2026] defa UG: gua sampe udh ada 10 org wl\n[10:24 AM, 5/13/2026] Faturrahman Ptra: Gak begitu rame\n[10:24 AM, 5/13/2026] Faturrahman Ptra: gua sampe udh ada 10 org wl\nCepet itu\n[10:25 AM, 5/13/2026] Faturrahman Ptra: Dipanggilnya juga ngacak\n[10:30 AM, 5/13/2026] defa UG: ohh ga urutan yaa	2026-05-13 01:46:00+00	2026-05-13 03:30:00+00	2026-05-29 04:34:35.408085+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	eb1270de-9671-4268-8060-b22ff3b0204e	\N	\N
338c6c5d-108e-4674-9b34-cb25ec5c3ca4	IT DEVELOPMENT	whatsapp_extension	synced	unknown	unknown	\N	title=IT DEVELOPMENT\nsubtitle=click here for group info\n[9:52 AM, 5/25/2026] +62 857-1400-3197: @~Faisal Rahman\n[] IT DEVELOPMENT: Faisal Rahman\n[9:52 AM, 5/25/2026] +62 857-1400-3197: @~πü¬πéôπüá\n[10:03 AM, 5/25/2026] +62 818-0770-3771: pagi mas @~Faisal Rahman api bank, masih sama belum bisa diakses\n@~Beatdonk\n[10:04 AM, 5/25/2026] +62 818-0770-3771: Kalau kemaren masalah di domainnya soalnya\n[12:41 PM, 5/25/2026] +62 812-8311-1160: bank-api.solidgold.co.id\n[12:46 PM, 5/25/2026] +62 818-0770-3771: dr sisi jaringan,status ping dari isi ke bank-api.solidgold.co.id replay atau rto? nslookup status gmn? klo replay dan nslookup nyampai,shrusnya aman dr sisi jaringan.\n@~Faisal Rahman\n[1:37 PM, 5/25/2026] +62 857-1400-3197: @~Faisal Rahman, coba di ping nih dr jaringan kantor\nini di ping & curl dari kantor\n[1:47 PM, 5/25/2026] +62 818-0770-3771: ini di ping & curl dari kantor\nKalo bisa di ping berarti udh bisa diakses\n[1:49 PM, 5/25/2026] +62 818-0770-3771: bank-api.rifan-financindo-berjangka.co.id\n[1:59 PM, 5/25/2026] +62 818-0770-3771: ini di ping & curl dari kantor\nIni ping dapet ip private, apa ini pake vpn kah? harus nya dapet ip publik..\n[2:00 PM, 5/25/2026] +62 857-1400-3197: Ini ping dapet ip private, apa ini pake vpn kah? harus nya dapet ip publik..\nlalu saya harus report ke tim ISInya bagaimana ya mas?\n[2:18 PM, 5/25/2026] +62 818-0770-3771: lalu saya harus report ke tim ISInya bagaimana ya mas?\nbank-api.solidgold.co.id\n[2:19 PM, 5/25/2026] +62 818-0770-3771: https://bank-api.solidgold.co.id\n[3:18 PM, 5/25/2026] +62 857-1400-3197: masih problem di ssl mas\n[3:25 PM, 5/25/2026] +62 857-1400-3197: sama mau tanya lagi mas, untuk ke depannya topup di MM, apakah akan menggunakan api bank tersebut ? setau saya api ini digunakan untuk regular proTrader\n[3:25 PM, 5/25/2026] +62 857-1400-3197: sama mau tanya lagi mas, untuk ke depannya topup di MM, apakah akan menggunakan api bank tersebut ? setau saya api ini digunakan untuk regular proTrader\nini pertanyaan dari ISI\n[3:29 PM, 5/25/2026] +62 818-0770-3771: masih problem di ssl mas\nCoba PT lain bisa ga?\n[3:31 PM, 5/25/2026] +62 818-0770-3771: sama mau tanya lagi mas, untuk ke depannya topup di MM, apakah akan menggunakan api bank tersebut ? setau saya api ini digunakan untuk regular proTrader\nAPI bank cuma itu\n[8:18 AM, 5/26/2026] +62 818-0770-3771: @~Beatdonk\n@~Faisal Rahman\nbank-api.solidgold.co.id\n[8:26 AM, 5/26/2026] +62 818-0770-3771: @~Beatdonk\n103.118.177.243\n172.26.1.132\n[10:56 AM, 5/26/2026] +62 812-8311-1160: Beatdonk	2026-05-25 02:52:00+00	2026-05-29 06:33:18.394+00	2026-05-29 06:32:57.421357+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1	\N	\N
00b27ccd-7a35-4f49-a42b-cabce1a618d6	Fatur	whatsapp_extension	synced	unknown	unknown	\N	title=Fatur\nsubtitle=Message yourself\n[6:36 PM, 3/13/2026] Faturrahman Ptra: https://www.instagram.com/reel/DSAIVI-E0ok/?igsh=ZzFsZW9rdDBoODRp\n[10:22 AM, 4/6/2026] Faturrahman Ptra: https://5xbbtdch-3000.asse.devtunnels.ms/\n[2:30 PM, 4/28/2026] Faturrahman Ptra: 9900011012183023\n[2:57 PM, 4/28/2026] Faturrahman Ptra: 9900011012183023\n[1:45 PM, 5/5/2026] Faturrahman Ptra: Assalamualaikum Bu, saya ingin izin tidak masuk kerja besok karna harus ngambil undangan untuk wisuda sekaligus saya mau izin untuk Senin, 11 Mei saya harus wisuda. Terima kasih.\n[3:05 PM, 5/23/2026] Faturrahman Ptra: https://fd5k9nkn-3000.asse.devtunnels.ms/	2026-03-13 11:36:00+00	2026-05-23 08:05:00+00	2026-05-29 05:52:25.147377+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	287ac016-6306-4b20-a122-e8fe6b0e58e8	\N	\N
f9dfb897-7af0-4890-b51d-d3e4735f4ea4	Kak Nita NM23	whatsapp_extension	synced	new_lead	cold	\N	title=Kak Nita NM23\nsubtitle=\n[10:30 PM, 5/25/2026] Faturrahman Ptra: Kak nit\n[10:30 PM, 5/25/2026] Faturrahman Ptra: Mau nanyaaa dongggg\n[10:30 PM, 5/25/2026] Faturrahman Ptra: Lu klo naik kereta turun dimana??\n[5:56 AM, 5/26/2026] Kak Nita NM23: Tebet tur\n[5:57 AM, 5/26/2026] Kak Nita NM23: Trus naik 6D	2026-05-25 15:30:00+00	2026-05-25 22:57:00+00	2026-05-29 05:51:52.116631+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	dfa2c7ec-5103-492f-a6d7-a1da0453aba8	\N	\N
93619231-dc0a-4756-9df3-2b824355d3f1	IT DEV Newsmaker23	whatsapp_extension	synced	qualification	warm	\N	title=IT DEV Newsmaker23\nsubtitle=Mas, Mas, +62 823-1038-4866, +62 831-6716-0987, You\n[] IT DEV Newsmaker23: Leo Core Technology\n[1:34 PM, 5/21/2026] Mas Kresno NM23: https://meet.google.com/zcf-mvyv-hvh\n+1 224-662-0572\n617 479 010\nhttps://tel.meet/zcf-mvyv-hvh?pin=3949154724303\n[4:57 PM, 5/21/2026] Mas Kresno NM23: https://docs.google.com/spreadsheets/d/1XLNVghyP7Aq4xa0idhRhzkPxWn9FfZNKfXzUJ6E3iNw/edit?usp=sharing\n[] IT DEV Newsmaker23: Leo Core Technology\n[2:37 PM, 5/22/2026] Faturrahman Ptra: https://id-market.newsmaker.id/\nhttps://www.youtube.com/embed/iEpJwprxDdk?si=UFmhWq5Dd0yoY9s6\nhttps://www.youtube.com/embed/gCNeDWCI0vo?si=qT3hgk3EXF9nIaDE\nhttps://www.youtube.com/embed/9NyxcX3rhQs?si=DZWUiTXGgiCtQlMX\nhttps://portalnews.newsmaker.id/api/v1/newsmaker/pasar-indonesia/berita\n[4:53 PM, 5/22/2026] Mas Kresno NM23: Gimana gess aman kah?\n[4:53 PM, 5/22/2026] Mas Kresno NM23: Jadi pindah ga?\n[4:56 PM, 5/22/2026] Mas Arya NM23: Aman\n[4:56 PM, 5/22/2026] Mas Arya NM23: Jadi pindah ga?\nKaga\n[4:56 PM, 5/22/2026] Mas Arya NM23: Senin\n[5:48 PM, 5/22/2026] Mas Kresno NM23: Oke oke siap gol\n[6:05 AM, 5/25/2026] Faturrahman Ptra: Hari ini gua izin yaa, lagi deman tinggi\n[6:13 AM, 5/25/2026] Mas Arya NM23: Wokeee\n[7:25 AM, 5/25/2026] Mas Kresno NM23: Oke tur gws ya tur\n[7:37 AM, 5/26/2026] Mas Kresno NM23: @Faturrahman Ptra\n[7:37 AM, 5/26/2026] Faturrahman Ptra: Udh sembuh belum tur? @Faturrahman Ptra\nUdah masuk ini\n[7:59 AM, 5/26/2026] Mas Kresno NM23: Okee siap turr\n[7:37 AM, 5/29/2026] +62 823-1038-4866: Hari ini yg masuk siapa ges?\n[8:06 AM, 5/29/2026] Mas Arya NM23: Gua sama fatur\n[8:45 AM, 5/29/2026] +62 823-1038-4866: Oke oke siapp gol	2026-05-29 06:32:24.805+00	2026-05-29 06:32:43.805+00	2026-05-29 04:33:19.734899+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	f2ea889d-069d-4ee7-b58d-0144508999b4	\N	\N
67343055-cd9f-4943-abcd-0016838210cd	CIMB Niaga	whatsapp_extension	synced	unknown	cold	\N	title=CIMB Niaga\nsubtitle=Business Account\n[] CIMB Niaga: Top Up e-Wallet di OCTO Bisa Dapat Cashback!\ncashback Rp5.000\nKeuntungannya:\nRp5.000\nOCTO\nKode Promo:\nPeriode:\ncimb.id/promo/topup0426\n[] CIMB Niaga: Bayar QRIS di OCTO Bisa Dapat Cashback!\nQRIS di OCTO\ncashback Rp12.500\nRp12.500\nOCTO\nKode Promo: QRIS0426\nPeriode:\ncimb.id/promo/qris0426\n[] CIMB Niaga: Beneran sepuasnya, transfer ke bank manapun bebas biaya pakai OCTO!\nBI-FAST\ncimb.id/bifast/promo\n[] CIMB Niaga: Top Up e-Wallet di OCTO Bisa Dapat Cashback!\ncashback Rp5.000\nKeuntungannya:\nRp5.000\nOCTO\nKode Promo:\nPeriode:\ncimb.id/promo/topup0426\n[] CIMB Niaga: Bayar QRIS di OCTO Bisa Dapat Cashback!\nQRIS di OCTO\ncashback Rp12.500\nRp12.500\nOCTO\nKode Promo: QRIS0426\nPeriode:\ncimb.id/promo/qris0426\n[] CIMB Niaga: Mau\nhealing\ntapi dompet tetap aman?\nQRIS OCTO\nOCTO Pay\n20%\nCinepolis, Gramedia, Bluebird\n30 Juni 2026\ncimb.id/promo/promoqris\n[] CIMB Niaga: Bayar QRIS di OCTO Bisa Dapat Cashback!\nQRIS di OCTO\ncashback Rp12.500\nRp12.500\nOCTO\nKode Promo:\nPeriode:\nhttps://cimb.id/promo/qris0526	2026-05-29 05:54:14.41+00	2026-05-29 05:54:20.41+00	2026-05-29 05:52:57.679828+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	dc343b57-4d91-4182-a27b-f4cb0b0b98b8	\N	\N
d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara	whatsapp_extension	synced	unknown	cold	\N	title=Ara\nsubtitle=click here for contact info\n[5:30 AM, 5/29/2026] Faturrahman Ptra: Aku otw kantor yaa sayang\n[6:07 AM, 5/29/2026] Ara≡ƒÆò: Yaallah kok bisa sih malah kaya gini pdhl after operasi awalnya cukup stabil\n[6:08 AM, 5/29/2026] Ara≡ƒÆò: Iya hati2 dijalan sayang\n[6:51 AM, 5/29/2026] Ara≡ƒÆò: Aku tahu ga ada kata2 yg bisa ngurangin rasa sakit kamu sekarang.\n[6:51 AM, 5/29/2026] Ara≡ƒÆò: Aku sedih banget belum bisa ada di samping kamu sekarang buat meluk kamu langsung, kalau mau nangis, nangis aja sepuasnya ya\n[6:52 AM, 5/29/2026] Ara≡ƒÆò: Pilihan kamu bawa mona ke dokter adalah bukti kalau kamu sangat menyayangi dan menghargai dia dan pengen dia sembuh ga pengen dia menderita, kamu mempercayai tindakan dokter, agar dia bisa sembuh dan bermain lagi. Itu adalah perwujudan rasa cinta yang luar biasa\n[6:53 AM, 5/29/2026] Ara≡ƒÆò: Kalau seminggu ke depan kamu males ngapa-ngapain, gpp banget, itu wajar. Aku ga akan nuntut kamu buat cepet-cepet ceria lagi. Ambil waktu kamu buat berduka ya sayang\n[6:53 AM, 5/29/2026] Faturrahman Ptra: Aku udh di kantor sayang\n[6:53 AM, 5/29/2026] Ara≡ƒÆò: Aku udh di kantor sayang\nIya sayang\n[11:34 AM, 5/29/2026] Faturrahman Ptra: Aku gatau besok mau kemana\n[12:00 PM, 5/29/2026] Ara≡ƒÆò: Kalo bsk ga jadi gpp kok sayang\n[12:06 PM, 5/29/2026] Faturrahman Ptra: Jdi kok tpi alu gatau mau kemana\n[12:07 PM, 5/29/2026] Ara≡ƒÆò: Ambil foto ga?\n[12:18 PM, 5/29/2026] Faturrahman Ptra: Ambil foto ga?\nAmbil tpi aku gatau mau kemana\n[12:19 PM, 5/29/2026] Ara≡ƒÆò: Yaudah kesitu aja dulu\n[12:19 PM, 5/29/2026] Ara≡ƒÆò: Abis itu mau langsung pulang atau dirumah aku dulu juga gpp\n[12:20 PM, 5/29/2026] Faturrahman Ptra: Iyaa sayangg	2026-05-28 22:30:00+00	2026-05-29 05:20:00+00	2026-05-29 04:30:48.518171+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	9a4f8e0c-b3eb-469f-8a5f-a6b842148815	\N	\N
59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	whatsapp_extension	synced	new_lead	cold	\N	title=Yavin UG\nsubtitle=\n[7:32 PM, 5/1/2026] Faturrahman Ptra: Gjdi kalo gantiin mah\n[7:35 PM, 5/1/2026] Yavin UG: ahk\n[9:47 PM, 5/1/2026] Yavin UG: Tur\n[10:23 PM, 5/1/2026] Faturrahman Ptra: Hah\n[10:23 PM, 5/1/2026] Yavin UG: main g tur\n[10:25 PM, 5/1/2026] Yavin UG: KOK NGANTUK\n[10:25 PM, 5/1/2026] Yavin UG: WOI\n[10:25 PM, 5/1/2026] Yavin UG: LOGIN\n[10:34 AM, 5/8/2026] Faturrahman Ptra: Pin'\n[12:11 PM, 5/8/2026] Yavin UG: Knapa rur\n[12:38 PM, 5/8/2026] Faturrahman Ptra: Alhamdulillah jelek\n[12:44 PM, 5/8/2026] Yavin UG: bagus tur\n[12:44 PM, 5/8/2026] Yavin UG: Piso\n[1:18 PM, 5/8/2026] Faturrahman Ptra: G\n[10:57 AM, 5/9/2026] Faturrahman Ptra: Valo gak\n[11:12 AM, 5/9/2026] Yavin UG: updet\n[11:21 AM, 5/9/2026] Yavin UG: lu mau duo emang?\n[11:23 AM, 5/9/2026] Faturrahman Ptra: Ajak depa coba\n[11:23 AM, 5/9/2026] Yavin UG: ayo partyannya tebe\n[11:25 AM, 5/9/2026] Faturrahman Ptra: Full gak?\n[11:27 AM, 5/9/2026] Faturrahman Ptra: -1\n[11:27 AM, 5/9/2026] Yavin UG: iya tebe g ikut\n[11:28 AM, 5/9/2026] Yavin UG: itu bebek g main palo\n[11:28 AM, 5/9/2026] Yavin UG: -1 sama dapa kali\n[11:28 AM, 5/9/2026] Faturrahman Ptra: Bebas\n[11:28 AM, 5/9/2026] Yavin UG: ajaak\n[1:02 PM, 5/10/2026] Faturrahman Ptra: Valo\n[3:14 PM, 5/10/2026] Yavin UG: Ok\n[6:32 PM, 5/14/2026] Faturrahman Ptra: Pin\n[6:38 PM, 5/14/2026] Yavin UG: ya\n[6:38 PM, 5/14/2026] Faturrahman Ptra: Gjdi maleman aja\n[6:38 PM, 5/14/2026] Yavin UG: Ok\n[7:17 PM, 5/14/2026] Yavin UG: Knp tur emang\n[6:47 PM, 5/15/2026] Faturrahman Ptra: Valo\n[6:58 PM, 5/15/2026] Yavin UG: Skarang?\n[6:58 PM, 5/15/2026] Faturrahman Ptra: Bntr mau beli bubur dlu\n[7:22 PM, 5/15/2026] Faturrahman Ptra: Main??\n[7:24 PM, 5/15/2026] Yavin UG: Ok\n[8:11 PM, 5/15/2026] Yavin UG: trio ma tebe?\n[8:14 PM, 5/18/2026] Faturrahman Ptra: Pin\n[8:14 PM, 5/18/2026] Faturrahman Ptra: Beli outlast trial yuk\n[10:59 PM, 5/18/2026] Yavin UG: Itu game ala\n[10:59 PM, 5/18/2026] Yavin UG: Apa\n[12:37 PM, 5/27/2026] Yavin UG: Tur\n[12:37 PM, 5/27/2026] Yavin UG: Trio g ma dapa\n[12:47 PM, 5/27/2026] Faturrahman Ptra: Gua lgi ngurus kucing gua abis kelindes kendaraan\n[12:47 PM, 5/27/2026] Yavin UG: Nooooooooooooo\n[6:25 PM, 5/27/2026] Yavin UG: tur\n[6:25 PM, 5/27/2026] Yavin UG: mo main?\n[6:26 PM, 5/27/2026] Faturrahman Ptra: Maleman aja pin	2026-05-01 12:32:00+00	2026-05-27 11:26:00+00	2026-05-29 05:53:00.191533+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	cd13e2a4-483e-4bc3-ba2e-2a152166424e	\N	\N
a1f51fee-463c-4356-b702-9f6555241c18	NEWS MAKER┬▓┬│	whatsapp_extension	synced	qualification	warm	\N	title=NEWS MAKER┬▓┬│\nsubtitle=PT Sapphire Asset International\n[5:34 PM, 6/1/2026] +62 821-7775-7812: https://vt.tiktok.com/ZSxvTwNm8/\n[5:34 PM, 6/1/2026] +62 821-7775-7812: Dibantu kawan\n[8:56 PM, 6/1/2026] Pa Raha NM23: @Kak Ayu NM23\n@+62 859-3922-4662\n[8:57 PM, 6/1/2026] Pa Raha NM23: @Bang Yudis NM23 John\n[9:01 PM, 6/1/2026] +62 859-3922-4662: @Kak Ayu NM23 @+62 859-3922-4662 nah kan ada 4450 heeheh buy ahhhh\n[9:02 PM, 6/1/2026] Bang Yudis NM23 John: @Bang Yudis NM23 John ada kan tuh 4450 wkwkwkw\nLah iya wkwkwkwkw\n[9:02 PM, 6/1/2026] Pa Raha NM23: Wkwkwkwkwk\n[9:02 PM, 6/1/2026] Bang Yudis NM23 John: Td sore maaih 4500 up\n[9:02 PM, 6/1/2026] Pa Raha NM23: Analisa spiritual\n[9:03 PM, 6/1/2026] Pa Raha NM23: Buy aja tahanan 500 point dijamin gak rugi, insyaallah lancar berkah manfaat\n[9:03 PM, 6/1/2026] Bang Yudis NM23 John: Amiin\n[8:22 AM, 6/2/2026] +62 821-2197-2455: https://vt.tiktok.com/ZSx3aveSU/\n[8:30 AM, 6/2/2026] Ka Dessy NM23: Solid.prime\nhttps://vt.tiktok.com/ZSx3mWdR2/\n[8:48 AM, 6/2/2026] Pa Marlin NM23: Frangki dan Marvi, tolong disiapkan, besok terakhir.tq\n[8:58 AM, 6/2/2026] Bang Marvy NM23: Photo\nOk	2026-06-01 10:34:00+00	2026-06-02 01:58:00+00	2026-06-02 02:50:05.378639+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	dfe2465b-b9db-41c8-a43b-386ee3819955	\N	\N
fe84cb9f-5247-4e0a-8921-8e51b911c774	Ara	whatsapp_extension	replied	qualification	cold	\N	title=Ara\nsubtitle=\n[10:20 PM, 6/1/2026] Ara≡ƒÆò: Owlah mending ranch simulator atau green hell?\n[10:21 PM, 6/1/2026] Faturrahman Ptra: Owlah mending ranch simulator atau green hell?\nKamu sukanya yg kaya gimana\n[10:21 PM, 6/1/2026] Faturrahman Ptra: Green Hell sih aku blm pernah main\n[10:21 PM, 6/1/2026] Faturrahman Ptra: Son Of The Forest??\n[10:21 PM, 6/1/2026] Faturrahman Ptra: Bajakan sih ada\n[10:21 PM, 6/1/2026] Faturrahman Ptra: Aku gjdi masuk jam 6\n[10:21 PM, 6/1/2026] Faturrahman Ptra: Besok masih jam8\n[10:22 PM, 6/1/2026] Ara≡ƒÆò: Aku juga suka survival, atau yg berbasis story game, atau yg durasinya panjang yg penting bisa Mabar berdua, aku suka horror game kok, klo jentet ak paling kenceng wkwk\n[10:22 PM, 6/1/2026] Ara≡ƒÆò: Son Of The Forest??\nAku blm pernah liat sih ini, boleh aja sih klo mau main bajakan\n[10:23 PM, 6/1/2026] Ara≡ƒÆò: Besok masih jam8\nOh begitu sayang yaudah klo begitu\n[10:35 PM, 6/1/2026] Faturrahman Ptra: Aku blm pernah liat sih ini, boleh aja sih klo mau main bajakan\nNnti aku kasih link downloadnya\n[10:36 PM, 6/1/2026] Ara≡ƒÆò: Okey deh sayang\n[5:10 AM, 6/2/2026] Faturrahman Ptra: Pagii sayangggg\n[5:10 AM, 6/2/2026] Faturrahman Ptra: Aku otw kantor yaa sayang\n[9:31 AM, 6/2/2026] Ara≡ƒÆò: Pagi sayang	2026-06-01 15:20:00+00	2026-06-02 02:49:50.322506+00	2026-06-02 02:48:40.873686+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	ae21e55c-d8bc-4d84-940f-20a620a4e895	\N	\N
2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	whatsapp_extension	replied	unknown	cold	\N	title=Keysha Alea\nsubtitle=\n[8:32 AM, 5/31/2026] Faturrahman Ptra: Video\nLu kondangan gak??\n[8:32 AM, 5/31/2026] Keysha Alea: iyaa, lu?\n[8:33 AM, 5/31/2026] Faturrahman Ptra: Ini gua udh sama ariq\n[8:33 AM, 5/31/2026] Faturrahman Ptra: Yg jam 12 kan??\n[8:33 AM, 5/31/2026] Keysha Alea: katanya jam 10?\n[8:33 AM, 5/31/2026] Keysha Alea: oji bisanya pagi cenah\n[8:34 AM, 5/31/2026] Keysha Alea: lu brg oji ga?\n[8:34 AM, 5/31/2026] Faturrahman Ptra: Itu mah akad kali\n[8:34 AM, 5/31/2026] Keysha Alea: akad kan jam 9\n[8:34 AM, 5/31/2026] Faturrahman Ptra: lu brg oji ga?\nIyaa anaknya baru bangun\n[8:34 AM, 5/31/2026] Keysha Alea: barengan atu\n[8:35 AM, 5/31/2026] Faturrahman Ptra: Ayo aja kumpul dmna\n[8:35 AM, 5/31/2026] Keysha Alea: yg cwo siapa aja emg?\n[8:35 AM, 5/31/2026] Keysha Alea: ariq di ruma lu?\n[8:35 AM, 5/31/2026] Faturrahman Ptra: Yg ceweknya siapa aja\n[8:35 AM, 5/31/2026] Faturrahman Ptra: yg cwo siapa aja emg?\nBaru gua, ariq, oji\n[8:35 AM, 5/31/2026] Faturrahman Ptra: ariq di ruma lu?\nIyaa\n[8:35 AM, 5/31/2026] Keysha Alea: Yg ceweknya siapa aja\ngua baru taunya bertigaan doang\n[8:35 AM, 5/31/2026] Keysha Alea: gua, citra, diah\n[8:36 AM, 5/31/2026] Faturrahman Ptra: Si bocah bucin??\n[8:36 AM, 5/31/2026] Faturrahman Ptra: Hana\n[8:36 AM, 5/31/2026] Keysha Alea: nah gatau\n[8:36 AM, 5/31/2026] Keysha Alea: laras katanya diundang, tp gatau da dtg apa ga\n[8:36 AM, 5/31/2026] Keysha Alea: citra yg chat soalnya\n[8:38 AM, 5/31/2026] Keysha Alea: ini jadinya mau jam brp? mau prepare soalnya\n[8:38 AM, 5/31/2026] Faturrahman Ptra: Bebas gua mah nunggu aja\n[8:42 AM, 5/31/2026] Keysha Alea: resha sm isan diundang ga?\n[8:42 AM, 5/31/2026] Faturrahman Ptra: Gatau\n[8:45 AM, 5/31/2026] Keysha Alea: jam 10 an aja berangkatnyaa\n[10:22 AM, 5/31/2026] Faturrahman Ptra: Dimane\n[10:24 AM, 5/31/2026] Keysha Alea: rumah\n[10:24 AM, 5/31/2026] Keysha Alea: lu?\n[10:24 AM, 5/31/2026] Faturrahman Ptra: Masih di rumah\n[10:24 AM, 5/31/2026] Faturrahman Ptra: Kesini aja udh ada oji ariq\n[10:32 AM, 5/31/2026] Keysha Alea: gua bw mobil tpnya\n[10:33 AM, 5/31/2026] Faturrahman Ptra: Njng deket juga\n[10:33 AM, 5/31/2026] Keysha Alea: HAHA	2026-05-31 01:32:00+00	2026-06-02 06:55:35.254945+00	2026-06-02 06:34:52.776884+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	2dfcc01b-ffc0-4da3-a152-db877f6895ab	6ce9423c-714e-49c7-884d-0569eb99b339	\N	\N
edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	whatsapp_extension	synced	unknown	unknown	\N	title=Keysha Alea\nsubtitle=\n[8:32 AM, 5/31/2026] Faturrahman Ptra: Video\nLu kondangan gak??\n[8:32 AM, 5/31/2026] Keysha Alea: iyaa, lu?\n[8:33 AM, 5/31/2026] Faturrahman Ptra: Ini gua udh sama ariq\n[8:33 AM, 5/31/2026] Faturrahman Ptra: Yg jam 12 kan??\n[8:33 AM, 5/31/2026] Keysha Alea: katanya jam 10?\n[8:33 AM, 5/31/2026] Keysha Alea: oji bisanya pagi cenah\n[8:34 AM, 5/31/2026] Keysha Alea: lu brg oji ga?\n[8:34 AM, 5/31/2026] Faturrahman Ptra: Itu mah akad kali\n[8:34 AM, 5/31/2026] Keysha Alea: akad kan jam 9\n[8:34 AM, 5/31/2026] Faturrahman Ptra: lu brg oji ga?\nIyaa anaknya baru bangun\n[8:34 AM, 5/31/2026] Keysha Alea: barengan atu\n[8:35 AM, 5/31/2026] Faturrahman Ptra: Ayo aja kumpul dmna\n[8:35 AM, 5/31/2026] Keysha Alea: yg cwo siapa aja emg?\n[8:35 AM, 5/31/2026] Keysha Alea: ariq di ruma lu?\n[8:35 AM, 5/31/2026] Faturrahman Ptra: Yg ceweknya siapa aja\n[8:35 AM, 5/31/2026] Faturrahman Ptra: yg cwo siapa aja emg?\nBaru gua, ariq, oji\n[8:35 AM, 5/31/2026] Faturrahman Ptra: ariq di ruma lu?\nIyaa\n[8:35 AM, 5/31/2026] Keysha Alea: Yg ceweknya siapa aja\ngua baru taunya bertigaan doang\n[8:35 AM, 5/31/2026] Keysha Alea: gua, citra, diah\n[8:36 AM, 5/31/2026] Faturrahman Ptra: Si bocah bucin??\n[8:36 AM, 5/31/2026] Faturrahman Ptra: Hana\n[8:36 AM, 5/31/2026] Keysha Alea: nah gatau\n[8:36 AM, 5/31/2026] Keysha Alea: laras katanya diundang, tp gatau da dtg apa ga\n[8:36 AM, 5/31/2026] Keysha Alea: citra yg chat soalnya\n[8:38 AM, 5/31/2026] Keysha Alea: ini jadinya mau jam brp? mau prepare soalnya\n[8:38 AM, 5/31/2026] Faturrahman Ptra: Bebas gua mah nunggu aja\n[8:42 AM, 5/31/2026] Keysha Alea: resha sm isan diundang ga?\n[8:42 AM, 5/31/2026] Faturrahman Ptra: Gatau\n[8:45 AM, 5/31/2026] Keysha Alea: jam 10 an aja berangkatnyaa\n[10:22 AM, 5/31/2026] Faturrahman Ptra: Dimane\n[10:24 AM, 5/31/2026] Keysha Alea: rumah\n[10:24 AM, 5/31/2026] Keysha Alea: lu?\n[10:24 AM, 5/31/2026] Faturrahman Ptra: Masih di rumah\n[10:24 AM, 5/31/2026] Faturrahman Ptra: Kesini aja udh ada oji ariq\n[10:32 AM, 5/31/2026] Keysha Alea: gua bw mobil tpnya\n[10:33 AM, 5/31/2026] Faturrahman Ptra: Njng deket juga\n[10:33 AM, 5/31/2026] Keysha Alea: HAHA	2026-05-31 01:32:00+00	2026-05-31 03:33:01+00	2026-06-02 06:55:43.605561+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	f7e91c79-8969-40ac-aa54-df6c247ad018	\N	\N
bf71883a-eedc-4d42-94ef-7ff55934f403	NEWS MAKER┬▓┬│	whatsapp_extension	synced	unknown	unknown	\N	title=NEWS MAKER┬▓┬│\nsubtitle=PT Sapphire Asset International\n[8:22 AM, 6/2/2026] +62 821-2197-2455: https://vt.tiktok.com/ZSx3aveSU/\n[8:30 AM, 6/2/2026] Ka Dessy NM23: Solid.prime\nhttps://vt.tiktok.com/ZSx3mWdR2/\n[8:48 AM, 6/2/2026] Pa Marlin NM23: Frangki dan Marvi, tolong disiapkan, besok terakhir.tq\n[8:58 AM, 6/2/2026] Bang Marvy NM23: Photo\nOk\n[] NEWS MAKER┬▓┬│: NewsMaker23\n[] NEWS MAKER┬▓┬│: NewsMaker23\n[] NEWS MAKER┬▓┬│: SG INSIGHT\n[] NEWS MAKER┬▓┬│: SG INSIGHT\n[12:55 PM, 6/2/2026] +62 821-7775-7812: https://vt.tiktok.com/ZSxTLfHDr/\n[1:02 PM, 6/2/2026] Ka Dessy NM23: Solid.prime\nhttps://vt.tiktok.com/ZSxTNBtTY/\nhttps://vt.tiktok.com/ZSxTNmoqw/	2026-06-02 01:22:00+00	2026-06-02 07:01:19.338+00	2026-06-02 07:01:10.352257+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	cb2b6526-39ff-43fa-ba7c-4fd7993b67ee	\N	\N
13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Ara	whatsapp_extension	synced	unknown	unknown	\N	title=Ara\nsubtitle=\n[2:07 PM, 6/2/2026] Faturrahman Ptra: Coba tekan kode 86 lalu Enter pada keyboard meteran untuk melihat berapa kWh yang dikonsumsi per hari, agar polanya kelihatan.\nCoba ini\n[2:07 PM, 6/2/2026] Ara≡ƒÆò: Gini deh kamu ada tv juga\nPdhl tv ga selalu nyala kok, skrg aja mati itu\n[2:08 PM, 6/2/2026] Ara≡ƒÆò: Adekku ngirim ini\n[2:08 PM, 6/2/2026] Faturrahman Ptra: Pdhl tv ga selalu nyala kok, skrg aja mati itu\nIyaa tpi kalo sekali nyala juga makan listrik banyak\n[2:09 PM, 6/2/2026] Faturrahman Ptra: Blm kulkas juga\n[2:10 PM, 6/2/2026] Ara≡ƒÆò: https://www.restuengklekmandiri.com/baca/ini-daftar-kode-rahasia-meteran-listrik-sesuai-dengan-merek-meteran/748/0003\n[2:10 PM, 6/2/2026] Ara≡ƒÆò: Kok beda ya sama ini\n[2:11 PM, 6/2/2026] Ara≡ƒÆò: 86 ga ada\n[2:11 PM, 6/2/2026] Faturrahman Ptra: Yaaa coba aja deh satu satu\n[2:11 PM, 6/2/2026] Ara≡ƒÆò: Iya deh nnti dicobain\n[2:11 PM, 6/2/2026] Ara≡ƒÆò: Takut salah mencet aku\n[2:11 PM, 6/2/2026] Ara≡ƒÆò: Soalnya bunda, adekku lg dijakarta\n[2:12 PM, 6/2/2026] Ara≡ƒÆò: Aku sm ayah doang di Cileungsi	2026-06-02 07:07:00+00	2026-06-02 07:12:00+00	2026-06-02 06:55:48.611775+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	77023bc7-3158-440a-808b-0f8fa63df9ba	\N	\N
\.


--
-- Data for Name: customer_profiles; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.customer_profiles (id, organization_id, assigned_user_id, display_name, canonical_key, last_contact_at, created_at, updated_at, identity_confidence, match_strategy, merge_notes, merged_into_profile_id, phone, email, address, status, temperature, temperature_source) FROM stdin;
d70dca54-e04b-411d-adf1-cf58c4910f2e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	Customer	unknown-customer	2026-05-26 09:37:55.037391+00	2026-05-26 08:08:24.302957+00	2026-05-29 01:36:02.077174+00	0.35	fallback_unknown	\N	\N	\N	\N	\N	active	unknown	auto
febe2bff-f106-4636-b40b-6d68c9c559c3	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	+62 857-1400-3197	62 857 1400 3197	2026-05-29 06:33:18.394+00	2026-06-02 01:43:21.122083+00	2026-06-02 01:43:21.122085+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	unknown	auto
4e971171-83df-44e5-b455-c438967c36d9	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	IT DEV Newsmaker23	it dev newsmaker23	2026-05-29 06:32:43.805+00	2026-06-02 01:43:21.129944+00	2026-06-02 01:43:21.129946+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	unknown	auto
f8b4b4af-e944-4725-9508-5ad752816cd3	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	CIMB Niaga	cimb niaga	2026-05-29 05:54:20.41+00	2026-06-02 01:43:21.134749+00	2026-06-02 01:43:21.134751+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	unknown	auto
d0e0cabd-2ce5-4a3a-9e84-67a08ce14b85	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	Daffa Fachreza UG	daffa fachreza ug	2026-05-27 12:44:00+00	2026-06-02 01:43:21.144619+00	2026-06-02 01:43:21.144621+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	unknown	auto
a9685aa1-1891-4e9f-9a41-793dda01409d	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	Yavin UG	yavin ug	2026-05-27 11:26:00+00	2026-06-02 01:43:21.149906+00	2026-06-02 01:43:21.149908+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	unknown	auto
423230ff-fb70-4df8-9506-be8ab815bd03	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	Kak Nita NM23	kak nita nm23	2026-05-25 22:57:00+00	2026-06-02 01:43:21.161076+00	2026-06-02 01:43:21.161079+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	unknown	auto
6546d7d0-5abf-4130-ba57-cabad577672b	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	defa UG	defa ug	2026-05-13 03:30:00+00	2026-06-02 01:43:21.16714+00	2026-06-02 01:43:21.167142+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	unknown	auto
5c9d0501-eab6-453f-b99c-9a6889b2fb3c	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	Fatur	fatur	2026-05-05 06:45:00+00	2026-06-02 01:43:21.171187+00	2026-06-02 01:43:21.171188+00	0.74	single_token_name	\N	\N	\N	\N	\N	active	unknown	auto
d974ce22-6769-4943-8dd7-7d8f3e933cca	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	Pa Raha NM23	pa raha nm23	2026-06-02 01:58:00+00	2026-06-02 02:50:05.388553+00	2026-06-02 02:50:05.388556+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	unknown	auto
2c880eb1-6aea-430f-9522-e61fb30acd17	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	+62 821-7775-7812	62 821 7775 7812	2026-06-02 01:58:00+00	2026-06-02 05:21:41.185582+00	2026-06-02 05:21:41.185583+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	warm	auto
863a514e-a3ad-48e3-8453-dc0aa6f0c12e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	Keysha Alea	keysha alea	2026-05-31 03:33:01+00	2026-06-02 06:34:52.813253+00	2026-06-02 06:55:43.63764+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	cold	auto
62b23a10-60ef-48b4-8fdf-9579c362e1b5	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	Ara≡ƒÆò	ara	2026-06-02 06:37:00+00	2026-06-02 01:43:21.138918+00	2026-06-02 06:55:48.633479+00	0.74	single_token_name	\N	\N	\N	\N	\N	active	cold	auto
3ffa07ae-d174-4518-9b9a-77df4ccc8890	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	+62 821-2197-2455	62 821 2197 2455	2026-06-02 07:01:19.338+00	2026-06-02 07:01:10.371047+00	2026-06-02 07:01:10.371051+00	0.9	name_normalized	\N	\N	\N	\N	\N	active	unknown	auto
\.


--
-- Data for Name: knowledge_update_proposals; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.knowledge_update_proposals (id, organization_id, conversation_id, chat_review_case_id, lead_id, proposed_by_user_id, reviewed_by_user_id, published_product_knowledge_id, title, category, proposed_content, source_type, rationale, status, review_decision_note, submitted_at, reviewed_at, published_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: kpi_alert_records; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.kpi_alert_records (id, organization_id, acknowledged_by_user_id, scope_type, alert_key, severity, title, description, recommended_action, target_href, status, first_detected_at, last_detected_at, acknowledged_at, resolved_at, created_at, updated_at, resolved_by_user_id, resolution_note) FROM stdin;
\.


--
-- Data for Name: kpi_command_snapshots; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.kpi_command_snapshots (id, organization_id, scope_type, snapshot_type, metrics_json, observations_json, created_at) FROM stdin;
\.


--
-- Data for Name: lead_activity_events; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.lead_activity_events (id, lead_id, organization_id, actor_user_id, event_type, title, description, from_value, to_value, created_at) FROM stdin;
686e443f-cf1b-43f6-9006-b5bf5ea27772	98c10fd3-6986-49e4-9008-8b7923d2adf7	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Customer	2026-05-26 08:08:24.298593+00
03da3001-3593-468f-a4ec-c9dc3367c646	98c10fd3-6986-49e4-9008-8b7923d2adf7	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	stage_changed	Stage lead diperbarui dari analisis	Clara menyelaraskan stage lead dari hasil percakapan terbaru.	unknown	qualification	2026-05-26 09:15:51.834947+00
8887a858-da9b-47ed-a0e2-815c30d73d3e	98c10fd3-6986-49e4-9008-8b7923d2adf7	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	warm	2026-05-26 09:15:51.839263+00
07e92d05-fa74-43ab-8df4-d55bbcf47096	98c10fd3-6986-49e4-9008-8b7923d2adf7	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Customer mempertanyakan kelegalan program, menunjukkan perhatian pada aspek legalitas sebelum melanjutkan pembicaraan.	2026-05-26 09:15:51.841483+00
661875c7-49a6-4992-92ca-22ab82ba8788	98c10fd3-6986-49e4-9008-8b7923d2adf7	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	Customer mempertanyakan kelegalan program, menunjukkan perhatian pada aspek legalitas sebelum melanjutkan pembicaraan.	Customer menanyakan tentang legalitas program, menunjukkan ketertarikan dengan keraguan terkait aspek legal.	2026-05-26 09:31:10.855722+00
ba43b6e5-b5b6-4141-8a84-42af26cb6365	98c10fd3-6986-49e4-9008-8b7923d2adf7	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	stage_changed	Stage lead diperbarui dari analisis	Clara menyelaraskan stage lead dari hasil percakapan terbaru.	qualification	education	2026-05-29 01:36:02.068195+00
740c2bf8-154b-4e67-a312-df2a2b689ece	98c10fd3-6986-49e4-9008-8b7923d2adf7	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	Customer menanyakan tentang legalitas program, menunjukkan ketertarikan dengan keraguan terkait aspek legal.	Customer menanyakan mengenai legalitas program, menunjukkan keraguan atau kebutuhan konfirmasi mengenai keabsahan program.	2026-05-29 01:36:02.073475+00
535140e2-0dd5-49d6-b8d7-599c3658f61a	9a4f8e0c-b3eb-469f-8a5f-a6b842148815	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Ara≡ƒÆò	2026-05-29 04:30:48.535257+00
56fb4d76-23bc-4a15-b5df-f51509525e71	9a4f8e0c-b3eb-469f-8a5f-a6b842148815	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	cold	2026-05-29 04:31:07.504104+00
3fa41c9a-1d55-443b-ad34-0418ca5c4bb2	9a4f8e0c-b3eb-469f-8a5f-a6b842148815	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Customer sedang dalam kondisi emosional terkait kondisi pasca operasi kucingnya, menunjukkan dukungan dan empati, tidak ada pembahasan terkait produk atau penawaran.	2026-05-29 04:31:07.507663+00
da55cad6-ddd8-47df-ad57-2b256d964c53	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Mas Arya NM23	2026-05-29 04:33:19.755118+00
13052fe1-1b24-40ec-ae98-b00c1ef2a5b1	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	stage_changed	Stage lead diperbarui dari analisis	Clara menyelaraskan stage lead dari hasil percakapan terbaru.	unknown	qualification	2026-05-29 04:33:26.583555+00
3be69dcf-6829-47ee-a265-7db49f66676c	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	warm	2026-05-29 04:33:26.586474+00
15d3cb27-3738-44c2-8c54-60e5005d4985	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Pelanggan mulai menunjukkan minat dengan mempertanyakan keamanan dan kepastian perpindahan layanan, menunggu konfirmasi lebih lanjut sambil tetap mempertimbangkan.	2026-05-29 04:33:26.588781+00
da107f05-efa0-4164-97b9-6e3c2aaf0d2a	eb1270de-9671-4268-8060-b22ff3b0204e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	defa UG	2026-05-29 04:34:35.436072+00
972d1e86-363d-478a-9a72-b1322f9a9f49	eb1270de-9671-4268-8060-b22ff3b0204e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	stage_changed	Stage lead diperbarui dari analisis	Clara menyelaraskan stage lead dari hasil percakapan terbaru.	unknown	qualification	2026-05-29 04:34:44.36031+00
f65c83ff-883a-430b-af7f-ff3e5c873fc2	eb1270de-9671-4268-8060-b22ff3b0204e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	warm	2026-05-29 04:34:44.363722+00
6772880e-9e67-4584-b8ec-724f77f1745c	eb1270de-9671-4268-8060-b22ff3b0204e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Customer bertanya terkait dokumen dan proses administrasi seperti foto 4x6, bukti pembayaran, lokasi pengambilan dokumen, dan tata cara print bukti pembayaran. Customer menunjukkan minat yang cukup tinggi untuk memahami proses namun belum ada indikasi keputusan pembelian yang final.	2026-05-29 04:34:44.365294+00
02a5ba12-60fc-4221-8702-bea49570cdcf	9a4f8e0c-b3eb-469f-8a5f-a6b842148815	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	Customer sedang dalam kondisi emosional terkait kondisi pasca operasi kucingnya, menunjukkan dukungan dan empati, tidak ada pembahasan terkait produk atau penawaran.	Customer menunjukkan perhatian dan empati terhadap kondisi personal sales, bersifat suportif dan penuh perhatian namun tidak ada indikasi minat membeli atau pembahasan produk.	2026-05-29 05:49:29.265422+00
808441d0-3711-4362-ad53-4655bf400c4e	9a4f8e0c-b3eb-469f-8a5f-a6b842148815	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	Customer menunjukkan perhatian dan empati terhadap kondisi personal sales, bersifat suportif dan penuh perhatian namun tidak ada indikasi minat membeli atau pembahasan produk.	Customer sedang dalam kondisi emosional yang sensitif karena kondisi pasca operasi seseorang bernama Mona. Customer menunjukkan dukungan emosional dan perhatian besar, tetapi tidak ada indikasi terkait niat membeli produk atau jasa dari sales.	2026-05-29 05:51:08.257439+00
d78090a7-18ad-4a09-8e22-f3eaa61b6d87	dfa2c7ec-5103-492f-a6d7-a1da0453aba8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Kak Nita NM23	2026-05-29 05:51:52.12291+00
c92e0ca2-46b3-444a-8bdc-00beb403134e	dfa2c7ec-5103-492f-a6d7-a1da0453aba8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	stage_changed	Stage lead diperbarui dari analisis	Clara menyelaraskan stage lead dari hasil percakapan terbaru.	unknown	new_lead	2026-05-29 05:51:57.791255+00
8da8bd3c-f928-48b8-bf7a-88b557cf0c95	dfa2c7ec-5103-492f-a6d7-a1da0453aba8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	cold	2026-05-29 05:51:57.793545+00
8f67148e-7bad-4185-948c-666c7f5fe924	dfa2c7ec-5103-492f-a6d7-a1da0453aba8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Customer hanya memberikan informasi singkat tentang lokasi turun kereta dan moda transportasi berikutnya.	2026-05-29 05:51:57.795155+00
661ac60c-d7f0-4b48-9d59-68171cd4e812	287ac016-6306-4b20-a122-e8fe6b0e58e8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Fatur	2026-05-29 05:52:25.156812+00
aa3ea472-fdb5-4a7e-a7a6-521b483bd27f	dc343b57-4d91-4182-a27b-f4cb0b0b98b8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	CIMB Niaga	2026-05-29 05:52:57.684534+00
67d22b0d-3728-4e6e-bd78-507dd0c8a647	cd13e2a4-483e-4bc3-ba2e-2a152166424e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Yavin UG	2026-05-29 05:53:00.21544+00
44851a8e-bc39-4f1d-b863-34ceea8275d1	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	follow_up_updated	Jadwal follow-up diperbarui dari discipline log	Sales memperbarui target follow-up berikutnya saat mengisi log harian.	\N	2026-05-31T06:44:00+00:00	2026-05-29 06:44:38.394474+00
0f5d3848-d980-4c93-bc51-0d0c959315ff	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	discipline_log_created	Discipline log harian ditambahkan	Aktivitas lapangan sales dicatat untuk lead ini.	\N	2026-05-29 | follow_up_call | waiting_customer	2026-05-29 06:44:38.398775+00
d73d4694-2272-4faa-b75e-a9681cf6ecdc	cd13e2a4-483e-4bc3-ba2e-2a152166424e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	stage_changed	Stage lead diperbarui dari analisis	Clara menyelaraskan stage lead dari hasil percakapan terbaru.	unknown	new_lead	2026-05-29 05:53:11.085679+00
8f99cdb6-f71d-46c4-8576-8c55a8233c7d	cd13e2a4-483e-4bc3-ba2e-2a152166424e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	cold	2026-05-29 05:53:11.088075+00
f08d77a7-30be-4013-8b0e-ee331277eda7	cd13e2a4-483e-4bc3-ba2e-2a152166424e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Customer memberikan respon singkat dan terbatas, belum menunjukkan minat yang kuat terhadap produk atau penawaran. Percakapan sering bersifat santai dan tidak fokus pada pembelian.	2026-05-29 05:53:11.08985+00
7ef0f9b1-e71a-4405-b54e-776eb2e5a2e7	9a4f8e0c-b3eb-469f-8a5f-a6b842148815	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	Customer sedang dalam kondisi emosional yang sensitif karena kondisi pasca operasi seseorang bernama Mona. Customer menunjukkan dukungan emosional dan perhatian besar, tetapi tidak ada indikasi terkait niat membeli produk atau jasa dari sales.	Customer menunjukkan perhatian dan dukungan emosional kepada sales yang sedang mengalami kesulitan pribadi, tanpa membicarakan kebutuhan atau ketertarikan terhadap produk atau layanan. Interaksi lebih bersifat personal dan suportif.	2026-05-29 06:31:43.365491+00
949bd460-1b3c-40f8-91eb-cc0b1fdb0be7	5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	+62 857-1400-3197	2026-05-29 06:32:57.457262+00
2f034829-180c-47a8-8013-488ac624b50f	dfa2c7ec-5103-492f-a6d7-a1da0453aba8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	Customer hanya memberikan informasi singkat tentang lokasi turun kereta dan moda transportasi berikutnya.	Customer hanya memberikan jawaban singkat tentang lokasi turun kereta dan moda transportasi tanpa menunjukkan minat beli.	2026-05-29 06:33:20.688962+00
30b2cc5c-0d1e-4807-80c0-02a65f813697	50865d10-abb2-4c9d-91d5-63260857be10	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Daffa Fachreza UG	2026-05-29 06:35:01.319444+00
75205922-278f-4e8b-9396-3bc792baa2a0	cd13e2a4-483e-4bc3-ba2e-2a152166424e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	Customer memberikan respon singkat dan terbatas, belum menunjukkan minat yang kuat terhadap produk atau penawaran. Percakapan sering bersifat santai dan tidak fokus pada pembelian.	Customer cenderung memberikan respons singkat dan tidak menunjukkan minat kuat terhadap penawaran. Percakapan lebih bersifat santai dan casual tanpa arahan pembelian jelas.	2026-05-29 06:35:16.970058+00
2505a245-3276-4d34-b21d-ee58749df98d	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	discipline_log_created	Discipline log harian ditambahkan	Aktivitas lapangan sales dicatat untuk lead ini.	\N	2026-05-29 | follow_up_call | waiting_customer	2026-05-29 06:44:50.730127+00
735371f7-4eb9-4707-b4b2-ce71ff8a3e35	dc343b57-4d91-4182-a27b-f4cb0b0b98b8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	cold	2026-05-29 05:54:20.49006+00
2fe79840-4091-4757-9624-d673b6d18dad	dc343b57-4d91-4182-a27b-f4cb0b0b98b8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Customer mengirimkan informasi promosi cashback dan promo pembayaran QRIS di OCTO secara berulang, tanpa respons langsung terhadap sales. Tidak ada indikasi minat beli atau tindakan lebih lanjut.	2026-05-29 05:54:20.493338+00
6e885d7a-02cf-4d75-bd3e-cbc84004d5d7	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	Pelanggan mulai menunjukkan minat dengan mempertanyakan keamanan dan kepastian perpindahan layanan, menunggu konfirmasi lebih lanjut sambil tetap mempertimbangkan.	Customer menunjukkan minat dan bertanya tentang keamanan dan perpindahan layanan. Mereka terlihat cukup siap untuk melanjutkan, namun membutuhkan kepastian terkait aspek teknis dan keamanan.	2026-05-29 06:32:30.237837+00
76dd306d-7c20-419b-8204-09e45b2e1b8d	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	discipline_log_created	Discipline log harian ditambahkan	Aktivitas lapangan sales dicatat untuk lead ini.	\N	2026-05-29 | follow_up_call | waiting_customer	2026-05-29 06:43:57.881417+00
ae9d832b-299a-4947-9c18-65935d7be951	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	discipline_log_created	Discipline log harian ditambahkan	Aktivitas lapangan sales dicatat untuk lead ini.	\N	2026-05-29 | follow_up_call | waiting_customer	2026-05-29 06:44:14.265409+00
e2cbdbfe-19c7-4b9c-8dc8-a97cdee62839	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	follow_up_updated	Jadwal follow-up diperbarui dari discipline log	Sales memperbarui target follow-up berikutnya saat mengisi log harian.	2026-05-31T06:44:00+00:00	2026-05-29T06:45:00+00:00	2026-05-29 06:45:14.056517+00
770a8f8a-29c1-4cc7-a7c4-4d17621f28b8	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	discipline_log_created	Discipline log harian ditambahkan	Aktivitas lapangan sales dicatat untuk lead ini.	\N	2026-05-29 | follow_up_call | waiting_customer	2026-05-29 06:45:14.059745+00
06381c04-ecd8-436b-a3ca-ac391bf3fe22	50865d10-abb2-4c9d-91d5-63260857be10	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	stage_changed	Stage lead diperbarui dari analisis	Clara menyelaraskan stage lead dari hasil percakapan terbaru.	unknown	qualification	2026-06-02 01:55:31.495102+00
f1953106-7570-4ec4-afd1-31144ba86676	50865d10-abb2-4c9d-91d5-63260857be10	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	cold	2026-06-02 01:55:31.500751+00
737bee3a-278c-44f8-9c40-1f186f073870	50865d10-abb2-4c9d-91d5-63260857be10	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Customer menunjukkan ketertarikan ringan dengan pertanyaan lokasi dan beberapa percakapan santai tentang aktivitas bermain, namun tidak menunjukkan sinyal kuat untuk membeli atau negosiasi serius.	2026-06-02 01:55:31.502743+00
8b8f0254-efaf-4026-9fcf-fc40053e66be	ae21e55c-d8bc-4d84-940f-20a620a4e895	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Ara≡ƒÆò	2026-06-02 02:48:40.90085+00
e4562c86-b578-4eac-8993-76d2c27f7b95	ae21e55c-d8bc-4d84-940f-20a620a4e895	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	stage_changed	Stage lead diperbarui dari analisis	Clara menyelaraskan stage lead dari hasil percakapan terbaru.	unknown	qualification	2026-06-02 02:49:12.53307+00
31aeed45-eabf-4926-b749-0f637851b104	ae21e55c-d8bc-4d84-940f-20a620a4e895	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	cold	2026-06-02 02:49:12.538124+00
b5b53a29-9142-4ad2-894a-991b5b9233c5	ae21e55c-d8bc-4d84-940f-20a620a4e895	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Customer menunjukkan minat ringan pada jenis game survival dan cerita dengan durasi panjang serta bisa bermain bersama. Tidak ada sinyal kuat untuk pembelian produk resmi. Percakapan sebagian besar bersifat santai dan informal.	2026-06-02 02:49:12.540691+00
94e1748c-03bd-4b01-ac24-a5c418845053	dfe2465b-b9db-41c8-a43b-386ee3819955	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Pa Raha NM23	2026-06-02 02:50:05.386709+00
646a332b-92c1-4426-8d3c-1a46111977c9	dfe2465b-b9db-41c8-a43b-386ee3819955	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	stage_changed	Stage lead diperbarui dari analisis	Clara menyelaraskan stage lead dari hasil percakapan terbaru.	unknown	qualification	2026-06-02 05:21:41.171794+00
ec896176-9edd-4979-a9ce-c15873cc44df	dfe2465b-b9db-41c8-a43b-386ee3819955	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	warm	2026-06-02 05:21:41.177998+00
836d29d2-d994-49ff-9f26-05fb3ed6a4fd	dfe2465b-b9db-41c8-a43b-386ee3819955	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Customer menunjukkan ketertarikan dengan menyebut angka harga dan menyarankan pembelian sambil menggunakan istilah seperti 'insyaallah lancar berkah manfaat'. Ada interaksi santai antar kelompok pelanggan dengan sentimen positif dan penuh semangat.	2026-06-02 05:21:41.180664+00
6c6a3e24-00b7-44dc-a793-b9d2b8a0d46f	6ce9423c-714e-49c7-884d-0569eb99b339	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	2dfcc01b-ffc0-4da3-a152-db877f6895ab	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Keysha Alea	2026-06-02 06:34:52.80974+00
7e8171c9-a1b8-4c66-bbee-31f672614e65	6ce9423c-714e-49c7-884d-0569eb99b339	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	2dfcc01b-ffc0-4da3-a152-db877f6895ab	temperature_changed	Temperatur lead diperbarui dari analisis	Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.	unknown	cold	2026-06-02 06:35:22.132596+00
a6189614-78d7-44d8-9905-4e7a94fc402f	6ce9423c-714e-49c7-884d-0569eb99b339	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	2dfcc01b-ffc0-4da3-a152-db877f6895ab	summary_updated	Ringkasan lead diperbarui dari analisis	Summary lead disegarkan dari hasil analisis AI terbaru.	\N	Percakapan didominasi oleh obrolan santai terkait rencana pertemuan/kondangan dan koordinasi waktu dan tempat. Tidak terdapat sinyal minat pembelian atau diskusi terkait produk/jasa.	2026-06-02 06:35:22.136556+00
d999fa56-48c5-42af-9ffb-e665cca3883c	6ce9423c-714e-49c7-884d-0569eb99b339	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	stage_changed	Stage lead diperbarui	Tahap pipeline lead diubah dari CRM.	unknown	education	2026-06-02 06:40:58.972455+00
9dd53aca-d55c-43f2-a9ba-a8425b8c6841	6ce9423c-714e-49c7-884d-0569eb99b339	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	follow_up_updated	Jadwal follow-up diperbarui dari discipline log	Sales memperbarui target follow-up berikutnya saat mengisi log harian.	\N	2026-06-03T06:41:00+00:00	2026-06-02 06:41:48.393878+00
0c1e64c2-1ec3-4c4e-b80d-060fa666ade9	6ce9423c-714e-49c7-884d-0569eb99b339	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	discipline_log_created	Discipline log harian ditambahkan	Aktivitas lapangan sales dicatat untuk lead ini.	\N	2026-06-02 | follow_up_chat | waiting_customer	2026-06-02 06:41:48.412371+00
6da3b193-e18d-4709-99c6-24b850f767d6	f7e91c79-8969-40ac-aa54-df6c247ad018	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Keysha Alea	2026-06-02 06:55:43.63434+00
1b6c176a-c77e-42f9-9333-25bbd1554c8c	77023bc7-3158-440a-808b-0f8fa63df9ba	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	Ara≡ƒÆò	2026-06-02 06:55:48.628661+00
8eec4957-3667-49f8-87f1-9850b9ca9ba6	cb2b6526-39ff-43fa-ba7c-4fd7993b67ee	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	lead_created	Lead baru dibuat	Lead otomatis dibuat saat conversation pertama kali dihubungkan.	\N	+62 821-2197-2455	2026-06-02 07:01:10.367759+00
\.


--
-- Data for Name: lead_deals; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.lead_deals (id, lead_id, organization_id, owner_user_id, status, currency, expected_value, deposit_amount, expected_close_date, closed_at, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lead_discipline_logs; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.lead_discipline_logs (id, lead_id, organization_id, actor_user_id, log_date, activity_type, result_status, main_objection, customer_mood, notes, next_follow_up_at, created_at, updated_at) FROM stdin;
b8115349-d0c3-4366-ae45-d071e2ce2d54	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	2026-05-29	follow_up_call	waiting_customer	\N	positive	\N	\N	2026-05-29 06:43:57.882852+00	2026-05-29 06:43:57.882853+00
8b10efb2-fbe3-4ef2-8101-f3eab9ac05e3	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	2026-05-29	follow_up_call	waiting_customer	\N	positive	Buatkan closingan	\N	2026-05-29 06:44:14.266225+00	2026-05-29 06:44:14.266227+00
396338c8-0029-4a2e-8002-e0f8c45dd687	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	2026-05-29	follow_up_call	waiting_customer	Trust	positive	\N	2026-05-31 06:44:00+00	2026-05-29 06:44:38.395389+00	2026-05-29 06:44:38.39539+00
6bd0afba-feeb-4e26-820e-2781efa337f1	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	2026-05-29	follow_up_call	waiting_customer	\N	positive	Buatkan closingan	\N	2026-05-29 06:44:50.731169+00	2026-05-29 06:44:50.731171+00
23812b98-6b96-4ecd-96ce-94d74c198acc	f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	2026-05-29	follow_up_call	waiting_customer	Trust	positive	Buatkan closingan	2026-05-29 06:45:00+00	2026-05-29 06:45:14.057609+00	2026-05-29 06:45:14.057611+00
d854322b-337d-4a84-add9-5261926da79f	6ce9423c-714e-49c7-884d-0569eb99b339	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	2026-06-02	follow_up_chat	waiting_customer	\N	neutral	Percakapan didominasi oleh obrolan santai terkait rencana pertemuan/kondangan dan koordinasi waktu dan tempat. Tidak terdapat sinyal minat pembelian atau diskusi terkait produk/jasa. Aksi berikutnya: Menunggu sinyal minat lebih jelas dari customer atau inisiatif customer untuk membahas produk/jasa. Chat terbaru: HAHA	2026-06-03 06:41:00+00	2026-06-02 06:41:48.395535+00	2026-06-02 06:41:48.395536+00
\.


--
-- Data for Name: lead_task_events; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.lead_task_events (id, task_id, actor_user_id, event_type, from_status, to_status, previous_due_at, next_due_at, notes, created_at) FROM stdin;
\.


--
-- Data for Name: lead_tasks; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.lead_tasks (id, lead_id, organization_id, assigned_user_id, task_type, status, title, description, due_at, completed_at, created_at, updated_at, completed_by_user_id, last_status_changed_at, workflow_scope, requested_by_role) FROM stdin;
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.leads (id, organization_id, assigned_user_id, display_name, source, current_stage, lead_temperature, summary, notes, last_contact_at, next_follow_up_at, created_at, updated_at, customer_profile_id, account_category) FROM stdin;
cd13e2a4-483e-4bc3-ba2e-2a152166424e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	Yavin UG	whatsapp_extension	new_lead	cold	Customer cenderung memberikan respons singkat dan tidak menunjukkan minat kuat terhadap penawaran. Percakapan lebih bersifat santai dan casual tanpa arahan pembelian jelas.	\N	2026-05-27 11:26:00+00	\N	2026-05-29 05:53:00.213265+00	2026-06-02 01:43:21.15448+00	a9685aa1-1891-4e9f-9a41-793dda01409d	unknown
dfa2c7ec-5103-492f-a6d7-a1da0453aba8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	Kak Nita NM23	whatsapp_extension	new_lead	cold	Customer hanya memberikan jawaban singkat tentang lokasi turun kereta dan moda transportasi tanpa menunjukkan minat beli.	\N	2026-05-25 22:57:00+00	\N	2026-05-29 05:51:52.121339+00	2026-06-02 01:43:21.162338+00	423230ff-fb70-4df8-9506-be8ab815bd03	unknown
98c10fd3-6986-49e4-9008-8b7923d2adf7	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	Customer	whatsapp_txt	education	warm	Customer menanyakan mengenai legalitas program, menunjukkan keraguan atau kebutuhan konfirmasi mengenai keabsahan program.	\N	2026-05-26 09:37:55.037391+00	\N	2026-05-26 08:08:24.291459+00	2026-05-29 01:36:02.074533+00	d70dca54-e04b-411d-adf1-cf58c4910f2e	unknown
eb1270de-9671-4268-8060-b22ff3b0204e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	defa UG	whatsapp_extension	qualification	warm	Customer bertanya terkait dokumen dan proses administrasi seperti foto 4x6, bukti pembayaran, lokasi pengambilan dokumen, dan tata cara print bukti pembayaran. Customer menunjukkan minat yang cukup tinggi untuk memahami proses namun belum ada indikasi keputusan pembelian yang final.	\N	2026-05-13 03:30:00+00	\N	2026-05-29 04:34:35.434447+00	2026-06-02 01:43:21.168996+00	6546d7d0-5abf-4130-ba57-cabad577672b	unknown
ae21e55c-d8bc-4d84-940f-20a620a4e895	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	Ara≡ƒÆò	whatsapp_extension	qualification	cold	Customer menunjukkan minat ringan pada jenis game survival dan cerita dengan durasi panjang serta bisa bermain bersama. Tidak ada sinyal kuat untuk pembelian produk resmi. Percakapan sebagian besar bersifat santai dan informal.	\N	2026-06-02 02:31:00+00	\N	2026-06-02 02:48:40.89715+00	2026-06-02 02:49:12.541794+00	62b23a10-60ef-48b4-8fdf-9579c362e1b5	unknown
287ac016-6306-4b20-a122-e8fe6b0e58e8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	Fatur	whatsapp_extension	unknown	unknown	\N	\N	2026-05-05 06:45:00+00	\N	2026-05-29 05:52:25.155082+00	2026-06-02 01:43:21.171966+00	5c9d0501-eab6-453f-b99c-9a6889b2fb3c	unknown
dfe2465b-b9db-41c8-a43b-386ee3819955	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	+62 821-7775-7812	whatsapp_extension	qualification	warm	Customer menunjukkan ketertarikan dengan menyebut angka harga dan menyarankan pembelian sambil menggunakan istilah seperti 'insyaallah lancar berkah manfaat'. Ada interaksi santai antar kelompok pelanggan dengan sentimen positif dan penuh semangat.	\N	2026-06-02 01:58:00+00	\N	2026-06-02 02:50:05.385078+00	2026-06-02 05:21:41.186977+00	2c880eb1-6aea-430f-9522-e61fb30acd17	unknown
50865d10-abb2-4c9d-91d5-63260857be10	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	Daffa Fachreza UG	whatsapp_extension	qualification	cold	Customer menunjukkan ketertarikan ringan dengan pertanyaan lokasi dan beberapa percakapan santai tentang aktivitas bermain, namun tidak menunjukkan sinyal kuat untuk membeli atau negosiasi serius.	\N	2026-05-27 12:44:00+00	\N	2026-05-29 06:35:01.317372+00	2026-06-02 01:55:31.503646+00	d0e0cabd-2ce5-4a3a-9e84-67a08ce14b85	unknown
f7e91c79-8969-40ac-aa54-df6c247ad018	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	Keysha Alea	whatsapp_extension	unknown	unknown	\N	\N	2026-05-31 03:33:01+00	\N	2026-06-02 06:55:43.632012+00	2026-06-02 06:55:43.638683+00	863a514e-a3ad-48e3-8453-dc0aa6f0c12e	unknown
5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	+62 857-1400-3197	whatsapp_extension	unknown	unknown	\N	\N	2026-05-29 06:33:18.394+00	\N	2026-05-29 06:32:57.454225+00	2026-06-02 01:43:21.124322+00	febe2bff-f106-4636-b40b-6d68c9c559c3	unknown
f2ea889d-069d-4ee7-b58d-0144508999b4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	IT DEV Newsmaker23	whatsapp_extension	qualification	warm	Customer menunjukkan minat dan bertanya tentang keamanan dan perpindahan layanan. Mereka terlihat cukup siap untuk melanjutkan, namun membutuhkan kepastian terkait aspek teknis dan keamanan.	\N	2026-05-29 06:32:43.805+00	2026-05-29 06:45:00+00	2026-05-29 04:33:19.75365+00	2026-06-02 01:43:21.131622+00	4e971171-83df-44e5-b455-c438967c36d9	unknown
dc343b57-4d91-4182-a27b-f4cb0b0b98b8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	CIMB Niaga	whatsapp_extension	unknown	cold	Customer mengirimkan informasi promosi cashback dan promo pembayaran QRIS di OCTO secara berulang, tanpa respons langsung terhadap sales. Tidak ada indikasi minat beli atau tindakan lebih lanjut.	\N	2026-05-29 05:54:20.41+00	\N	2026-05-29 05:52:57.682581+00	2026-06-02 01:43:21.136602+00	f8b4b4af-e944-4725-9508-5ad752816cd3	unknown
9a4f8e0c-b3eb-469f-8a5f-a6b842148815	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	Ara≡ƒÆò	whatsapp_extension	unknown	cold	Customer menunjukkan perhatian dan dukungan emosional kepada sales yang sedang mengalami kesulitan pribadi, tanpa membicarakan kebutuhan atau ketertarikan terhadap produk atau layanan. Interaksi lebih bersifat personal dan suportif.	\N	2026-05-29 05:20:00+00	\N	2026-05-29 04:30:48.5319+00	2026-06-02 01:43:21.140619+00	62b23a10-60ef-48b4-8fdf-9579c362e1b5	unknown
77023bc7-3158-440a-808b-0f8fa63df9ba	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	Ara≡ƒÆò	whatsapp_extension	unknown	unknown	\N	\N	2026-06-02 06:37:00+00	\N	2026-06-02 06:55:48.626882+00	2026-06-02 06:55:48.631786+00	62b23a10-60ef-48b4-8fdf-9579c362e1b5	unknown
6ce9423c-714e-49c7-884d-0569eb99b339	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	2dfcc01b-ffc0-4da3-a152-db877f6895ab	Keysha Alea	whatsapp_extension	education	cold	Percakapan didominasi oleh obrolan santai terkait rencana pertemuan/kondangan dan koordinasi waktu dan tempat. Tidak terdapat sinyal minat pembelian atau diskusi terkait produk/jasa.	\N	2026-06-02 06:55:35.254945+00	2026-06-03 06:41:00+00	2026-06-02 06:34:52.807158+00	2026-06-02 06:55:35.264817+00	863a514e-a3ad-48e3-8453-dc0aa6f0c12e	unknown
cb2b6526-39ff-43fa-ba7c-4fd7993b67ee	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	+62 821-2197-2455	whatsapp_extension	unknown	unknown	\N	\N	2026-06-02 07:01:19.338+00	\N	2026-06-02 07:01:10.365189+00	2026-06-02 07:01:10.372583+00	3ffa07ae-d174-4518-9b9a-77df4ccc8890	unknown
\.


--
-- Data for Name: marketing_execution_items; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.marketing_execution_items (id, organization_id, created_by_user_id, assigned_user_id, item_type, source_kind, status, priority, title, summary, recommended_action, notes, created_at, updated_at, campaign_name, result_notes, published_at, leads_generated, qualified_leads, won_leads, attributed_pipeline_value, attributed_won_value, attributed_deposit_amount) FROM stdin;
\.


--
-- Data for Name: marketing_insight_snapshots; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.marketing_insight_snapshots (id, organization_id, scope_type, snapshot_type, period_start, period_end, metrics_json, created_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.messages (id, conversation_id, sender_name, sender_type, message_text, message_timestamp, created_at, external_message_id) FROM stdin;
48f77465-d338-455a-816b-3dbff03a7338	3db559c2-41f6-425c-ada3-e6564da25422	Customer	customer	Kak, ini programnya legal nggak?	2026-04-12 02:12:00+00	2026-05-26 08:08:24.293849+00	\N
85cc7493-fe73-495f-9d57-73b82f5d1f49	3db559c2-41f6-425c-ada3-e6564da25422	Sales Ani	sales	Legal kak, nanti saya kirim dokumen resminya.	2026-04-12 02:13:00+00	2026-05-26 08:08:24.293854+00	\N
dc46ae78-f42d-459b-bcc5-e95ded9400ac	3db559c2-41f6-425c-ada3-e6564da25422	Sales Dashboard	sales	Halo Kak,┬áprogram Solid Prime ini diawasi BAPPEBTI, jadi sudah resmi kok≡ƒÿè. Kalau mau, aku bisa kirim dokumen legalitasnya biar Kakak bisa lihat langsung, gimana?	2026-05-26 09:37:55.037391+00	2026-05-26 09:37:55.040286+00	\N
c1a4a593-79c9-46fc-853d-f84606fcd26e	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Faturrahman Ptra	sales	Aku otw kantor yaa sayang	2026-05-28 22:30:00+00	2026-05-29 05:52:20.142747+00	waext:3bee7cd128e3b112c4fff995cab48d944d8c81e38c6e367109c7fa937c129557
d94dab10-8057-4dd9-adee-66c8b9b9c44b	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Yaallah kok bisa sih malah kaya gini pdhl after operasi awalnya cukup stabil	2026-05-28 23:07:00+00	2026-05-29 05:52:20.143586+00	waext:ee0d9b0b110701fdfcc1fad6b88d11a87fccabe9d72b0566e6538fd7611acaad
b1e0689d-d6c7-4833-a61a-24055a518f6f	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Iya hati2 dijalan sayang	2026-05-28 23:08:00+00	2026-05-29 05:52:20.144225+00	waext:73a361208ad839beaf81204b385bb862d50b7ea2b54a50a510dc8d98876b6129
45d4a709-911c-4c13-ba7a-8c8cb09e4156	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Aku tahu ga ada kata2 yg bisa ngurangin rasa sakit kamu sekarang.	2026-05-28 23:51:00+00	2026-05-29 05:52:20.144808+00	waext:76c5d5a272394bfee399e37926bc32c5416ffc42e40d29a397bb3189c91093e1
4a772533-2782-4411-866b-701b5f853c0b	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Aku sedih banget belum bisa ada di samping kamu sekarang buat meluk kamu langsung, kalau mau nangis, nangis aja sepuasnya ya	2026-05-28 23:51:01+00	2026-05-29 05:52:20.14542+00	waext:95fcf47d1aeaeeca75c98877b65e80a9f3322346bd49175adc349a7800e79864
d1a77073-591c-438b-9ea5-f2136acdcd4b	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Pilihan kamu bawa mona ke dokter adalah bukti kalau kamu sangat menyayangi dan menghargai dia dan pengen dia sembuh ga pengen dia menderita, kamu mempercayai tindakan dokter, agar dia bisa sembuh dan bermain lagi. Itu adalah perwujudan rasa cinta yang luar biasa	2026-05-28 23:52:00+00	2026-05-29 05:52:20.146003+00	waext:d719e0a373bba4bd6a6d6234ae066fedfd75a9d2e4f16387924d602190a69a2f
00559799-79c0-4cc4-8b99-80a632ded571	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Kalau seminggu ke depan kamu males ngapa-ngapain, gpp banget, itu wajar. Aku ga akan nuntut kamu buat cepet-cepet ceria lagi. Ambil waktu kamu buat berduka ya sayang	2026-05-28 23:53:00+00	2026-05-29 05:52:20.146777+00	waext:55b7834b0286c30d5dc04861109e47773a0353896b3fb7b581b552369c7912c0
aae8b650-06e5-4e0e-a862-5a62422aa9ed	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Faturrahman Ptra	sales	Aku udh di kantor sayang	2026-05-28 23:53:01+00	2026-05-29 05:52:20.1474+00	waext:fe674cb26fc05ca833edc3f8f3f4c7632b952f9fd08b2231b327523f23f03c24
aa1bcbde-1146-4dc8-bf2e-be513dbd1357	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Aku udh di kantor sayang\nIya sayang	2026-05-28 23:53:02+00	2026-05-29 05:52:20.148094+00	waext:a9a5e62180b66c586a5e585dda46b4364655133faa6fadb998419fee0447ab6b
166e6400-6b5b-475e-8095-829833cb34cf	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Faturrahman Ptra	sales	Aku gatau besok mau kemana	2026-05-29 04:34:00+00	2026-05-29 05:52:20.148678+00	waext:c8e8485d54e639c1bbbf22c974145dbcc5e3766b5328d39fa3ec955322ce30da
315b8e26-2f1e-412b-8e88-1cc8f68a71d7	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Kalo bsk ga jadi gpp kok sayang	2026-05-29 05:00:00+00	2026-05-29 05:52:20.149284+00	waext:157ed049b67d1f31380557f9bcc9881ec9d67045626678ba736c56014862465d
f81b848d-9481-4919-b54c-c77547eb95ce	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Faturrahman Ptra	sales	Jdi kok tpi alu gatau mau kemana	2026-05-29 05:06:00+00	2026-05-29 05:52:20.149892+00	waext:d7e7d0483c6806e561132dc7e77334bca43d3cd8f7904cbed6c2cb5bbd385d9b
be20370d-c378-4c52-be37-1b89f2a92b19	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Ambil foto ga?	2026-05-29 05:07:00+00	2026-05-29 05:52:20.150435+00	waext:189916fbd106edeb294c371cd2924b7921dd9b09ab2bbd10811e15a91dc91211
4e3ddbd5-1a41-44d4-a5f0-b6ce90b15212	fe84cb9f-5247-4e0a-8921-8e51b911c774	Ara≡ƒÆò	customer	Owlah mending ranch simulator atau green hell?	2026-06-01 15:20:00+00	2026-06-02 02:48:40.87916+00	waext:015e5ffa984923b5f040c00b2235159e4a07e51d293e2e6e56f1950285acfd24
be557330-5f0b-4b6f-916e-631345051a38	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Faturrahman Ptra	sales	Ambil foto ga?\nAmbil tpi aku gatau mau kemana	2026-05-29 05:18:00+00	2026-05-29 05:52:20.150971+00	waext:aae55feba175bf6987f7f413b596ebfd7b6b1d40de849221017304c61e0e4b77
f05e2c7b-75fe-4f8e-975f-fa35752105c7	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Yaudah kesitu aja dulu	2026-05-29 05:19:00+00	2026-05-29 05:52:20.151461+00	waext:daeacd4f823162be1143313627585c722204cc9629d438cb7c438cd17ae2029f
fd350d2c-3ccc-4f40-8f53-8c15b125a5b2	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Ara≡ƒÆò	customer	Abis itu mau langsung pulang atau dirumah aku dulu juga gpp	2026-05-29 05:19:01+00	2026-05-29 05:52:20.151966+00	waext:4f88894813aaba8f279318dc0640e395a97059d189755850ea004d83d31c5af6
88fefcbd-d639-491d-aff5-337e72bd2472	d8dc1bef-c282-4bcd-9468-19b12d65bc90	Faturrahman Ptra	sales	Iyaa sayangg	2026-05-29 05:20:00+00	2026-05-29 05:52:20.152479+00	waext:c233ab1ec5c27d03688fa922ecc48294c1ccfe35a7e23cc6c87e7b092d13cdcc
ead90255-4f0c-4871-9e4b-46f884203bf9	fe84cb9f-5247-4e0a-8921-8e51b911c774	Faturrahman Ptra	sales	Owlah mending ranch simulator atau green hell?\nKamu sukanya yg kaya gimana	2026-06-01 15:21:00+00	2026-06-02 02:48:40.882487+00	waext:f6cc43812219d7f9bc63e9f6571d3ee426e741a8576e536924e2cd2f2f5bcb42
a499442c-5cc6-4910-9117-d1c9c89f8f20	fe84cb9f-5247-4e0a-8921-8e51b911c774	Faturrahman Ptra	sales	Green Hell sih aku blm pernah main	2026-06-01 15:21:01+00	2026-06-02 02:48:40.883885+00	waext:ebcdb7403222969bd5f854db2a59210b55954d6962df84ae09ae6a58a04b817e
cf974c82-aa1f-40d4-81b9-09880df30cc4	fe84cb9f-5247-4e0a-8921-8e51b911c774	Faturrahman Ptra	sales	Son Of The Forest??	2026-06-01 15:21:02+00	2026-06-02 02:48:40.884765+00	waext:9cd27fc34e843776779eedd6f55e39ec0edd89ad3a6114a5e35774d6cab12ab5
b7e79f33-303e-4f4a-8976-beac36e5ea94	fe84cb9f-5247-4e0a-8921-8e51b911c774	Faturrahman Ptra	sales	Bajakan sih ada	2026-06-01 15:21:03+00	2026-06-02 02:48:40.885631+00	waext:ce9142ec7948eb935eccd6e40f5140cda6359948f5d7a1972c5412c4406df9ef
afcf3459-8a7f-4c32-b64f-56499ab98c42	fe84cb9f-5247-4e0a-8921-8e51b911c774	Faturrahman Ptra	sales	Aku gjdi masuk jam 6	2026-06-01 15:21:04+00	2026-06-02 02:48:40.886448+00	waext:4088c2f479b4b287a02e716e9552bc1a3624d5ed7b012d116ec14d5398bd3cff
eeff88c5-0e38-4379-82f5-6fa97dd94031	fe84cb9f-5247-4e0a-8921-8e51b911c774	Faturrahman Ptra	sales	Besok masih jam8	2026-06-01 15:21:05+00	2026-06-02 02:48:40.887634+00	waext:dddd909afd83bd0dac6fef71270125d97ca19074a7447aa5679edb8be07bd848
04a4abd9-a530-4f3b-bff0-322c7b939870	93619231-dc0a-4756-9df3-2b824355d3f1	IT DEV Newsmaker23	customer	Leo Core Technology	2026-05-29 06:32:24.805+00	2026-05-29 04:33:19.737528+00	waext:8516bfac4f0cdb0c9e869006c4aafbb40d28f71d707efd4d7ff35b25b4a499da
235e5347-f7be-4dd0-a05f-6924903f07fa	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Arya NM23	customer	Aman	2026-05-29 06:32:31.805+00	2026-05-29 06:32:17.750685+00	waext:78bfe14f7dfde6afe7e4ea442ee4d02f06710a078acfa85b20de0a4c0f111566
2fab6387-2967-4aaf-b0ac-8e4f2fd149cd	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Kresno NM23	customer	https://meet.google.com/zcf-mvyv-hvh\n+1 224-662-0572\n617 479 010\nhttps://tel.meet/zcf-mvyv-hvh?pin=3949154724303	2026-05-29 06:32:25.805+00	2026-05-29 06:32:17.744769+00	waext:db20b38e37564cce07463eb9c43dd8f3767ef96d29feb8985309a12985c659f1
94caf6b7-63c5-4835-8cc2-9cc46a93f354	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Kresno NM23	customer	Jadi pindah ga?	2026-05-29 06:32:30.805+00	2026-05-29 06:32:17.749518+00	waext:748e3bcf16c12b4f456d7133ff2ede5db148be00f2ff6ba9831257ef3834befa
af6cdeb5-f952-444e-92ae-d151a5378048	93619231-dc0a-4756-9df3-2b824355d3f1	Faturrahman Ptra	sales	https://id-market.newsmaker.id/\nhttps://www.youtube.com/embed/iEpJwprxDdk?si=UFmhWq5Dd0yoY9s6\nhttps://www.youtube.com/embed/gCNeDWCI0vo?si=qT3hgk3EXF9nIaDE\nhttps://www.youtube.com/embed/9NyxcX3rhQs?si=DZWUiTXGgiCtQlMX\nhttps://portalnews.newsmaker.id/api/v1/newsmaker/pasar-indonesia/berita	2026-05-29 06:32:28.805+00	2026-05-29 06:32:17.747346+00	waext:ab3cf7ea5fbc2270263b0408a2f2ae9ed5fa4e110bb63db5f2657aead80aa037
1f3ef4b6-738d-4342-b9cc-73fb8364fc49	fe84cb9f-5247-4e0a-8921-8e51b911c774	Ara≡ƒÆò	customer	Aku juga suka survival, atau yg berbasis story game, atau yg durasinya panjang yg penting bisa Mabar berdua, aku suka horror game kok, klo jentet ak paling kenceng wkwk	2026-06-01 15:22:00+00	2026-06-02 02:48:40.88865+00	waext:1d8d90371e589f7fa6d0966e8a1a0c3188492a4b9e7c85bed0d10dfe80e73958
9346be92-7ced-4478-98d9-669642e70be8	fe84cb9f-5247-4e0a-8921-8e51b911c774	Ara≡ƒÆò	customer	Son Of The Forest??\nAku blm pernah liat sih ini, boleh aja sih klo mau main bajakan	2026-06-01 15:22:01+00	2026-06-02 02:48:40.889756+00	waext:e30ae86f3fe38325d46fc370503f1fb99564387bcffa27adb2b688dcb7eb4e96
a8fe9d13-e264-4d82-ae1d-e58339ee9aa2	fe84cb9f-5247-4e0a-8921-8e51b911c774	Ara≡ƒÆò	customer	Besok masih jam8\nOh begitu sayang yaudah klo begitu	2026-06-01 15:23:00+00	2026-06-02 02:48:40.890723+00	waext:cb238b04577646cc4ea9bda2d99058b0e5957775f498a7321077676814a8caa1
53149c59-b6d1-4161-983a-6a97b5563a59	fe84cb9f-5247-4e0a-8921-8e51b911c774	Faturrahman Ptra	sales	Aku blm pernah liat sih ini, boleh aja sih klo mau main bajakan\nNnti aku kasih link downloadnya	2026-06-01 15:35:00+00	2026-06-02 02:48:40.891805+00	waext:bb2f62a7d7a454d0f1bf68a19dcd0c5a71a280b9a06c94d0d705d08122e0e66c
4cedd640-0920-414c-a85f-9b59698819f2	fe84cb9f-5247-4e0a-8921-8e51b911c774	Ara≡ƒÆò	customer	Okey deh sayang	2026-06-01 15:36:00+00	2026-06-02 02:48:40.892831+00	waext:2c28f67dc8c641562b13e6cd033e4554b8752ac2ad277cd4680a80deef5e5d49
0172ecc3-05d1-4a36-9a2b-0e3c1fd46ad0	fe84cb9f-5247-4e0a-8921-8e51b911c774	Faturrahman Ptra	sales	Pagii sayangggg	2026-06-01 22:10:00+00	2026-06-02 02:48:40.893679+00	waext:eedc7df5c3f4d5a41da41fa8edcdcd752cff165a2d370a99c6483fdfbe49ba48
3c5ff22b-c13f-44f9-9418-221b3f1840c8	fe84cb9f-5247-4e0a-8921-8e51b911c774	Faturrahman Ptra	sales	Aku otw kantor yaa sayang	2026-06-01 22:10:01+00	2026-06-02 02:48:40.894524+00	waext:87d8fcc551904e6b49809bd4c2bb80b8db61f899289593e6916749be2e512ab6
6854fc06-324e-430d-a122-01181402a5b7	fe84cb9f-5247-4e0a-8921-8e51b911c774	Ara≡ƒÆò	customer	Pagi sayang	2026-06-02 02:31:00+00	2026-06-02 02:48:40.895433+00	waext:382464a5edce87915be4a9543b4067e9403fcc3db65df8ff0a411cbe5d10b729
cadad920-2c3b-44cd-8f21-d144554f13aa	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Arya NM23	customer	Senin	2026-05-29 06:32:33.805+00	2026-05-29 04:33:19.745147+00	waext:9fc7166949c8bb40c6a3c312e67746d13066f3e71c100b86d776fe4855282626
4c6e7031-3f6b-4f39-9d42-bb4501f08ab8	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Ara≡ƒÆò	customer	Soalnya bunda, adekku lg dijakarta	2026-06-02 07:11:04+00	2026-06-02 07:11:10.872493+00	waext:521a8f148ebe9841a660877951838a2b178648231b6e94d6061fd95a35f6eec0
8735263e-232d-402a-bf9c-01cae43cc230	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Video\nLu kondangan gak??	2026-05-31 01:32:00+00	2026-06-02 06:34:52.780648+00	waext:cd0e67a4ac1bd5673c170b2521ea831f1420487544b5a32a7528fa8610294b6a
5cda4601-9300-413c-b47b-cf008d053875	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	iyaa, lu?	2026-05-31 01:32:01+00	2026-06-02 06:34:52.781961+00	waext:c02a452877346a0e611ac42724b92aeecc56004d2c036e5f0c7585dfa05b1959
814e36a1-2c03-4c6a-af58-5c159967a2d8	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Ini gua udh sama ariq	2026-05-31 01:33:00+00	2026-06-02 06:34:52.782868+00	waext:637aefdca5660d3c1b4ae686e3b84573bcc6dce8688a1807575cb3ce647ea46c
88448697-3009-48ed-bc10-0ed18bf03e3e	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Yg jam 12 kan??	2026-05-31 01:33:01+00	2026-06-02 06:34:52.783802+00	waext:03ca018765a94fedcc1e2ab4fe93a93040a562aa22b1fb5fcfa3d3cb3dc2ad87
4aef9ec9-49e3-4acc-9a0f-aa88102ad93c	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	katanya jam 10?	2026-05-31 01:33:02+00	2026-06-02 06:34:52.784759+00	waext:2139b45443bb8b0c082755bdbb17fc4959645033e0a9b3b312823604a4ecf379
9bb4fc45-6ea3-49cd-b645-3ad3fae221be	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	oji bisanya pagi cenah	2026-05-31 01:33:03+00	2026-06-02 06:34:52.785845+00	waext:0243b026049f42c2cedd27da1712279db4f47d043d6709f4c78ad066eeb8f610
a287e517-931a-4363-8f27-8b4c1815aec1	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	lu brg oji ga?	2026-05-31 01:34:00+00	2026-06-02 06:34:52.786972+00	waext:decf75a889ffed59cb78db8de5d4a0b0bd1166af3225ac37fad1b73e0f005acc
4dbb532e-42f4-40c1-976b-94d25afb818b	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Itu mah akad kali	2026-05-31 01:34:01+00	2026-06-02 06:34:52.787728+00	waext:c56d9388c14ab6bd232ecdde2bdbadc29d4a5bde8b0c479f06553aad73dc086d
b5ce6eae-fc79-4212-8af7-44e3b353d00e	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	akad kan jam 9	2026-05-31 01:34:02+00	2026-06-02 06:34:52.788646+00	waext:bce5dd6d03648e3f79255795d29e838cfec05c0fd06f9016be18b5ee6ef4cbaf
9393fe77-0dd7-4de3-8a28-d8bb4ee2e581	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	aduh	2026-05-13 01:46:00+00	2026-05-29 04:34:35.410003+00	waext:2f6371a4036c8e08d2aa8624642e63324ee68531e6d70f561fc22d922e108f22
7ad806af-03af-4390-a25d-208d9ffdb201	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	foto 4x6 yak	2026-05-13 01:46:01+00	2026-05-29 04:34:35.410739+00	waext:570a73879585d650c8028ca20a2f10851ce8fbacbdd8409d19805d3f8eeb5b4f
d1b273c0-b226-4bc4-922e-61ad12b87e8b	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Iyaa	2026-05-13 01:46:02+00	2026-05-29 04:34:35.41139+00	waext:7bd83665c68af19a9dae8b18c2a1a5f5177264679e33d125873967ca3626d649
46485cc1-6c78-4cb6-8c4e-dad776c8451e	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	dimintain semua itu tur?	2026-05-13 01:46:03+00	2026-05-29 04:34:35.412289+00	waext:e32683a2dbca6c6de5ee0c1e31a5fb48c42970f215c8ef5b08f6421612609d0d
f2dad2d3-10a8-4cb8-8d45-6077da0c70ce	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Cuma klo gaada mah kayanya gpp jga sih	2026-05-13 01:46:04+00	2026-05-29 04:34:35.412878+00	waext:9fa8964036a5b847367323b55ce11826fdb8c22722ba3be05eceaf1bb43fdefd
b181f783-9a8b-4eff-867a-40022389f68d	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Soalnya diambil dari foto pas lu sidang	2026-05-13 01:46:05+00	2026-05-29 04:34:35.413414+00	waext:7161e6213c8f1d986b7eb6933e6c2f0c844d66443aa8b168244f1a9696249a96
bd81312c-5703-4633-83cb-c5edc7b283c2	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	cetak di kampus bisa ga ya	2026-05-13 01:47:00+00	2026-05-29 04:34:35.414356+00	waext:ac0c8a3307b77706f3fb696c7b1c7dcc5ebb885b3f972eb27b1fdd71a9bf2cc6
97d59f87-18cc-4d96-8d72-64d81168f03d	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Itubkalo foto lu yg di berkas sidang gak sesuai baru dipake foto baru	2026-05-13 01:47:01+00	2026-05-29 04:34:35.41501+00	waext:be0795bd9ea02f7533e204a7e2c6fbb2834431b9843dc4b83ee27c41d5c7f51b
d7155712-4489-4ff3-b20c-c83d5f815a8c	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	tur	2026-05-13 01:59:00+00	2026-05-29 04:34:35.415566+00	waext:0b9b2834ac580902531680d1bb4bca6f8ba60aab3154e4130c976c7a5355203f
d1517750-6b37-4012-8625-a8beadaee1b5	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	kalau career center gimana maksudnya?	2026-05-13 01:59:01+00	2026-05-29 04:34:35.416203+00	waext:1fe2cfb4171f97d98f3f12f12a9b5582d673178f33191e8b3060502ac31cdf47
a929841f-c4d2-429b-8429-0dd31e88c066	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Photo\nIyaa ssan ini lu print	2026-05-13 02:03:00+00	2026-05-29 04:34:35.416852+00	waext:2777b480548d0a337e67cbf24e1b30b2a0c4eaa3c80d513f9636d5bad69c7934
f3d51ead-70d1-4e0c-8e86-22ffbfc8df7e	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	semuanya print ya yg bukti2	2026-05-13 02:03:01+00	2026-05-29 04:34:35.417375+00	waext:8bf8b8ac65e3b61b689b2fc9df2a36c566262ba691c95616c35891ee6a95e6bf
75b920d8-1add-46a0-b2fc-0e06a12e4138	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Atau gak yang gform	2026-05-13 02:03:02+00	2026-05-29 04:34:35.417876+00	waext:a28adda3fd8ed50e18a106304d5c35c7a5bff8bc62eaa013483b74a18563f2b3
cb8355b1-7a93-4806-a312-fb1381317ba7	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Iyaa diprint semua soalnya nnti dicap sama orang sananya	2026-05-13 02:03:03+00	2026-05-29 04:34:35.418334+00	waext:8edf24f124f8b0fbb2e2bebdb8aa294c133c2eb984bda43276a6c497564bda0b
7e6fcf9e-7def-4996-9870-31cc8e407d2d	00b27ccd-7a35-4f49-a42b-cabce1a618d6	Faturrahman Ptra	sales	https://www.instagram.com/reel/DSAIVI-E0ok/?igsh=ZzFsZW9rdDBoODRp	2026-03-13 11:36:00+00	2026-05-29 05:52:25.150403+00	waext:3802db42564fe95a5b6e41ddcd52cc40e3337d2e3191fa7424cea18da27a5b24
b44aa9a9-44fb-4b7f-92ef-74922d4740e8	00b27ccd-7a35-4f49-a42b-cabce1a618d6	Faturrahman Ptra	sales	https://5xbbtdch-3000.asse.devtunnels.ms/	2026-04-06 03:22:00+00	2026-05-29 05:52:25.151811+00	waext:ef8a9c332326231eebb72fb6037158bbc271b5b7cad64ebf08c22e4bca399e84
112ad300-535b-44f7-bc39-6f00c1fb2045	00b27ccd-7a35-4f49-a42b-cabce1a618d6	Faturrahman Ptra	sales	9900011012183023	2026-04-28 07:30:00+00	2026-05-29 05:52:25.152746+00	waext:dba98e22aab99dbc17fffb7cb952b5e22eb9a49231e6535b157d7bf8fdbd01a2
c212057e-c625-43e1-8bfe-69c00732e394	00b27ccd-7a35-4f49-a42b-cabce1a618d6	Faturrahman Ptra	sales	9900011012183023	2026-04-28 07:57:00+00	2026-05-29 05:52:25.153567+00	waext:fa7a8a593b7dc50dc516e8ca2d43de2c72d2d22dcd89500de809e98e2c8bc3d9
1abaebdb-e1b6-4a4f-a2ea-9cce91ec2d4b	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	oalahh okeoke thank you tur	2026-05-13 02:03:04+00	2026-05-29 04:34:35.418855+00	waext:8256dedd265070fdc130350996a57f522af3eea8c54417014bc6313e69da102b
4a070730-4f69-4da2-8b53-7320bdb01b66	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	oiya btw yg bukti pembayaran printnya boleh dijadiin satu ga	2026-05-13 02:03:05+00	2026-05-29 04:34:35.419516+00	waext:1350c7671b34df90f3d0389fdc98c0aed1722e39187ab0829ac0a23e7f84e1c8
2edd85e7-db18-454a-8e57-8e68ed71f9eb	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	atau satu gambar satu hvs?	2026-05-13 02:04:00+00	2026-05-29 04:34:35.420074+00	waext:8bc48652b378a3b66c3b3529bb8caa628186b7647978b51b8d19e2b6e83dff67
0c6d09b8-6679-423e-96f8-088c213c545b	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	oiya btw yg bukti pembayaran printnya boleh dijadiin satu ga\nKayanya sih boleh	2026-05-13 02:04:01+00	2026-05-29 04:34:35.420664+00	waext:5e0bd7935f5d81983ad3acf5314e104b1d74240eff6df4da4b8ea1d9f3db85ac
8d3c58b6-9755-44b9-9a67-cf2d0c01e06a	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Klo gua krmn sih gua pisah	2026-05-13 02:04:02+00	2026-05-29 04:34:35.421135+00	waext:470f0afe8c689179ded5a789a5050404e45e6f944b54ba304d6bcdcade2ced99
d244cd95-2d6e-4093-8fad-e776b5492cdb	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	satu gambar satu hvs ya	2026-05-13 02:04:03+00	2026-05-29 04:34:35.421894+00	waext:079b76f86d6e60bd340363df65a24457c2ea95e94ba8e5e22e5b0aa63ce0219b
f2c53d8d-9d4e-432f-8549-98b0c0ab2c85	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	kemarin lu serahin pas foto atau ngga?	2026-05-13 02:04:04+00	2026-05-29 04:34:35.42254+00	waext:13bca5f5dec1da4219e2236b0642948500a47f5dd54551a0f49796ef215c4dbc
36f5af0a-d640-4cec-963c-9fff416201ba	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Gua ngasih	2026-05-13 02:04:05+00	2026-05-29 04:34:35.423126+00	waext:d6425b318af387743a1c79e823b44d6bc45d9e4d9c1b4b1d19ee017648c5b443
e390ce84-d495-4f25-850c-dd3df9a755fe	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	cuma gak dipake juga	2026-05-13 02:04:06+00	2026-05-29 04:34:35.423705+00	waext:8777e0ca0084ce0927f478fcf66d5776e900b6eedf8e6248bf3bc8a6d1118491
c4457336-3ea6-4616-93ff-215e5e5dfe2e	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	oalahh	2026-05-13 02:05:00+00	2026-05-29 04:34:35.424302+00	waext:b2235f26a98842d80752d56f776618983286691845506812e73065ef5611e052
14604c93-df9f-4972-af66-c9a1b04dcebe	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	yaudah gua coba dulu ga bawa pas foto deh	2026-05-13 02:05:01+00	2026-05-29 04:34:35.42487+00	waext:5174798b6824d955d7133f8827229ba9be362dcd39f641fb3cd4b93a85ab4855
c9e8b33b-0cfc-40ed-9858-5cf5edbccaaa	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	lokasinya yg di hall itu ya tur>	2026-05-13 02:05:02+00	2026-05-29 04:34:35.425458+00	waext:97ab2727696070ad44c8ac99a4b360f73326031135f4c3e8c1c78f33876041a6
1acff654-688d-425d-b668-07284a3ec6b6	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	ada tulisan ijazah di pintu	2026-05-13 02:05:03+00	2026-05-29 04:34:35.42597+00	waext:8a69a08dafd1285543d0d862c69764356859016fe7674f6e7a8b47f27b0a6194
07ffdc77-4e44-4f8a-a06d-a4b8aea1dac4	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Samping gedung 4	2026-05-13 02:06:00+00	2026-05-29 04:34:35.426552+00	waext:2e9b7a7b3cf68f4b8103879e98922c65428ee67d4aac73724214955ab966341f
457569b9-2507-4ba3-a0bb-f7b13f3f0b96	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	gua ga apal pula gedung berapa2nya	2026-05-13 02:06:01+00	2026-05-29 04:34:35.427155+00	waext:a06fe76c07d3fab826bb8cb305ced1ae653738b0579ad4daa8b7c3b927d3355f
eba802ff-d8d6-4a7c-b86e-1eb6242357ae	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	pokoknya bank dki nih, belok kiri terus kanan lurus terus ya?	2026-05-13 02:06:02+00	2026-05-29 04:34:35.427713+00	waext:87597a96bce33360ea5334ddf6f2d2375eca99ad1fcb2a591710ebcbe082e2d1
8d6bf855-71f7-47e0-a567-654d3bb0a693	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Yaa kan tangga tengah tuh lu turun lurus aja nnti ruangannya dikanan	2026-05-13 02:06:03+00	2026-05-29 04:34:35.428262+00	waext:67ce73312473c8326f4a498bc9fec11e0765e6ae9024b1eddd0eb6f3289d250e
15eaa6fd-26c8-4e73-a266-d12bd5835e92	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	pokoknya bank dki nih, belok kiri terus kanan lurus terus ya?\nIya ituu	2026-05-13 02:06:04+00	2026-05-29 04:34:35.428816+00	waext:644273c73ef9fc3f09b9dc2c30b52868ed92d26a9b4a948f40e8c33266e5c69e
0412fad7-73a0-4149-89bf-f0f714d59a38	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	okay thank you tur	2026-05-13 02:07:00+00	2026-05-29 04:34:35.429329+00	waext:9330c7f58d8c343f74ce4548bda29376b70f7712a5b74a2a351cfd548392bffe
d897e083-3464-47f7-bf1f-0814e532e7fb	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	dipanggilnya lama ga lu?	2026-05-13 03:24:00+00	2026-05-29 04:34:35.429882+00	waext:2a641076cff1349d5371ff4b6edbae14cae0ba4c69978ddf3ca23a7d9e58382e
1de00824-11fd-4cfd-bf82-9980611253bf	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Gak nyampe 5 menit pas itu gua	2026-05-13 03:24:01+00	2026-05-29 04:34:35.430358+00	waext:186fdc600bd0391d63bced3738e820e27ba013593f292ac3e476fd49d8d8fafe
670053db-4482-43f3-b860-3495314200d4	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	rame?	2026-05-13 03:24:02+00	2026-05-29 04:34:35.430802+00	waext:d04f05ce6bb5e55211478dd0bdf99dee57d1cdcf903b8e26b4fe7f6888b24fea
7ef126df-9dac-479e-aad0-0ef81087c239	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	gua sampe udh ada 10 org wl	2026-05-13 03:24:03+00	2026-05-29 04:34:35.431289+00	waext:4e5e3ed00751298252104e55752d5b574563fee4bbf3059107f561164b9fec55
e7c9b4bf-18aa-40d6-ba22-882ef63d7153	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Gak begitu rame	2026-05-13 03:24:04+00	2026-05-29 04:34:35.431917+00	waext:12cc65337b2195cf512b6b1ecf728070eebbcc032c1204909ec75c1501046261
da3402e4-5f59-4b28-ab01-eb25fc303f31	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	gua sampe udh ada 10 org wl\nCepet itu	2026-05-13 03:24:05+00	2026-05-29 04:34:35.432513+00	waext:617817e63906cd178bd35ccf72796d76582042b303c32011855b2e798cc4e9cf
7b283920-3ba3-4fe3-92ef-553ec506c8e2	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	Faturrahman Ptra	sales	Dipanggilnya juga ngacak	2026-05-13 03:25:00+00	2026-05-29 04:34:35.433098+00	waext:26c022485ba5a830b6629994700cf6d346834d50a4bd24057723324b3f51b0d2
e1d53f78-10c9-4224-987d-216de53679ba	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	defa UG	customer	ohh ga urutan yaa	2026-05-13 03:30:00+00	2026-05-29 04:34:35.43373+00	waext:021ca0b3846b5814b722bf8be3e17297b4aa82bca461784dc889ae8b1b6cd457
ee6a831d-4bd2-4abb-950b-e7781e187d7e	00b27ccd-7a35-4f49-a42b-cabce1a618d6	Faturrahman Ptra	sales	Assalamualaikum Bu, saya ingin izin tidak masuk kerja besok karna harus ngambil undangan untuk wisuda sekaligus saya mau izin untuk Senin, 11 Mei saya harus wisuda. Terima kasih.	2026-05-05 06:45:00+00	2026-05-29 05:52:25.154336+00	waext:56b602cfe2aff06b6e4cac20a2136a1ef5c7fd5600817c0f0399fe3697cd8e20
118e45e9-d6ef-4902-a339-427a28762f99	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Kresno NM23	customer	Okee siap turr	2026-05-29 06:32:40.805+00	2026-05-29 06:32:17.755734+00	waext:4f45a81d1614ef802670a345748f168160d51097e38f1f9528babbea4f903c1d
5da7cbd6-cab0-40a6-b288-0cf8c70b28e6	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Gjdi kalo gantiin mah	2026-05-01 12:32:00+00	2026-05-29 06:35:46.683934+00	waext:cc0564376ca785c8978a18264aa60392142fc9290f96ec5024a1392e31dc4a2d
53167a46-66ab-400d-a387-d63255889606	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	ahk	2026-05-01 12:35:00+00	2026-05-29 06:35:46.684776+00	waext:785c98002907062708e01a1ea52031617422cb495f53224241ba7bfdb88787a7
00bde398-f83d-4812-ad16-cf3805b022c1	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Tur	2026-05-01 14:47:00+00	2026-05-29 06:35:46.685371+00	waext:e95482a0f7cc322026733b0b792b7eb7e27ccac5c03c3e4fd498f91c4138c055
09f95848-8f8d-4d71-aeb1-2b4380356352	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Hah	2026-05-01 15:23:00+00	2026-05-29 06:35:46.686272+00	waext:f939f1446a3fbbbaa6342f820dbd2990e09bded1e6fd1c183a159f5d92a2860d
609d1147-232c-4de6-8366-96dfa65af521	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	main g tur	2026-05-01 15:23:01+00	2026-05-29 06:35:46.686978+00	waext:41f3205fc7585f8198c0262742b65a4295855004b01b59ee62297eea1786fa6e
6095f799-ea4f-4f9b-b600-6e74bb43f3f3	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	KOK NGANTUK	2026-05-01 15:25:00+00	2026-05-29 06:35:46.687697+00	waext:4809f82d9e22e3c16bb5aa69e38fe42184ffb9493dd98909e5f19fe3c3a0234d
95423023-05dd-4a2e-b2fd-d6a415a23407	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	WOI	2026-05-01 15:25:01+00	2026-05-29 06:35:46.688664+00	waext:00c5d94ce21febd5ec93fd55e4b7dce7ec4e98993cb22e6a4ae06306b18a3145
85cec7b6-9b21-4741-8676-2c51a1ac5419	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	LOGIN	2026-05-01 15:25:02+00	2026-05-29 06:35:46.689628+00	waext:f8133303d720dc382989500f8ef5248422d747e7cfae67346de18ffaf8ceda1e
68dc6580-08be-4c02-b74e-5a525aad779c	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Pin'	2026-05-08 03:34:00+00	2026-05-29 06:35:46.690253+00	waext:66096f277eb5546ed166f9c830aa3eed4c671a2195158af10714dd8c8ef246e8
a9bbe5f3-6df3-442a-9728-16c8cdf9c188	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Knapa rur	2026-05-08 05:11:00+00	2026-05-29 06:35:46.690832+00	waext:be330bc9fbc69323e4c763dbe77666c59a088aa7d249bc6bbe11954a7c29fb62
dabc1142-dc2b-42f6-be8c-121180f523c9	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Alhamdulillah jelek	2026-05-08 05:38:00+00	2026-05-29 06:35:46.691311+00	waext:90ec8213f626e49f848d2d573e2d9544bbe037a1571d98c43de23520f9064008
2e0f12ff-d18e-4dd6-95c5-341d761858f3	00b27ccd-7a35-4f49-a42b-cabce1a618d6	Faturrahman Ptra	sales	https://fd5k9nkn-3000.asse.devtunnels.ms/	2026-05-23 08:05:00+00	2026-05-29 05:52:27.65283+00	waext:edcc62bff517e632d037bce04dc8fb0f2d887155bb1c04b6d5c82d1c74f10165
16323b22-03b6-4125-ae68-231d033310ab	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Arya NM23	customer	Wokeee	2026-05-29 06:32:36.805+00	2026-05-29 06:32:17.753579+00	waext:931c48d7820f2eb78e55afba366e4a2d4eb4a565c1aa5245d961573d1f64b31f
2d776edd-7379-43ce-8474-a43b890a7535	93619231-dc0a-4756-9df3-2b824355d3f1	+62 823-1038-4866	customer	Hari ini yg masuk siapa ges?	2026-05-29 06:32:41.805+00	2026-05-29 06:32:17.756184+00	waext:f06cc751ca60d180b839faca5dc14b89b3a4392e184c29a91d5a0568217ebf6a
5455cd73-5f7d-45b4-b505-e59e27e26add	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Kresno NM23	customer	Oke oke siap gol	2026-05-29 06:32:34.805+00	2026-05-29 06:32:17.752473+00	waext:07009e6c0671e0804d05f7c64f562b62b02a415801943ce4a7b23c279d8ad0a9
8cff5122-800d-4b31-93fe-fce453c4b270	93619231-dc0a-4756-9df3-2b824355d3f1	+62 823-1038-4866	customer	Oke oke siapp gol	2026-05-29 06:32:43.805+00	2026-05-29 06:32:17.757046+00	waext:1dc7896d84f805b7ca745dfb1eb69765400073d0eb03636d0df6299fc1088782
94f56495-45b2-4de8-8343-c429d12b2392	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Kresno NM23	customer	@Faturrahman Ptra	2026-05-29 06:32:38.805+00	2026-05-29 06:32:17.754764+00	waext:b4ec4201f3e3ed22add8e0940418d9f82bfb2630315ff4a0195bdbe335760fcc
b0dd1775-4301-46bd-ad1d-8fd8a6e3d267	93619231-dc0a-4756-9df3-2b824355d3f1	IT DEV Newsmaker23	customer	Leo Core Technology	2026-05-29 06:32:27.805+00	2026-05-29 06:32:17.746659+00	waext:0f89d7145d4e5fe14a6bb23e34ce5720f5072abcfbdaace79ea7ba954f86cb51
b32c3b05-c7d9-4401-b4d3-2a41735aef85	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Kresno NM23	customer	Oke tur gws ya tur	2026-05-29 06:32:37.805+00	2026-05-29 06:32:17.754201+00	waext:18a634b28a6b751d8d3ded3c16d7c8d29f6c3c0f1dbcb14c5c0aaf6337a54f09
b80f160c-9327-405f-b00d-8ca8c43c815f	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Arya NM23	customer	Gua sama fatur	2026-05-29 06:32:42.805+00	2026-05-29 06:32:17.756599+00	waext:23fa6017d212e2a37c5dafca1579459b343fd50732c49e001fb8653cac067d41
d96804a4-2ec9-4b5a-b5d7-6469f0b7af71	93619231-dc0a-4756-9df3-2b824355d3f1	Faturrahman Ptra	sales	Hari ini gua izin yaa, lagi deman tinggi	2026-05-29 06:32:35.805+00	2026-05-29 06:32:17.753047+00	waext:5175306677ea10dc9237a1403be29f5794847607451364f1be5cc25490effc80
e237cd71-9639-43e8-979f-c17ec3924563	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Arya NM23	customer	Jadi pindah ga?\nKaga	2026-05-29 06:32:32.805+00	2026-05-29 06:32:17.751271+00	waext:2b3e09ef9f97fbcf39270b262452a8790433591d021a66cb9c106c37acfedf68
e8d3f94c-d0b0-4cc4-94c9-c7338b55e7ce	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Kresno NM23	customer	Gimana gess aman kah?	2026-05-29 06:32:29.805+00	2026-05-29 06:32:17.748611+00	waext:236c9df920f9aeb2a7f50ce01a0610752abd24cadf44668fc4960d8a86d8067a
f6a4d15c-6624-4607-8013-ea723ac9ad9f	93619231-dc0a-4756-9df3-2b824355d3f1	Mas Kresno NM23	customer	https://docs.google.com/spreadsheets/d/1XLNVghyP7Aq4xa0idhRhzkPxWn9FfZNKfXzUJ6E3iNw/edit?usp=sharing	2026-05-29 06:32:26.805+00	2026-05-29 06:32:17.745886+00	waext:659d5c23a61f45db3c81a1299802fd045dbe89e2801137a9c466e70ae1acb243
fe5cf0ea-d656-4986-86c2-297c1aec1e0d	93619231-dc0a-4756-9df3-2b824355d3f1	Faturrahman Ptra	sales	Udh sembuh belum tur? @Faturrahman Ptra\nUdah masuk ini	2026-05-29 06:32:39.805+00	2026-05-29 06:32:17.755253+00	waext:ca51d0347d48b1549772707ecd82d7e6af0e8fc1f02bca54be9bf5bc99860b64
ba5f2af6-abfa-435c-ae97-0d6e03b17205	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	bagus tur	2026-05-08 05:44:00+00	2026-05-29 06:35:46.691925+00	waext:f470f3fa9ede0b88043fe6d58b03a1a03e3f46afbdc2c457a56156b8bfdef9c8
bb616acd-5f49-4b86-8e33-fbb9ad0af5ee	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Piso	2026-05-08 05:44:01+00	2026-05-29 06:35:46.692469+00	waext:6bc215eebae827f7df5b71021e19d55917a71bed9852e0f312d2c3a6d3044a54
e72ced61-ef1a-4efa-b2ac-c571e254ff29	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	G	2026-05-08 06:18:00+00	2026-05-29 06:35:46.693036+00	waext:e1722ec07eafc66539c65e751a1146e3ba1daa096211b8d9cc303eb1a27bb076
e3aa9b91-79b1-44d1-9df7-e531db4ac4dc	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Valo gak	2026-05-09 03:57:00+00	2026-05-29 06:35:46.693648+00	waext:0451de11c1baf24f7b0533dc7b27f8d7aa880927aa45409f8edf20a10c790f51
cdbcfca5-0d15-4bac-a9c8-ac1816dacae7	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	updet	2026-05-09 04:12:00+00	2026-05-29 06:35:46.694189+00	waext:6972ff20d66cfa352576a12ff571873de1861c4104dab6b2c23e90c666168c33
047db700-1c88-4809-89dd-d011ac78800f	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	lu mau duo emang?	2026-05-09 04:21:00+00	2026-05-29 06:35:46.694664+00	waext:3d1b0c1a22bfe1bf8ced053a315d8c99624c505c16b656f8163d233cb95fa4a3
04316817-2415-428c-a6a8-0b84086393b8	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Ajak depa coba	2026-05-09 04:23:00+00	2026-05-29 06:35:46.695147+00	waext:4544ffcfae6d6705e210aff34ae8bfc7eeb2fdf658a61697815bca5a7907ff6d
28f35969-5c2d-4356-bbe5-9ff70d3fc846	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	ayo partyannya tebe	2026-05-09 04:23:01+00	2026-05-29 06:35:46.69581+00	waext:1a5d746c2d7c8b7c05f0b0a65e458aa3efaf3bb53576e11bb4d9d47a73467c03
ce387819-9e45-4389-9977-3cb7237f2b45	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Full gak?	2026-05-09 04:25:00+00	2026-05-29 06:35:46.696374+00	waext:59bf22799f9b4ed8a96b8dfb98983eb2a6076dcd19c7a966cf03f5200c511db6
04f63f63-1939-4cca-97f9-6d6d407ca250	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	-1	2026-05-09 04:27:00+00	2026-05-29 06:35:46.696938+00	waext:1f990f3eb8f1177d6fd7ef8c4ae5c7f634f67e4f9c6fac09f217b926ac765289
14b3ed12-1833-40a6-a646-742a8ef56735	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	iya tebe g ikut	2026-05-09 04:27:01+00	2026-05-29 06:35:46.697534+00	waext:cf5cda41bb290b97982b5a0cf8f2855d6a503db392f21274dc421255d60e4716
27624b9e-7f75-409a-a398-8a1b24938d49	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	itu bebek g main palo	2026-05-09 04:28:00+00	2026-05-29 06:35:46.698149+00	waext:0d5cf2cf729dad47333cb38c9f7d53b212f58b9b8dc0db48da33ee1449ff7428
77809fcd-26ef-44ac-bd98-a91bcc2a22d6	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	-1 sama dapa kali	2026-05-09 04:28:01+00	2026-05-29 06:35:46.698747+00	waext:0cf218c60d49643e98d2fcb1239cdd943acbb1f80904e5d676ac8d8ddcc66b3b
53e64166-b537-4efb-824a-1061a3a82a82	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Bebas	2026-05-09 04:28:02+00	2026-05-29 06:35:46.699289+00	waext:4a94f557d196db6683a38402dbe9cacb2d844e77817cb2b48846a9740897cc9b
e35b79f9-31ff-44a2-aab7-f6d3b102623c	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	ajaak	2026-05-09 04:28:03+00	2026-05-29 06:35:46.699857+00	waext:487b1735c6cb9be08817999b969fcea3626fdb3b84f89d1da03ccf553d328fe6
ca282d5c-1355-4196-ada4-74864150cc6f	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Valo	2026-05-10 06:02:00+00	2026-05-29 06:35:46.700434+00	waext:3e3e575bc6df55f22750e0a4bb5c178c5c5b8fc1df6c7445e83cf59c4c050d49
00786eea-6111-45a6-8d7e-ffa0c0bfe007	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Ok	2026-05-10 08:14:00+00	2026-05-29 06:35:46.700975+00	waext:1a568a9a3acd7e99d15c9477b37fa6fb86830cfb4ba0d2d1f144c1e4fd840160
ae3b6af7-8337-4e10-9435-66596ca0c4cc	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Pin	2026-05-14 11:32:00+00	2026-05-29 06:35:46.70156+00	waext:e2413893226d0d520be19b7167f15a6fd3713785cca15e858c13c5b47781a63e
81c58b8a-8090-458a-a3da-7da25d5b176d	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	ya	2026-05-14 11:38:00+00	2026-05-29 06:35:46.702095+00	waext:a1adc60ce5c44aa685e7bd3d2a256e1106e1112bc6f2543c1399af4115377f24
09ee294a-187c-46e6-8740-addff59b2ac1	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Gjdi maleman aja	2026-05-14 11:38:01+00	2026-05-29 06:35:46.702632+00	waext:dc1a773e7faee7375a15d96ebdc3bca8f2251b972ec6fcb0858e38c9bf41ff14
19ed5dbd-7c7d-4ce1-a9c1-b1eaabd7318a	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Ok	2026-05-14 11:38:02+00	2026-05-29 06:35:46.703186+00	waext:fc5d7166235d97d5a69a17403572eac2a36da0f0ea2fda464a28d0658b475bea
b80abea8-14c6-472d-9320-13f5786a3d1f	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Knp tur emang	2026-05-14 12:17:00+00	2026-05-29 06:35:46.703638+00	waext:168eeba9032dca04a4ab0fafe2c1ef95c31ae18cbb716b122affa333457a61ff
c39c3308-cba0-4157-a1f4-b71f6445fe9e	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Valo	2026-05-15 11:47:00+00	2026-05-29 06:35:46.70421+00	waext:7e21e17342b8eedd9e53d864b2970283944881edf9cf83ea2f1acc085b23a8a0
4a8a3f56-af33-441d-bbc7-314c4a345ae2	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Skarang?	2026-05-15 11:58:00+00	2026-05-29 06:35:46.704989+00	waext:ad94fc1eed43ddc854bd4a1dc4ebd16199675b3ca08ef65386c5d88c71f31ba3
529d81ed-36fb-47a8-b722-c747e7294f00	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Bntr mau beli bubur dlu	2026-05-15 11:58:01+00	2026-05-29 06:35:46.705729+00	waext:3c6e614a481b0f30f07375bf0a76929c9a14b1f0b9325407768710a9ce0a26db
6b07f663-61ed-4bfc-8f84-81df26773fa0	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Main??	2026-05-15 12:22:00+00	2026-05-29 06:35:46.70669+00	waext:8a7c5b7123574f6385fe61449096eacb737de351fe91f83fb2bf594940201411
7692611f-552b-484f-baf2-fa8d03439daf	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Ok	2026-05-15 12:24:00+00	2026-05-29 06:35:46.707309+00	waext:b6e6e433f39f48921b546e07b54877114abcca9f1401b185f736f4fc5ef71dbd
78882dd3-eb15-4424-a0c8-c36f833dc163	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	trio ma tebe?	2026-05-15 13:11:00+00	2026-05-29 06:35:46.707954+00	waext:2390e2698f7f1ce030f9243bb64647cf2b6e65b63bb8682f5295af123d2923bc
ee5a6a6c-7ba4-420b-b8b2-a0816c84c695	67343055-cd9f-4943-abcd-0016838210cd	CIMB Niaga	customer	Top Up e-Wallet di OCTO Bisa Dapat Cashback!\ncashback Rp5.000\nKeuntungannya:\nRp5.000\nOCTO\nKode Promo:\nPeriode:\ncimb.id/promo/topup0426	2026-05-29 05:54:14.41+00	2026-05-29 05:52:57.681614+00	waext:48ae27b06808ecd93f708fa9bc815011a0e3c5a7d4c18f1e3e519acdd386e261
234f7b38-d9cb-497a-aa95-3f8fc69b2b11	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 857-1400-3197	customer	@~Faisal Rahman	2026-05-25 02:52:00+00	2026-05-29 06:32:57.424216+00	waext:6c5e57147b2b5844ac36fc5f2b9219a02204745c53614d7f1a38ef7e5cf72ae2
3ee136a0-f6a8-4ab5-b360-1c63a681f95b	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	IT DEVELOPMENT	customer	Faisal Rahman	2026-05-29 06:32:58.394+00	2026-05-29 06:32:57.425615+00	waext:7a1fcaab670daff9ba24e3df8c87386fa138cc9f9ab1953eba70f174144bb412
2bfa222e-31cb-4ac8-996f-7d59888a32ab	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 857-1400-3197	customer	@~πü¬πéôπüá	2026-05-29 06:32:59.394+00	2026-05-29 06:32:57.42678+00	waext:ebc0e6fc60f53e368784e00fa0a573edf8dacc9d27aa5150826fa22520a4af4f
de3b248f-ecf2-4baf-b1e0-d3e1d5c54c69	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	pagi mas @~Faisal Rahman api bank, masih sama belum bisa diakses\n@~Beatdonk	2026-05-29 06:33:00.394+00	2026-05-29 06:32:57.428011+00	waext:3ff789eb8185d6b005f7ad9c53d828424aac8657a413e8578f329350a8ec8b03
45466f84-6c69-46d2-b48d-2d3d1dbf7e2f	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	Kalau kemaren masalah di domainnya soalnya	2026-05-29 06:33:01.394+00	2026-05-29 06:32:57.428957+00	waext:c12362bfb86a2a1657179df2b6131ac3566ae0c36aaea70e23ba4dff38510846
b27e4627-88a9-4bc1-93fb-2174780a858c	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 812-8311-1160	customer	bank-api.solidgold.co.id	2026-05-29 06:33:02.394+00	2026-05-29 06:32:57.430129+00	waext:cd5f8e2d05cb993524b6e390022f946336572cfbac53883471e0fd8d6cc344c4
8494d59e-821e-4e0d-a96d-28e21839a3f3	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	dr sisi jaringan,status ping dari isi ke bank-api.solidgold.co.id replay atau rto? nslookup status gmn? klo replay dan nslookup nyampai,shrusnya aman dr sisi jaringan.\n@~Faisal Rahman	2026-05-29 06:33:03.394+00	2026-05-29 06:32:57.432645+00	waext:a06c243a50e2bf768759650b87a655a10e79bfaabd5c4efdb1765a45a81b0ee7
62647dec-f812-4dc3-b064-c75492b30958	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 857-1400-3197	customer	@~Faisal Rahman, coba di ping nih dr jaringan kantor\nini di ping & curl dari kantor	2026-05-29 06:33:04.394+00	2026-05-29 06:32:57.435336+00	waext:0a22cd82fce09d4cc9c0f1314caca7c7d50700a7750e4a249832adc54e7f8947
b4ff779b-11e8-41f9-8b3c-c9baf554039c	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	ini di ping & curl dari kantor\nKalo bisa di ping berarti udh bisa diakses	2026-05-29 06:33:05.394+00	2026-05-29 06:32:57.437726+00	waext:7f62f20c4b5519a21b699cb60e0a2b0a5aff9a0876594658a5b96a2354286c57
c27b5bf1-7fe7-4851-8320-ebbd3a493568	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	bank-api.rifan-financindo-berjangka.co.id	2026-05-29 06:33:06.394+00	2026-05-29 06:32:57.439259+00	waext:4b6ecdcb1243f9d9618af02258c1d14efac555d23560030422695c0266d029be
39291b3c-5c24-4e50-be32-f855575acea8	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	ini di ping & curl dari kantor\nIni ping dapet ip private, apa ini pake vpn kah? harus nya dapet ip publik..	2026-05-29 06:33:07.394+00	2026-05-29 06:32:57.440653+00	waext:41569af14e3efc75a10084c3cb79b4d19962fa8a119084c8251ff0a7c345b92b
ba7143fe-2677-4b1f-9d28-bb874227925c	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 857-1400-3197	customer	Ini ping dapet ip private, apa ini pake vpn kah? harus nya dapet ip publik..\nlalu saya harus report ke tim ISInya bagaimana ya mas?	2026-05-29 06:33:08.394+00	2026-05-29 06:32:57.442078+00	waext:fd6fcd28ae317d2cc2064a07c02491157026031202d8d7b1c6c477eaa1161ef2
4cf217a4-3d80-432f-bd1e-d599e8a3b4b6	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	lalu saya harus report ke tim ISInya bagaimana ya mas?\nbank-api.solidgold.co.id	2026-05-29 06:33:09.394+00	2026-05-29 06:32:57.443464+00	waext:08d3f34340166a895b87b9390938a09c8eaf8c5a4b99cfaa19c126bc4f3bab9f
c4e6977d-8113-477c-b0b7-7828681fb69d	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	https://bank-api.solidgold.co.id	2026-05-29 06:33:10.394+00	2026-05-29 06:32:57.444513+00	waext:adcaa28ebc4b2f0d8c7926099e59740f71480b83d5e2bd10e5e0efbaa969ddcc
f2b4d277-99ac-4ff7-bac5-84b96c1ebaa0	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 857-1400-3197	customer	masih problem di ssl mas	2026-05-29 06:33:11.394+00	2026-05-29 06:32:57.445466+00	waext:d17817afb1690a18fdeff03cfae48fbb908cf60db874fb2d41dd1be6054e42ff
61219d62-a826-4338-8e55-35307cbcb355	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 857-1400-3197	customer	sama mau tanya lagi mas, untuk ke depannya topup di MM, apakah akan menggunakan api bank tersebut ? setau saya api ini digunakan untuk regular proTrader	2026-05-29 06:33:12.394+00	2026-05-29 06:32:57.446547+00	waext:139db53bb6543240e1dd8b3bc5eaae06f448cffab053e320e31cec15874f3bbb
e2de83b1-2f7c-4c9f-9395-545c3d0b2df7	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 857-1400-3197	customer	sama mau tanya lagi mas, untuk ke depannya topup di MM, apakah akan menggunakan api bank tersebut ? setau saya api ini digunakan untuk regular proTrader\nini pertanyaan dari ISI	2026-05-29 06:33:13.394+00	2026-05-29 06:32:57.447638+00	waext:701982ea380f773ee8478f40409fcfc561a41a2efe2dcaada155eb3a9e9672b4
70aed127-c90b-4895-be27-28111542edf1	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	masih problem di ssl mas\nCoba PT lain bisa ga?	2026-05-29 06:33:14.394+00	2026-05-29 06:32:57.44905+00	waext:436cf898668a6542a2e96644ca4ee4771cd6ca24ba1ce0a9916ac9fd036d97ba
707d72b4-1836-4727-9993-b8cf340ea033	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	sama mau tanya lagi mas, untuk ke depannya topup di MM, apakah akan menggunakan api bank tersebut ? setau saya api ini digunakan untuk regular proTrader\nAPI bank cuma itu	2026-05-29 06:33:15.394+00	2026-05-29 06:32:57.450088+00	waext:db7ed91e004e22b3f8cd7ec0914fe5e6fa59ab905a557990f61b736ea3a0722a
b6369bc7-12ce-41ae-b92e-ba424d1775bb	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	@~Beatdonk\n@~Faisal Rahman\nbank-api.solidgold.co.id	2026-05-29 06:33:16.394+00	2026-05-29 06:32:57.450865+00	waext:d855a0f040258b28490ba5f944b85632796b6fe927e53840afa7fbf06cd38a10
705a373d-c91c-4e8f-b6bd-9df97c61b8e7	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 818-0770-3771	customer	@~Beatdonk\n103.118.177.243\n172.26.1.132	2026-05-29 06:33:17.394+00	2026-05-29 06:32:57.451991+00	waext:173b6d20dd611b5f15d53fd4ad9b75055026f891bbb089e2ceebb6ed880d729b
5da34a62-6efe-4813-8006-dd48c412e6f3	338c6c5d-108e-4674-9b34-cb25ec5c3ca4	+62 812-8311-1160	customer	Beatdonk	2026-05-29 06:33:18.394+00	2026-05-29 06:32:57.453061+00	waext:1349dbbeba682082ab77c08e321f2bc812d66470fc1aaf314b42bf3ff5260134
89115b94-be3e-4e2f-8c82-d7b8abce2247	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Pin	2026-05-18 13:14:00+00	2026-05-29 06:35:46.708634+00	waext:72e884b5aa2aaac73214e278e5ca3891a50b9c9fe8a8c7a1863e33659deb7434
238ebf04-b8c2-4bf5-850c-c1aed31402ca	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Beli outlast trial yuk	2026-05-18 13:14:01+00	2026-05-29 06:35:46.709255+00	waext:1ef27f0103b16e06de4a8a7dfd2ad43569ca33729821fe6f4f3f8b7307e4299e
51fe3b56-8aad-4f3f-a22e-4a2ec44bd579	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Itu game ala	2026-05-18 15:59:00+00	2026-05-29 06:35:46.709852+00	waext:b6a53404e716bd24bb6b4be2aa25038b97ca371bbcaae3dcb48a8918106b857b
229ca956-87b1-40f6-bfdf-89eeaf9b4648	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Apa	2026-05-18 15:59:01+00	2026-05-29 06:35:46.710438+00	waext:7da8581c36bd7845bb95398a7e5cb41ecd1c53b95253fce53a0a1333c8860c3b
15cc271f-d74f-4f7b-bb1d-89f737c356fe	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Tur	2026-05-27 05:37:00+00	2026-05-29 06:35:46.711039+00	waext:f62bbaabb4e8bdab6d7431fc0338a4dc9c7faeea5bd3c20fce6ef95107643a0d
ce00d4e1-b1bb-44a6-a5a4-387776dcde9c	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Trio g ma dapa	2026-05-27 05:37:01+00	2026-05-29 06:35:46.711688+00	waext:aa330f422f1b207b4de19a3602ffeddf26bb8357e7376fe5d5ce8e04848be571
fa17a37c-4c49-4133-8477-96eb5a53092e	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Gua lgi ngurus kucing gua abis kelindes kendaraan	2026-05-27 05:47:00+00	2026-05-29 06:35:46.712276+00	waext:14615a3d5abe8fa9534defed393b5b75282e612dd8fa27f20eaaffe1978f4bda
366d26ea-1258-48d2-82d6-dd6703908e93	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	Nooooooooooooo	2026-05-27 05:47:01+00	2026-05-29 06:35:46.71289+00	waext:64bc45bd7d651f1f291acfe19908c743f8a7fc6e046fe047784a8c6ef2a9128b
ae088eb7-e062-426d-9929-3d80f41833b7	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	tur	2026-05-27 11:25:00+00	2026-05-29 06:35:46.713527+00	waext:a45fdc2bc0bd8c5b622f40413feb90f7bc00abcf86aa36aa7fb89e7b5f974ebb
689c248a-780f-4683-b933-b7d7267391eb	59f1578d-d6a6-47a6-9950-541c2659e2f1	Yavin UG	customer	mo main?	2026-05-27 11:25:01+00	2026-05-29 06:35:46.714021+00	waext:c410ac0bc62e05e329584954f2141f91b12598faefd7a995cf0de7ad25dd8d3a
a2694673-f8cb-437f-b723-6bb9f4020f0f	fe84cb9f-5247-4e0a-8921-8e51b911c774	extension_user	sales	Pagi sayang! Kalau kamu tertarik soal investasi atau trading yang terstruktur dan resmi, aku siap bantu jelasin. Jangan khawatir, kita jalankan dengan sistem yang jelas dan pengelolaan risiko yang matang ya.	2026-06-02 02:49:50.322506+00	2026-06-02 02:49:50.330511+00	\N
540cfc35-937a-4dde-8364-677346edcdd6	a1f51fee-463c-4356-b702-9f6555241c18	+62 821-7775-7812	customer	https://vt.tiktok.com/ZSxvTwNm8/	2026-06-01 10:34:00+00	2026-06-02 02:50:07.893701+00	waext:095823e56a718e0ca764a65c513d96d3d32164f3aa4fe827549b4ee934ad8b33
7280fe26-798d-4484-8492-2daef1d2568c	a1f51fee-463c-4356-b702-9f6555241c18	+62 821-7775-7812	customer	Dibantu kawan	2026-06-01 10:34:01+00	2026-06-02 02:50:07.894639+00	waext:c011d12338a8df9d7b15914d20bbefc78a3e0c0dd8e7e0120f911477047b0254
ea070432-6d89-4ea2-934b-9171217f57ae	a1f51fee-463c-4356-b702-9f6555241c18	Pa Raha NM23	customer	@Kak Ayu NM23\n@+62 859-3922-4662	2026-06-01 13:56:00+00	2026-06-02 02:50:07.895462+00	waext:2da06dea80d05bf18d612f99307c053f6dfe8e1be43eb1c3525d819a7c8e4cc9
0f3c4039-47d3-40ac-98de-8830018f9cac	a1f51fee-463c-4356-b702-9f6555241c18	Pa Raha NM23	customer	@Bang Yudis NM23 John	2026-06-01 13:57:00+00	2026-06-02 02:50:07.896202+00	waext:f33b42065bbe9f756657611c6408e4b294f70120b46465fa86ce959d4480689f
df9d65a5-ee08-48d6-aecb-1442a4bed34f	a1f51fee-463c-4356-b702-9f6555241c18	+62 859-3922-4662	customer	@Kak Ayu NM23 @+62 859-3922-4662 nah kan ada 4450 heeheh buy ahhhh	2026-06-01 14:01:00+00	2026-06-02 02:50:07.89688+00	waext:35a47251b0c78043ac4deb72891a9a7163775db0ec984f38938dfb1d74d0d11a
31548a17-0efa-4ca4-a15d-efc7e5f4b3b4	a1f51fee-463c-4356-b702-9f6555241c18	Bang Yudis NM23 John	customer	@Bang Yudis NM23 John ada kan tuh 4450 wkwkwkw\nLah iya wkwkwkwkw	2026-06-01 14:02:00+00	2026-06-02 02:50:07.897562+00	waext:9fbfe4e09f6ab6f6e062316f3b1fb2fa3138a16750e9c8793738dff0578612be
2d310d91-5df3-457a-a414-52a6e5ae4c2b	a1f51fee-463c-4356-b702-9f6555241c18	Pa Raha NM23	customer	Wkwkwkwkwk	2026-06-01 14:02:01+00	2026-06-02 02:50:07.898602+00	waext:8a66a26b22aa388334b0bb64c12c879955eda508ae6b291ebe67c1af4eecab2f
d0ef58e4-8306-4585-b8bb-f21bd75026aa	a1f51fee-463c-4356-b702-9f6555241c18	Bang Yudis NM23 John	customer	Td sore maaih 4500 up	2026-06-01 14:02:02+00	2026-06-02 02:50:07.899436+00	waext:61838dd8a7a4545f87f67e1f0dea849719cda4e87594c4fa26eee15309b2b987
292987cc-da1a-4f60-b192-1b370041b747	a1f51fee-463c-4356-b702-9f6555241c18	Pa Raha NM23	customer	Analisa spiritual	2026-06-01 14:02:03+00	2026-06-02 02:50:07.900848+00	waext:c5435053b12a2aa756838dac6ae018df89c1d4adcef34d599ff0526063ba8468
8c45f578-09bd-44a0-8c6a-b529df9964c6	a1f51fee-463c-4356-b702-9f6555241c18	Pa Raha NM23	customer	Buy aja tahanan 500 point dijamin gak rugi, insyaallah lancar berkah manfaat	2026-06-01 14:03:00+00	2026-06-02 02:50:07.90178+00	waext:d2e5ef47cc21d7468411cc57e0111731f915609ba409a7d87a7f7edf52ff89bc
71e68261-1f90-43f5-b22b-fe379c8ff174	a1f51fee-463c-4356-b702-9f6555241c18	Bang Yudis NM23 John	customer	Amiin	2026-06-01 14:03:01+00	2026-06-02 02:50:07.902619+00	waext:3b7b1377da0288102ed4b00495feba083b00a68050cac2868f1546c690226527
1d6bbdcc-fa16-412a-bcd2-6b93cf1e5a3c	a1f51fee-463c-4356-b702-9f6555241c18	+62 821-2197-2455	customer	https://vt.tiktok.com/ZSx3aveSU/	2026-06-02 01:22:00+00	2026-06-02 02:50:07.903393+00	waext:06e79c15a7875f46b2bbd2b50ee6e5e9b4222d32d7ff800490947d79ae1d1fa0
d6daf7a0-f9ae-49f2-abc3-ac29baba879f	a1f51fee-463c-4356-b702-9f6555241c18	Ka Dessy NM23	customer	Solid.prime\nhttps://vt.tiktok.com/ZSx3mWdR2/	2026-06-02 01:30:00+00	2026-06-02 02:50:07.904241+00	waext:9595cc47f40f26eb5da47a2139f45f98d163daff4219d5de2c2340aabe0e6a2e
1a52376b-9521-4ea9-b4f1-4c6619e1ae7d	a1f51fee-463c-4356-b702-9f6555241c18	Pa Marlin NM23	customer	Frangki dan Marvi, tolong disiapkan, besok terakhir.tq	2026-06-02 01:48:00+00	2026-06-02 02:50:07.905054+00	waext:55a898a3c4ba450effe43f0656128012dd71a6a8b76838a031d6804868f82320
dd453941-2613-4da2-a638-f786103fd2be	a1f51fee-463c-4356-b702-9f6555241c18	Bang Marvy NM23	customer	Photo\nOk	2026-06-02 01:58:00+00	2026-06-02 02:50:07.905805+00	waext:972c2f7113c41653661ac92d375f30cd9536364b5e84101f44b2f2dd196c81a9
b34656d0-e58c-4788-ac8c-525635b53bbf	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	lu brg oji ga?\nIyaa anaknya baru bangun	2026-05-31 01:34:03+00	2026-06-02 06:34:52.78945+00	waext:f96f660a0d8817c85add8f810c90dc2010fcc4e8a277f98ae405e5abdbeb4952
7b0445cd-6f1f-4b8a-80b9-819fe318826b	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	barengan atu	2026-05-31 01:34:04+00	2026-06-02 06:34:52.790173+00	waext:fa37458c812dd36e650dbf691be71c26a0594637d85c1e23b54a25f3238ca0c2
c825451a-d4d7-4b29-8ed1-eef5c144ec5d	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Ayo aja kumpul dmna	2026-05-31 01:35:00+00	2026-06-02 06:34:52.790804+00	waext:e883dedca765aee8a7c8ddc3731c45ee9870eebd30bc88ca6836c93cc1e3e2b9
58f8b452-2278-482e-9e06-2ef5407443f9	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	yg cwo siapa aja emg?	2026-05-31 01:35:01+00	2026-06-02 06:34:52.791588+00	waext:ceffaded60d8066ae1ec8eaea62eda2093f8df9c34dfa650a6cfe1ebe4c8c6b8
54662a2b-d9e0-4adf-8ff9-5f8bbc3031d3	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	ariq di ruma lu?	2026-05-31 01:35:02+00	2026-06-02 06:34:52.792414+00	waext:870756a5f6d43d3cf5df0f62a2da50f62867b57403427a794714e749598a18d4
6efad172-e90d-4d80-8071-9f0bc9102f12	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Yg ceweknya siapa aja	2026-05-31 01:35:03+00	2026-06-02 06:34:52.793179+00	waext:41189cabdf9a10ba5ee0b74dea774401cb3fb31197c0800b7ae1ea9ecbf467c1
875e9b3a-5347-4dba-9d19-61fece34387e	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	yg cwo siapa aja emg?\nBaru gua, ariq, oji	2026-05-31 01:35:04+00	2026-06-02 06:34:52.793924+00	waext:bfdd9bd9b252eae2e42c7f57a16a1cea2fbf0ceb3aaf9938e29c85a399ba371c
2816611f-637d-4e6c-97d8-cceaedf4227b	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	ariq di ruma lu?\nIyaa	2026-05-31 01:35:05+00	2026-06-02 06:34:52.794474+00	waext:c7e0d2bc5b598703d591040807821639ecebef9ef609a8e2f6096d62641d92b5
e17553d6-c12a-4f29-8c94-4e79c1de5576	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	Yg ceweknya siapa aja\ngua baru taunya bertigaan doang	2026-05-31 01:35:06+00	2026-06-02 06:34:52.795102+00	waext:ab91cbbb0b6d28f7aee5dc4be517f11b157a9c6949c5383a8c6cac783d2a0f2f
440dbd38-1ee9-424e-8421-b9018c0cedff	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	gua, citra, diah	2026-05-31 01:35:07+00	2026-06-02 06:34:52.795665+00	waext:a1d5c33938ac72d914d761d1ee0041f70dc70b1969abe07ed46126ed0e2c6e60
7c45bee4-ab24-43c5-ab8b-b207c6d4eb9c	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Si bocah bucin??	2026-05-31 01:36:00+00	2026-06-02 06:34:52.796241+00	waext:5a24be40277e87d30633d7dadb90d7041868acdc103363f5d199d317ac573874
e7b4188a-018d-4cfe-acb0-bede6b52cfd9	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Hana	2026-05-31 01:36:01+00	2026-06-02 06:34:52.796756+00	waext:bae946fe1bec6158c0f91b4d58dc6b94b0480f07fb27559ff99bd02327dead7c
92d2a8e5-9654-4942-a0db-9b4abdf543de	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	nah gatau	2026-05-31 01:36:02+00	2026-06-02 06:34:52.797269+00	waext:733bc61c4eb15139e75c77f9517d26e1710d504dc6054ec58d3742ca5003b84d
98fece2c-aae2-4692-a1e8-661bcd165519	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	laras katanya diundang, tp gatau da dtg apa ga	2026-05-31 01:36:03+00	2026-06-02 06:34:52.797739+00	waext:c7c9716d7ba11cc010dcdfe8f59e0005131f619d344ef44ab46b469869cecd19
62fe6201-0f1a-4085-b5c5-b6221241ab2e	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	citra yg chat soalnya	2026-05-31 01:36:04+00	2026-06-02 06:34:52.798571+00	waext:d073d7f9a26579e13005e3563cf9af639946eb37fd15e3507167d779a16269bc
e3ce0de6-50e1-4b49-bc92-75a92c2530ff	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	ini jadinya mau jam brp? mau prepare soalnya	2026-05-31 01:38:00+00	2026-06-02 06:34:52.799363+00	waext:6c5538db0e8bf31fd08bdafbf813c921d52cf9c9faae701e012819db6f85393b
920c4509-3388-4adc-88f2-afa339b23854	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Di Hutan kota deket tuku	2026-05-10 05:44:00+00	2026-05-29 06:35:01.289497+00	waext:9a3cd40a8a56e498645043ea2c82a2a7cf4ad4bf34d266270de77ea094e1674a
589f8d9f-0d72-4355-8262-c97d25bcf5ea	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	jauh yaa dari jcc?	2026-05-10 05:45:00+00	2026-05-29 06:35:01.290894+00	waext:e80d873adf9c1a7cccaea617cbb8d349d1c4ed9d0c4e3edca021539115ef35f3
3b36e27e-017e-4d51-bf1a-08ad94e6c3f7	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Pintu yg kita masuk kmrn pas nntn timnas	2026-05-10 05:50:00+00	2026-05-29 06:35:01.291946+00	waext:25726410150c0418ba41c22a96edaf6678a851c05acd60542c016120f7ec1936
8e0bf62d-fdcf-4475-ba52-b194d651dec7	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Gak jauh jauh amat	2026-05-10 05:50:01+00	2026-05-29 06:35:01.29268+00	waext:5e0366a2ef95711ef740b1ee94a0ebb5b3ff662b8e15300faa9336d2f59987b5
362dcbaa-e7ec-4134-ade7-9fef22ffc302	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Valo	2026-05-10 06:02:00+00	2026-05-29 06:35:01.293448+00	waext:0a04817fbe786566d1ef07266fe051aa6a7fce333b3dc92f8fb6cdfdc148084f
35aca28a-969d-481b-84b9-06d2bbbf3d5c	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	ayo, mandi dlu	2026-05-10 06:03:00+00	2026-05-29 06:35:01.294148+00	waext:e2a7387a6228f01158ef292872d3e1d43c17381a8111f9b6f4ba1f5776f309df
04478f9b-ded5-4ad2-8081-85de344649b0	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Yapi gak bales	2026-05-10 06:41:00+00	2026-05-29 06:35:01.295255+00	waext:9237ba6253b44942fd9a34e2de9fd9d49495b213572cb2ac2fe8d830f27753da
7ee623d2-46e4-4a77-9435-f38883c07846	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	mo maen apa kga ni	2026-05-10 06:41:01+00	2026-05-29 06:35:01.295926+00	waext:b3bf978d6e02da8d99fb98558cd972352d61205645308fa686a66ce6e1517c4d
b90410b0-ac49-4f49-801d-2d8ec1892daa	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Party tebe??	2026-05-10 06:43:00+00	2026-05-29 06:35:01.296905+00	waext:8fefe73ec55c0339b7d1222ea649a80a34abea71bc561512f8a27898f0851f5e
49485012-f287-4fc3-8ad5-369f20543a4b	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	Faturrahman Ptra	sales	Kak nit	2026-05-25 15:30:00+00	2026-05-29 05:51:52.11808+00	waext:5c0bbf112e5437f66cb605259cc6a9f352850904308504c2db46f5862a9aafa4
dac2bbb3-995d-4616-9257-ab28b225a11d	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	Faturrahman Ptra	sales	Mau nanyaaa dongggg	2026-05-25 15:30:01+00	2026-05-29 05:51:52.118739+00	waext:653676153b7a8b5f9bf9c884618eaa2913ff7b40384123c51c8cd047d4df34a2
a89fa7f6-3c91-4dfd-ba7a-81f78d3a77c8	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	Faturrahman Ptra	sales	Lu klo naik kereta turun dimana??	2026-05-25 15:30:02+00	2026-05-29 05:51:52.11928+00	waext:0388093038cb15ca35c338332711dde55c0a96713e2c0dc2d53d6b8ac4c1c378
c0fa8029-e5a7-4f8c-9979-96b7b03de488	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	Kak Nita NM23	customer	Tebet tur	2026-05-25 22:56:00+00	2026-05-29 05:51:52.12008+00	waext:357480d42604125f73d3f7ac8886a071da12bf20d75b59e63cd00c801e257f73
9a5659a6-a380-4dc4-b3be-2d8a907bb307	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	Kak Nita NM23	customer	Trus naik 6D	2026-05-25 22:57:00+00	2026-05-29 05:51:52.120693+00	waext:d94d4b19303cb3082fdaacaac9c0cf768c14466ad2b6f5f81371a30a43cef24e
92dce1e9-021e-4845-a6ea-fd8f69cc97bc	67343055-cd9f-4943-abcd-0016838210cd	CIMB Niaga	customer	Bayar QRIS di OCTO Bisa Dapat Cashback!\nQRIS di OCTO\ncashback Rp12.500\nRp12.500\nOCTO\nKode Promo: QRIS0426\nPeriode:\ncimb.id/promo/qris0426	2026-05-29 05:54:15.41+00	2026-05-29 05:54:14.423067+00	waext:d74721985d8c60d8f277f105442b7fa9f2e42b9bc8f3fb1e788507e3d92a9af7
30de4378-0c2f-42e6-ab7a-9ca57f519490	67343055-cd9f-4943-abcd-0016838210cd	CIMB Niaga	customer	Beneran sepuasnya, transfer ke bank manapun bebas biaya pakai OCTO!\nBI-FAST\ncimb.id/bifast/promo	2026-05-29 05:54:16.41+00	2026-05-29 05:54:14.42398+00	waext:d1a697ab1130096830c69964ca8ab445e5b3bb5b7ba4922eb9f3b5dae553f25b
7d5c0205-dbb1-4cea-8fd4-3dcd030016f7	67343055-cd9f-4943-abcd-0016838210cd	CIMB Niaga	customer	Top Up e-Wallet di OCTO Bisa Dapat Cashback!\ncashback Rp5.000\nKeuntungannya:\nRp5.000\nOCTO\nKode Promo:\nPeriode:\ncimb.id/promo/topup0426	2026-05-29 05:54:17.41+00	2026-05-29 05:54:14.424888+00	waext:0f10a9fab3682c70be7a99f7679c08ff82d539916b08405ebcb922c2d0adf6ee
b3ae0b30-dae8-4f4d-9eef-13afb6b5edb7	67343055-cd9f-4943-abcd-0016838210cd	CIMB Niaga	customer	Bayar QRIS di OCTO Bisa Dapat Cashback!\nQRIS di OCTO\ncashback Rp12.500\nRp12.500\nOCTO\nKode Promo: QRIS0426\nPeriode:\ncimb.id/promo/qris0426	2026-05-29 05:54:18.41+00	2026-05-29 05:54:14.425652+00	waext:74fcad77c16d050589dd69bc19e62590bdc77afd068c0587cda66daf9034f7e2
2bb43598-1ce0-4f8e-9a50-434708491986	67343055-cd9f-4943-abcd-0016838210cd	CIMB Niaga	customer	Mau\nhealing\ntapi dompet tetap aman?\nQRIS OCTO\nOCTO Pay\n20%\nCinepolis, Gramedia, Bluebird\n30 Juni 2026\ncimb.id/promo/promoqris	2026-05-29 05:54:19.41+00	2026-05-29 05:54:14.426487+00	waext:4a802dae3de66a3c29b7a3f6f7d4cedc39c2d34346fc720f89b5dccef99b03ed
e93c364f-16b8-4dc4-a203-e6bce69a0e53	67343055-cd9f-4943-abcd-0016838210cd	CIMB Niaga	customer	Bayar QRIS di OCTO Bisa Dapat Cashback!\nQRIS di OCTO\ncashback Rp12.500\nRp12.500\nOCTO\nKode Promo:\nPeriode:\nhttps://cimb.id/promo/qris0526	2026-05-29 05:54:20.41+00	2026-05-29 05:54:14.427212+00	waext:7dd0ec8036a05a487cb80bac531e88c01af4e2e72bf8833d00fb7f3a398ceb49
5ef53769-7e87-4dce-bb7f-1fcfb611b688	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	lagi main dia?	2026-05-10 06:44:00+00	2026-05-29 06:35:01.297634+00	waext:4c11476d6760a5df067bb919ddc6a6c9eda696ef2d5d4ad35640d50353ad2a3b
00aa64c9-ba65-4c2d-8c6d-30879e949595	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Tdi sih main	2026-05-10 06:44:01+00	2026-05-29 06:35:01.298386+00	waext:4eef02eae72050b2478d168acda1dabe74084ce3dc02f49054278fca96d4ad07
e0b45b21-535e-4eb1-a81d-7d1805d18b0c	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Kaga main mereka	2026-05-10 06:45:00+00	2026-05-29 06:35:01.299679+00	waext:68d6e3a5f54a764e6830423ef0b75c5f285599736f54570dc6c4563984c71099
ec815773-4418-41cf-b0ef-f808c669650f	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	mau duo?	2026-05-10 06:45:01+00	2026-05-29 06:35:01.300585+00	waext:7a69172c8d9c7ad7174bc12f57fc1852d29bd2a52f44379b7a3d8ee27f7f5040
84884276-e5d7-443f-a5b3-edf76dddf97c	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Sorean aja dah	2026-05-10 06:46:00+00	2026-05-29 06:35:01.301312+00	waext:dd230cebf3d921c11203941e616d30dcbf9bebd81a3939161cef94ad4c09096e
b4fc1f17-3710-4bfe-aea9-fc3635a6be4e	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	yodah	2026-05-10 06:47:00+00	2026-05-29 06:35:01.302127+00	waext:8708457ec4d227904226a347d23ed853413c02e83edc06b4c9229aba1dc5e2eb
d268fbbf-1b7e-4579-a222-564cae1cc594	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Udh pada nyampe yg sesi pagi?	2026-05-11 00:43:00+00	2026-05-29 06:35:01.303042+00	waext:8ac8ba8e16b8ff941ba75a0ffa45ca050eb419c3fd9c7904505849cc3781830e
7bff9611-d362-4543-96dd-95fcd20675bf	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Udah masuk bae	2026-05-11 00:46:00+00	2026-05-29 06:35:01.303923+00	waext:5e0b71dc337b64a80206f393af988fcff7a88078340fe756f6e2c1e549cf1ac0
6106519c-091e-4f00-833f-2f1973f4b2a1	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Tbe	2026-05-11 00:46:01+00	2026-05-29 06:35:01.304875+00	waext:159f2e308c9984a4896d96b9ef334e64ea0231e7cb28a4694fdcb32805106472
edfa27bd-ae27-4597-bf7e-c49bf0cb1bbf	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	baru otw anj	2026-05-11 01:04:00+00	2026-05-29 06:35:01.305604+00	waext:fe248823d375e1571ba842d937fe49e2acf3450c1bf6cccaf211bbf2f0937ab9
d4478848-7954-4392-8bae-dd7342c2d5d8	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Goblok njng	2026-05-11 01:10:00+00	2026-05-29 06:35:01.306404+00	waext:e78e38f3cec2727a1195244f45bb3b190a786ba82e6e5a22fff4058cd5ca4105
7070a22d-ec22-4201-8b7b-cfe13e1fcdac	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	10121329	2026-05-11 05:13:00+00	2026-05-29 06:35:01.307186+00	waext:f8710b09a9bf975e75f973a37561fc3a21ad899a6e99b27bd07a84d6e039e997
27f5e7bc-bdea-4dd2-ad79-6877e54534e5	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	Photo\nenak lu ye dah makan segala macem	2026-05-11 06:54:00+00	2026-05-29 06:35:01.307861+00	waext:65702add2d2177e1f873882eda2e6617f55a0fc63e04fbb364131081287a213b
f5ad9761-1d0c-4ec1-a4a3-28cd82e36097	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Aus njg tpi	2026-05-11 07:15:00+00	2026-05-29 06:35:01.308531+00	waext:c4eb71d67730275fcf736139f300826e66b90befc30751ac1c197c1d618a5915
d38cbcc8-78f9-4823-96af-49b0037208c6	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	enak lu ye dah makan segala macem\nSi margianti ngasih sambutan pake video njng	2026-05-11 07:15:01+00	2026-05-29 06:35:01.309225+00	waext:a845451695823f0a4f97209fe1b17595618c7a013ecb869dd507664fd1dcc361
709f50cd-de41-46f1-b2f7-10b8c0a7be9d	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	kata gua	2026-05-11 09:07:00+00	2026-05-29 06:35:01.309932+00	waext:3f8049ccd0148bc96d6e39adbd4a0593ffc0539bc0aabcd9a1ce9c1a85ada8bc
635c97e2-67df-48f9-9be6-8fcefd6822a6	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	Aus njg tpi\ngua lupa bat bawa minum tadi	2026-05-11 09:07:01+00	2026-05-29 06:35:01.310551+00	waext:60f9a042afe118643181dea8f6992c31a3d3c51b09965c433fd86a16977c1dc6
dfb3f978-88ed-4a7a-aae8-2733963989d6	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	gua lupa bat bawa minum tadi\nSama njng	2026-05-11 11:12:00+00	2026-05-29 06:35:01.311205+00	waext:ef8aa4a7354eb998093dc011033dbf750cbf0bca80ecf3aead23a12f4f66cd36
0ec1d9c8-a74c-44f2-8422-c5e30f6e0896	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	tur	2026-05-14 06:50:00+00	2026-05-29 06:35:01.311872+00	waext:3633effb7cacc885917dd4fb0d2895faee826e52ca2ab792e7cb8b13a4fd35cf
9d7788ce-ce10-453c-b12f-bea43cc19bd3	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	lu ada canva prem ga	2026-05-14 06:50:01+00	2026-05-29 06:35:01.312499+00	waext:9155a052aaa0d0462eea4ea512a5055b65a225d8c92e73ebc02fb8d7b8ee8ac0
065b9e9d-80cf-4fcb-951e-e95cbd12af96	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	lu ada canva prem ga\nAda tpi email kantor	2026-05-14 07:12:00+00	2026-05-29 06:35:01.313144+00	waext:4ed9dff10b12282d7deec71b818b8c259d6a30c6ba95e6347f3d8062650c27b2
5b5011ee-25c6-458a-8f7c-9da9e1035772	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	mau trials tur?	2026-05-27 05:27:00+00	2026-05-29 06:35:01.313804+00	waext:46d960552ac2e7e17af5f2ef6ce6b3ff8bf3748f85fbe6ea3eeaab59e9d4300c
5f0e318b-e421-4e80-bd2b-86b8c22e1bc3	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	yah	2026-05-27 10:58:00+00	2026-05-29 06:35:01.314504+00	waext:399aad2877550c4cb674702b129657c9acf147d01aab6bdce4373b0e7a0484fb
13f63b6a-0961-4c92-a2f8-f6743df2c131	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	lgi gua tanya	2026-05-27 10:59:00+00	2026-05-29 06:35:01.315121+00	waext:32f4f35fe9e70838c8b1a0038c680aafc3605a60ac3dc4c9b61c840c240b3f2d
cef81f1f-a357-443c-b958-1af7cd926ae6	b7191080-f685-4c04-b8a5-e7a48caeb188	Daffa Fachreza UG	customer	valo?	2026-05-27 12:24:00+00	2026-05-29 06:35:01.315831+00	waext:dd5082c1e0d940e30d070582f577a3518bcd7ab47a2c656a417e619b4a422085
f2a8067c-cb75-4c75-86d1-17c9e04cd72c	b7191080-f685-4c04-b8a5-e7a48caeb188	Faturrahman Ptra	sales	Masih di luar	2026-05-27 12:44:00+00	2026-05-29 06:35:01.316483+00	waext:4581ca8e1d7fb5b215de0c170c6aca6ce41f9d05feb242a701af8052078f3657
d536ca58-d129-42f2-8e26-e6b92d735283	59f1578d-d6a6-47a6-9950-541c2659e2f1	Faturrahman Ptra	sales	Maleman aja pin	2026-05-27 11:26:00+00	2026-05-29 06:35:46.714553+00	waext:e0d44852ec2f2a72c6e1db8b43a5cf06585248abc5a2b716984538f94dff6527
4fa1047c-ede6-4678-9ede-4dd603bbb5d5	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Bebas gua mah nunggu aja	2026-05-31 01:38:01+00	2026-06-02 06:34:52.800014+00	waext:a466ba4fb4a9b19eb318a252b1056c2a63f7046887fa61ae457894ffe2f5603a
9e906dd6-5773-41d0-9497-b88e8af21672	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	resha sm isan diundang ga?	2026-05-31 01:42:00+00	2026-06-02 06:34:52.800834+00	waext:ada20357d7ba9b50a63e56882966bdd6b54217cf724a87dede6bb3e5baf2feb1
fd49bcb3-3d01-444b-b572-b6916ab24a03	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Gatau	2026-05-31 01:42:01+00	2026-06-02 06:34:52.801361+00	waext:0c78631358d3af2adbc9f6a5c1765460c724282e31d4161043046fcdd045a333
f816df84-13d2-441b-a86c-157094124f82	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	jam 10 an aja berangkatnyaa	2026-05-31 01:45:00+00	2026-06-02 06:34:52.801909+00	waext:4b5edacb00b3644b5efd2e460af16419dc161a618c2be53ce39047d0ac87d8a8
2c7c52d5-8f9d-4b42-9481-9b598907acdf	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Dimane	2026-05-31 03:22:00+00	2026-06-02 06:34:52.802457+00	waext:c1a837c86f4c7653af2e7e20b77c78581bf4ea264a43f4aa1d5498f0bfa6477e
6eaedcd7-f143-4eb7-9132-6477235154a3	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	rumah	2026-05-31 03:24:00+00	2026-06-02 06:34:52.802983+00	waext:5cfe670cf8d4ef6b06c5836d6d007e02c86c72ad98f6c88af80bb4decc13858e
6a53d07f-c179-451a-850a-cc394541d3ab	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	lu?	2026-05-31 03:24:01+00	2026-06-02 06:34:52.803523+00	waext:e9bcb090786b82d73b795e4a3b3bdb1a1875ec3a95b0d5ec3fb91b481c239b51
a4dfb906-66d0-4cd9-b044-b09a77e33627	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Masih di rumah	2026-05-31 03:24:02+00	2026-06-02 06:34:52.803968+00	waext:fffb13ed80c46b24b262b22a26e80e8cb19d87733042c2f2065a901363ace774
5aa71164-afd8-4349-b8d4-83121551b6e8	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Kesini aja udh ada oji ariq	2026-05-31 03:24:03+00	2026-06-02 06:34:52.804396+00	waext:769d1b2cb2095be7f748e1a6f92d5421e4698ba96be94e3607956b3ccb842e79
6f3ff9a6-8385-40f4-80ac-b74153acec47	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	gua bw mobil tpnya	2026-05-31 03:32:00+00	2026-06-02 06:34:52.804985+00	waext:b44ac7a2ce9c9951799cb619b3f899b9841780faf5aca76f0cf848f6e7a93f30
f03edd0b-98af-4c79-a6a1-3f92d86b11f2	2a377930-58c3-473f-a9b6-dd56909f54d3	Faturrahman Ptra	sales	Njng deket juga	2026-05-31 03:33:00+00	2026-06-02 06:34:52.805522+00	waext:0c2100a479c4075ff886e45ed8018010dc952cca5e79c6a65ef16b19571f3771
a97b0e6b-6084-460e-9922-483b25b39963	2a377930-58c3-473f-a9b6-dd56909f54d3	Keysha Alea	customer	HAHA	2026-05-31 03:33:01+00	2026-06-02 06:34:52.806016+00	waext:99304db49ad6b8780e21357bdc8fc967675d615933fb26e6d10b0af413fca08e
07e2030a-e429-4f68-bc18-d3055092feb5	2a377930-58c3-473f-a9b6-dd56909f54d3	Sales Dashboard	sales	Halo! Senang ngobrol santai bareng kamu. Kalau ada waktu dan kamu penasaran soal investasi yang lebih serius, saya siap jelasin kok. Santai aja ya, nggak perlu buru-buru.	2026-06-02 06:55:35.254945+00	2026-06-02 06:55:35.258734+00	\N
8d741ba0-8157-4231-b93c-33edc147353b	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Video\nLu kondangan gak??	2026-05-31 01:32:00+00	2026-06-02 06:55:43.608514+00	waext:d044b1f038bb3802e3cc63f9b7f6a9ccb59bbd09513fa435b3ecd69e1ae917ba
e8e6c835-420b-4d20-8dee-4c5fcbd8cbb4	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	iyaa, lu?	2026-05-31 01:32:01+00	2026-06-02 06:55:43.609354+00	waext:67d52c76278437e16a24b7f161a22cfae8128cbb60b5019f268ab358536b2961
d70d4962-de32-4ef9-8478-0b19b763ce6e	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Ini gua udh sama ariq	2026-05-31 01:33:00+00	2026-06-02 06:55:43.610222+00	waext:7cb9948c7704faeaa9f760a81912e36004269093dac9febf28c55a22ffb689c1
4b346bed-3548-4026-8742-e76764ada307	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Yg jam 12 kan??	2026-05-31 01:33:01+00	2026-06-02 06:55:43.610943+00	waext:a8d35ec47d79dfa342bb59cc75230089fd6ff9fd5562340cc7d4de5c569e1d77
a0e66dbc-fb7b-433b-87a7-fb985b8f2db7	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	katanya jam 10?	2026-05-31 01:33:02+00	2026-06-02 06:55:43.61162+00	waext:0fd2bee738d8469eb3f0d3a26b69c0de948cb763a255136fbcd98a43bc544e1d
d2e1175d-2bc1-4bb2-9d54-f62e1ed319db	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	oji bisanya pagi cenah	2026-05-31 01:33:03+00	2026-06-02 06:55:43.612277+00	waext:78105813f934d188056f3cdd5c9eb7c250c56033884baebad2777ed45fccd343
1a505784-31c9-453c-87f7-0a0f74629c9a	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	lu brg oji ga?	2026-05-31 01:34:00+00	2026-06-02 06:55:43.613041+00	waext:7b4e0cc261fd87820ecbe4efd8114997e6157bbd095c55eb68215e19426b4026
3c24a9ed-bef3-4437-9dd1-805eab0a2be4	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Itu mah akad kali	2026-05-31 01:34:01+00	2026-06-02 06:55:43.613788+00	waext:f30b3baad01cb3f170dc13271512f8612e24f3b18232bd88def9448575a52c3e
832c482e-c88e-470d-8d78-fe2c9b169c35	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	akad kan jam 9	2026-05-31 01:34:02+00	2026-06-02 06:55:43.614435+00	waext:bc5983a5fae7c624d97a80ff732bcde22dc8a7fc99ec260dbb82cbb0baf83015
2fe0c306-0210-461e-8d66-7fc541af2240	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	lu brg oji ga?\nIyaa anaknya baru bangun	2026-05-31 01:34:03+00	2026-06-02 06:55:43.615113+00	waext:6fd9763eed175709e8c8e57ed075d7820e141c7e835c253ed54faa0996034595
4a874a0a-758d-48e5-8959-2e773ac7e161	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	barengan atu	2026-05-31 01:34:04+00	2026-06-02 06:55:43.61606+00	waext:bc82a0ad91e2908b37b78b91f1e598b4df39f20cd0cf0479ad23156954869b17
e8255810-f8e0-4afc-a1e2-7bd10bd44072	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Ayo aja kumpul dmna	2026-05-31 01:35:00+00	2026-06-02 06:55:43.61675+00	waext:ff7d33f7908a17eff3c16725f97a5212d18177b114c2c2e25b1805b5338144f4
e09f2285-5d9b-4a78-869f-a5c89cbfa69a	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	yg cwo siapa aja emg?	2026-05-31 01:35:01+00	2026-06-02 06:55:43.617405+00	waext:b3f90cb0918dfc79e27a40880a185b8036a0f56747230b0b62a64bdb9bc48050
1a54e486-b517-4105-9068-79fea8fbc3bd	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	ariq di ruma lu?	2026-05-31 01:35:02+00	2026-06-02 06:55:43.618043+00	waext:90d8ce2b896ce5d7a4e44fbfe6f29dd7e688efd2b40961362dd8d77dae4815cc
af880087-6419-4548-9ac7-f4926476d082	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Yg ceweknya siapa aja	2026-05-31 01:35:03+00	2026-06-02 06:55:43.618649+00	waext:fb279259dd5cb518f3afb6624719d119fda2d1418c6fdcf5f08da3ec36256f12
e4b608da-1513-4756-a373-e607dcd881b7	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	yg cwo siapa aja emg?\nBaru gua, ariq, oji	2026-05-31 01:35:04+00	2026-06-02 06:55:43.619182+00	waext:252eaef1fdd94b18beb6cc5c7e04528875574cd33e8e4d781e09fede6edc533e
abfd25a0-19fd-442b-b16b-a1620dd7335b	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	ariq di ruma lu?\nIyaa	2026-05-31 01:35:05+00	2026-06-02 06:55:43.619727+00	waext:256d74520c1f93e2a9159e2644b358ef5b6ea2b19763b8cf3cdec7cc27993c0d
8f1623a1-704d-44f3-8366-651356b6662f	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	Yg ceweknya siapa aja\ngua baru taunya bertigaan doang	2026-05-31 01:35:06+00	2026-06-02 06:55:43.620345+00	waext:e9645acf2ad1f15fb38488c200ea6647a2c327e4f0de9f04095e810b375bdf99
d5fc8293-9846-44d5-b5ae-2b68d98a658c	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	gua, citra, diah	2026-05-31 01:35:07+00	2026-06-02 06:55:43.620967+00	waext:6e854aa29520a6acb1b0d15ac745039e2d53fc0bb1f30ed3548338e313704713
a853ec03-14ff-4ea3-89fd-2458c3339644	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Si bocah bucin??	2026-05-31 01:36:00+00	2026-06-02 06:55:43.621536+00	waext:e393736ffcfb735107c6bd5dcdc9f310d5c21adf9726a53b0a12cb393243494e
356125f4-22fe-4745-95eb-db9ab236fce0	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Hana	2026-05-31 01:36:01+00	2026-06-02 06:55:43.622032+00	waext:97fc31ddb9c581510b1d6e2d69d7723055986f5dee433f588ccc73aa6e592caa
4c406e08-5b82-4d51-960d-e610d57ba738	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	nah gatau	2026-05-31 01:36:02+00	2026-06-02 06:55:43.622526+00	waext:4726ea78159120492e47ef58505c4821d27aa6e9e44454a2d3f31f77b889bb46
0f221603-b14a-4809-8df6-e7254f08aaf6	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	laras katanya diundang, tp gatau da dtg apa ga	2026-05-31 01:36:03+00	2026-06-02 06:55:43.623022+00	waext:e162abba921544275fb0dda3cd886dada998a0477a12daecf1d3ad2a73fbebd2
b2feddcc-314f-4a6e-a5f0-ebee4301de65	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	citra yg chat soalnya	2026-05-31 01:36:04+00	2026-06-02 06:55:43.623846+00	waext:536e8fac6fdc1c71993fbd6a812dadd25dabfcffe1c3160cc14acfcc8a0fbcd1
4ffec92c-58ba-4ec8-b80a-58b01e39c9e0	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	ini jadinya mau jam brp? mau prepare soalnya	2026-05-31 01:38:00+00	2026-06-02 06:55:43.624519+00	waext:cb71d0bd2c07a684782b0714d4c6da3d43e5d8af95f197298224e9cea6747a9c
22e967ff-093f-47df-8523-bd83534d3ef5	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Bebas gua mah nunggu aja	2026-05-31 01:38:01+00	2026-06-02 06:55:43.625091+00	waext:d7f9dad69834a9f3006def1c262e8171446444f62670b80a61e2742d531d6134
ac5d414e-7ce5-4b79-8876-a9afc96624e1	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	resha sm isan diundang ga?	2026-05-31 01:42:00+00	2026-06-02 06:55:43.625732+00	waext:428b82e1d146c828b65714bcab5fa0615957f7aa549741c71f478252f7e3ef49
ca474df9-b825-4278-b0fe-79ca64b73a7d	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Gatau	2026-05-31 01:42:01+00	2026-06-02 06:55:43.626369+00	waext:ba4732b7147fa77dad1c7e7879e003ea0accb5391d45d666200642e3b1c8a142
c07cb1b3-f61a-4649-a028-ce47cc120e09	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	jam 10 an aja berangkatnyaa	2026-05-31 01:45:00+00	2026-06-02 06:55:43.626962+00	waext:7c6eb3bfbe06bc2c288bb8396582a564d26b3abb9d8bd3d977a08c20bd38987e
b9dfa6ed-aac1-4189-9d0a-cfe8a9b5251f	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Dimane	2026-05-31 03:22:00+00	2026-06-02 06:55:43.627658+00	waext:7b05c8e7622e692bb009e18e96339f539cc2a23a914260702d3f5b7213e13fe5
726c0a2e-64d5-4ca7-831b-7b9e25a01ecb	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	rumah	2026-05-31 03:24:00+00	2026-06-02 06:55:43.628227+00	waext:8b4301230434a85ce38371627d035d251114ec454b64afddd085259502a233e2
6e4137ee-d415-4647-ad3e-5935702e9b20	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	lu?	2026-05-31 03:24:01+00	2026-06-02 06:55:43.628746+00	waext:43cfc17b7616aaeefee4e2a63f98bcbd5784c134e527b5b81e9b110f3e7fda7f
e00f512c-b18a-4840-a533-a6c5ddd61946	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Masih di rumah	2026-05-31 03:24:02+00	2026-06-02 06:55:43.629265+00	waext:7bcc6310bca6a7a20fcd154b5d2fd0678362058d48ee95ba7be86a50b5f19e98
c8687355-9751-4451-ba90-2aa63c7778cd	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Kesini aja udh ada oji ariq	2026-05-31 03:24:03+00	2026-06-02 06:55:43.629771+00	waext:140e5c108946ce8b79bafbe77f6f9e0093475128c60df829a5092fc0056770bd
34ef76cb-4cb7-4fe2-b610-2803be4c7d38	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	gua bw mobil tpnya	2026-05-31 03:32:00+00	2026-06-02 06:55:43.63024+00	waext:051c7c55e74f08d9cfef807f50e8bf2c89544e7a404c5193ced1635946c18686
8d63a62b-7ab4-444b-9eb3-cbbee925217b	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Faturrahman Ptra	sales	Njng deket juga	2026-05-31 03:33:00+00	2026-06-02 06:55:43.630679+00	waext:ef52164eba496e988ed310880d2c261901ab1839aadfeed510b7844c21cd2e12
14fe0917-e816-480a-9698-afe9a283a91b	edac28ad-d5ca-48a8-be7f-f36d30985d7f	Keysha Alea	customer	HAHA	2026-05-31 03:33:01+00	2026-06-02 06:55:43.631131+00	waext:395cf50dbe0846a3044657e59786c283d7bc5816de0e07f1cc6f220688136646
f989dd6a-d24d-4f96-b894-3526372ff6c7	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Faturrahman Ptra	sales	Coba tekan kode 86 lalu Enter pada keyboard meteran untuk melihat berapa kWh yang dikonsumsi per hari, agar polanya kelihatan.\nCoba ini	2026-06-02 07:07:00+00	2026-06-02 07:12:14.365419+00	waext:b8e7b09055cb1337cde30843e286c9c9648774b0a2f0d85e36f9179b9231f524
bcfd821a-e991-4abb-b452-d7f67f8c58c6	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Ara≡ƒÆò	customer	Gini deh kamu ada tv juga\nPdhl tv ga selalu nyala kok, skrg aja mati itu	2026-06-02 07:07:01+00	2026-06-02 07:12:14.366581+00	waext:4641d37681c173b7b89a6cfc45c36b210ca003ff0264ad2a4c811b57b49b427d
da41d187-70a6-47cc-9b01-8d2cd23f81be	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Ara≡ƒÆò	customer	Adekku ngirim ini	2026-06-02 07:08:00+00	2026-06-02 07:12:14.367586+00	waext:539830a9fc41c6749e47f4ef7ef404f9f4b787ac281eb7ab73bb30d2a953456c
9a94c320-0d83-4825-991d-d50142d8ed56	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Faturrahman Ptra	sales	Pdhl tv ga selalu nyala kok, skrg aja mati itu\nIyaa tpi kalo sekali nyala juga makan listrik banyak	2026-06-02 07:08:01+00	2026-06-02 07:12:14.368228+00	waext:2b5875697701d91a43dd5d48d9997e010298c790c440013ed17a8b293ac73c01
9a77a89c-caab-47ef-a395-fe5c604d31b2	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Faturrahman Ptra	sales	Blm kulkas juga	2026-06-02 07:09:00+00	2026-06-02 07:12:14.368792+00	waext:d668fe5c066c6461e7a0054d00e41166e17cf47c0552aad563c4fe1db2aa67d6
10a7d95a-6184-4474-8eff-1f5e5f251809	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Ara≡ƒÆò	customer	https://www.restuengklekmandiri.com/baca/ini-daftar-kode-rahasia-meteran-listrik-sesuai-dengan-merek-meteran/748/0003	2026-06-02 07:10:00+00	2026-06-02 07:12:14.369359+00	waext:6e164fa2ab6fe247fa49855abfd7ed837936f066b0da5eff0b3bdac9df73506b
ff3a5100-429c-47f7-bead-6ce9f5a060d4	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Ara≡ƒÆò	customer	Kok beda ya sama ini	2026-06-02 07:10:01+00	2026-06-02 07:12:14.370275+00	waext:16cc2d289ab27550d9c0414a08c37061ee3efb493299c842e25fb3dffca89c6a
71a93fc6-dfdc-4bd7-a69a-8f415a5ef614	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Ara≡ƒÆò	customer	86 ga ada	2026-06-02 07:11:00+00	2026-06-02 07:12:14.370803+00	waext:1ccab5a8ffd16578e085c823e3bb8c5ba8b593732f30c77b33b43166090e22c4
5d0e9a37-d00f-45aa-bbdb-62a9ca81bf6a	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Faturrahman Ptra	sales	Yaaa coba aja deh satu satu	2026-06-02 07:11:01+00	2026-06-02 07:12:14.371346+00	waext:77c26c47b392026af349e378f8d4967bb3beb1b5c0b0ff752fe90eae5da8a0fc
3fba777f-ff02-4050-979b-a632538f7453	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Ara≡ƒÆò	customer	Iya deh nnti dicobain	2026-06-02 07:11:02+00	2026-06-02 07:12:14.371825+00	waext:74a4d15f3e6a00d8d0c38db7626105b89ae5ef4b1cddeba2302e46441ea21c83
72080338-b20f-4b8a-ba33-104bcd634b11	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Ara≡ƒÆò	customer	Takut salah mencet aku	2026-06-02 07:11:03+00	2026-06-02 07:12:14.372317+00	waext:d18d9a58e12bb82206d6fd7cbe09731a1bfcfd6c4f2e2ee39d70da991973d2be
2599b5aa-ecd4-4a97-89b4-2b4d2cfbe826	13b0377a-f7b5-4bd8-a2f0-3033e85279c8	Ara≡ƒÆò	customer	Aku sm ayah doang di Cileungsi	2026-06-02 07:12:00+00	2026-06-02 07:12:14.373234+00	waext:f9191bc2fd5c3d14e64a940a2a64a6e033e8b60224a40dd06534954b495e6bf2
8698995b-7461-4162-be08-b891b79bd679	bf71883a-eedc-4d42-94ef-7ff55934f403	+62 821-2197-2455	customer	https://vt.tiktok.com/ZSx3aveSU/	2026-06-02 01:22:00+00	2026-06-02 07:01:10.354897+00	waext:e087f306bce401f84b66f36e237104094b11a91bbf8dd883f4ffc23f1cc28cc8
89dbd8a4-74c6-45bc-9074-d4f5964b37eb	bf71883a-eedc-4d42-94ef-7ff55934f403	Ka Dessy NM23	customer	Solid.prime\nhttps://vt.tiktok.com/ZSx3mWdR2/	2026-06-02 01:30:00+00	2026-06-02 07:01:10.35594+00	waext:be6c1b798d8613ad1710c188f8b9ed4ade7a6301f0fa29109d6a9b39b0fd085e
97f52525-f711-4076-aaf8-89dd789c086a	bf71883a-eedc-4d42-94ef-7ff55934f403	Pa Marlin NM23	customer	Frangki dan Marvi, tolong disiapkan, besok terakhir.tq	2026-06-02 01:48:00+00	2026-06-02 07:01:10.356716+00	waext:50842edcf13edd4a1ca5bbba0e1653945f239a4ac1a27fb1d175c97c91ef75e7
74ad4fa6-c68c-4996-b6af-abef76714187	bf71883a-eedc-4d42-94ef-7ff55934f403	Bang Marvy NM23	customer	Photo\nOk	2026-06-02 01:58:00+00	2026-06-02 07:01:10.357672+00	waext:db07e452806e79d2e1c0b5c4ae830ac9362ab677d50b7e8eb129ced7c883d3ee
35143757-0ee7-4e0d-a338-39b6ae7d112d	bf71883a-eedc-4d42-94ef-7ff55934f403	NEWS MAKER┬▓┬│	customer	NewsMaker23	2026-06-02 07:01:14.338+00	2026-06-02 07:01:10.35855+00	waext:0d1dcde67a4d86ad3694ae580712c15b919b50dfdd9001f8735cad01da16622e
a34ae8e4-0298-401b-bc32-d861e1170768	bf71883a-eedc-4d42-94ef-7ff55934f403	NEWS MAKER┬▓┬│	customer	NewsMaker23	2026-06-02 07:01:15.338+00	2026-06-02 07:01:10.359923+00	waext:4a11f6644a1aa6e8b70bef66082e83e71e352dd1565b09b71a0fc1528ec7bcde
f8623ef8-86a9-4696-8af9-7c1eff293520	bf71883a-eedc-4d42-94ef-7ff55934f403	NEWS MAKER┬▓┬│	customer	SG INSIGHT	2026-06-02 07:01:16.338+00	2026-06-02 07:01:10.361473+00	waext:5ffd59ff2ac4eb388f4a16cf40a6462c8d71d79b95bb425f2108f4220eb651c7
50659e00-4ff7-4dc1-8328-a89ded446489	bf71883a-eedc-4d42-94ef-7ff55934f403	NEWS MAKER┬▓┬│	customer	SG INSIGHT	2026-06-02 07:01:17.338+00	2026-06-02 07:01:10.362408+00	waext:22cc6f3455560a24cadacea89568e5b06f36a7c2714ca0da7239d92489c0405d
0ec3b570-c72f-49ad-9ba6-c49696994e19	bf71883a-eedc-4d42-94ef-7ff55934f403	+62 821-7775-7812	customer	https://vt.tiktok.com/ZSxTLfHDr/	2026-06-02 07:01:18.338+00	2026-06-02 07:01:10.363306+00	waext:3c23fa157183fa6dbc73dbc58b6c478c15d7d575dcef94345521cec74e892bbb
8d5478d9-733c-413a-854e-023f3c47efad	bf71883a-eedc-4d42-94ef-7ff55934f403	Ka Dessy NM23	customer	Solid.prime\nhttps://vt.tiktok.com/ZSxTNBtTY/\nhttps://vt.tiktok.com/ZSxTNmoqw/	2026-06-02 07:01:19.338+00	2026-06-02 07:01:10.364203+00	waext:ffab0b3ed70353d9d1eb4bca7521204759f69cacff40a0e741ee742dfbfa1d2a
\.


--
-- Data for Name: ops_notifications; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.ops_notifications (id, organization_id, user_id, acknowledged_by_user_id, source_type, source_key, severity, title, body, target_href, status, acknowledged_at, resolved_at, created_at, updated_at, delivery_channel, delivery_status, escalation_level, resolution_note, delivered_at, escalated_at, workflow_scope, owner_role, target_role) FROM stdin;
219ac5a5-57e7-4477-845d-9bf5455929b2	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:98c10fd3-6986-49e4-9008-8b7923d2adf7:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/3db559c2-41f6-425c-ada3-e6564da25422	resolved	\N	2026-05-26 09:15:51.891147+00	2026-05-26 08:08:25.212657+00	2026-05-26 09:15:51.910104+00	in_app	delivered	none	\N	2026-05-26 08:08:25.12603+00	\N	ops_oversight	sales	sales
5dd83149-93e0-41de-9b98-5239814c8e2b	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:73060462-9662-49a1-a01c-73dce532c0e4	medium	Approval queue: Customer	Kirim dokumen resmi yang membuktikan legalitas program dan tawarkan kesempatan untuk bertanya lebih lanjut.	/dashboard/sales/conversations/3db559c2-41f6-425c-ada3-e6564da25422	resolved	\N	2026-05-26 09:37:46.690591+00	2026-05-26 09:31:24.520602+00	2026-05-26 09:37:46.712146+00	in_app	delivered	none	\N	2026-05-26 09:31:24.503224+00	\N	ops_oversight	sales	sales
9bfd7829-68e0-44fb-a28a-6785d71f8d21	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:98c10fd3-6986-49e4-9008-8b7923d2adf7:approved_ready_to_send	medium	Draft siap dikirim	Sudah ada draft approved, tapi pesan final belum dikirim ke customer.	/dashboard/sales/conversations/3db559c2-41f6-425c-ada3-e6564da25422	resolved	\N	2026-05-26 09:37:55.612343+00	2026-05-26 09:37:46.712773+00	2026-05-26 09:37:55.634025+00	in_app	delivered	none	\N	2026-05-26 09:37:46.690591+00	\N	ops_oversight	sales	sales
34480894-a1d9-4f85-b212-7c2abb7d25a4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:9a4f8e0c-b3eb-469f-8a5f-a6b842148815:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	resolved	\N	2026-05-29 04:31:07.558126+00	2026-05-29 04:30:53.736303+00	2026-05-29 04:31:07.579363+00	in_app	delivered	none	\N	2026-05-29 04:30:53.682906+00	\N	ops_oversight	sales	sales
c807a9df-bba8-40ab-9121-6e5853a716e0	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:9a4f8e0c-b3eb-469f-8a5f-a6b842148815:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	resolved	\N	2026-05-29 04:31:07.558126+00	2026-05-29 04:30:53.739832+00	2026-05-29 04:31:07.579367+00	in_app	delivered	none	\N	2026-05-29 04:30:53.688234+00	\N	ops_oversight	sales	sales
c3ab465c-1624-45f2-904d-fd5de2d9cf6b	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:a4aac0a4-3471-455a-b984-df5e4fb684be	medium	Approval queue: Ara≡ƒÆò	Fokus memberikan dukungan emosional dan menjalin hubungan personal sebelum melanjutkan pembahasan penjualan.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	resolved	\N	2026-05-29 04:31:46.876312+00	2026-05-29 04:31:24.874663+00	2026-05-29 04:31:46.900874+00	in_app	delivered	none	\N	2026-05-29 04:31:24.854213+00	\N	ops_oversight	sales	sales
4775a11c-a317-4d1a-882c-82f6fd1eab82	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:7d4b8a5b-d59d-4db0-8e0a-bb4b5fff27dc	medium	Approval queue: Ara≡ƒÆò	Fokus memberikan dukungan emosional dan menjalin hubungan personal sebelum melanjutkan pembahasan penjualan.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	resolved	\N	2026-05-29 04:32:22.608957+00	2026-05-29 04:31:56.42799+00	2026-05-29 04:32:22.625281+00	in_app	delivered	none	\N	2026-05-29 04:31:56.410902+00	\N	ops_oversight	sales	sales
4160c511-91b9-4dd4-921e-014b0fbe4945	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:00762691-36cb-46d1-8e48-466c4a3187be	medium	Approval queue: defa UG	Sales harus responsif dan memberikan informasi detil serta memastikan customer tidak bingung terkait proses administrasi dan lokasi pengambilan, agar mempermudah langkah selanjutnya.	/dashboard/sales/conversations/a3b451c1-a339-4cb5-bfe2-b02fee6568ec	active	\N	\N	2026-05-29 04:36:41.792362+00	2026-05-29 04:36:41.792362+00	in_app	delivered	none	\N	2026-05-29 04:36:41.738278+00	\N	ops_oversight	sales	sales
76f118dc-856b-4424-b29e-9a57f674ad85	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:9a4f8e0c-b3eb-469f-8a5f-a6b842148815:approved_ready_to_send	medium	Draft siap dikirim	Sudah ada draft approved, tapi pesan final belum dikirim ke customer.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	resolved	\N	2026-05-29 04:32:27.756793+00	2026-05-29 04:31:46.901573+00	2026-05-29 04:32:27.775181+00	in_app	delivered	none	\N	2026-05-29 04:31:46.876312+00	\N	ops_oversight	sales	sales
486bb8e8-e3aa-4d0d-9126-a5b59ba03fe6	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:00762691-36cb-46d1-8e48-466c4a3187be	medium	Approval queue: defa UG	Sales harus responsif dan memberikan informasi detil serta memastikan customer tidak bingung terkait proses administrasi dan lokasi pengambilan, agar mempermudah langkah selanjutnya.	/dashboard/sales/conversations/a3b451c1-a339-4cb5-bfe2-b02fee6568ec	active	\N	\N	2026-05-29 04:36:41.797027+00	2026-05-29 04:36:41.797027+00	in_app	delivered	none	\N	2026-05-29 04:36:41.745643+00	\N	ops_oversight	sales	sales
d3592e64-ed4a-4673-a125-3e7ad9f50375	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:00762691-36cb-46d1-8e48-466c4a3187be	medium	Approval queue: defa UG	Sales harus responsif dan memberikan informasi detil serta memastikan customer tidak bingung terkait proses administrasi dan lokasi pengambilan, agar mempermudah langkah selanjutnya.	/dashboard/sales/conversations/a3b451c1-a339-4cb5-bfe2-b02fee6568ec	active	\N	\N	2026-05-29 04:51:15.340949+00	2026-06-02 01:40:35.603268+00	in_app	delivered	none	\N	2026-05-29 04:51:15.310677+00	\N	admin_review	sales	manager
e8da7de9-6053-4dc5-a0b5-5856107b4d01	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:c994e7d3-0f52-40dd-a456-d68f74c6390a	medium	Approval queue: Customer	Kirim dokumen legalitas resmi dan tawarkan informasi tambahan atau konfirmasi lebih lanjut mengenai program.	/dashboard/sales/conversations/3db559c2-41f6-425c-ada3-e6564da25422	active	\N	\N	2026-05-29 01:36:15.921804+00	2026-06-02 01:40:35.603268+00	in_app	delivered	none	\N	2026-05-29 01:36:15.903859+00	\N	admin_review	sales	manager
40e5e323-6b88-4ca3-9241-bc3d43879cd9	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:f2ea889d-069d-4ee7-b58d-0144508999b4:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-05-29 06:45:50.325518+00	2026-05-29 04:36:41.797019+00	2026-05-29 06:45:50.377529+00	in_app	delivered	none	\N	2026-05-29 04:36:41.745643+00	\N	ops_oversight	sales	sales
5c81e245-0583-4a8d-9a0c-1ec492c785f6	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:f2ea889d-069d-4ee7-b58d-0144508999b4:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-05-29 06:45:50.325518+00	2026-05-29 04:36:41.792358+00	2026-05-29 06:45:50.377531+00	in_app	delivered	none	\N	2026-05-29 04:36:41.738278+00	\N	ops_oversight	sales	sales
7ac4ff83-c8b3-41af-bdd9-99f9e36def80	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:f2ea889d-069d-4ee7-b58d-0144508999b4:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-05-29 06:45:50.325518+00	2026-05-29 04:51:15.340945+00	2026-05-29 06:45:50.377531+00	in_app	delivered	none	\N	2026-05-29 04:51:15.310677+00	\N	ops_oversight	sales	sales
d3bcad88-825d-4d33-91a5-6fc4c8ca3f2d	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:5e8be481-3a05-4309-9e62-b968ce50bbf1	medium	Approval queue: Ara≡ƒÆò	Memberikan dukungan emosional dan menjaga komunikasi hangat tanpa memaksakan penawaran produk.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	resolved	\N	2026-05-29 05:50:24.702211+00	2026-05-29 05:49:38.116128+00	2026-05-29 05:50:24.723234+00	in_app	delivered	none	\N	2026-05-29 05:49:38.095715+00	\N	ops_oversight	sales	sales
944620da-ca2d-45a3-b08b-44f466bb052a	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:d4b97c2d-2cd0-4239-8c31-44f7feaa2d93	medium	Approval queue: CIMB Niaga	Tanyakan secara sopan apakah customer memerlukan informasi lebih lanjut atau bantuan terkait promo yang disebutkan.	/dashboard/sales/conversations/67343055-cd9f-4943-abcd-0016838210cd	active	\N	\N	2026-05-29 05:57:40.180011+00	2026-05-29 05:57:40.180011+00	in_app	delivered	none	\N	2026-05-29 05:57:40.120073+00	\N	ops_oversight	sales	sales
3fa8dc5b-12f1-4ba6-a35d-53dc6c4dbd15	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:50865d10-abb2-4c9d-91d5-63260857be10:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/b7191080-f685-4c04-b8a5-e7a48caeb188	resolved	\N	2026-06-02 01:56:09.426902+00	2026-05-29 06:39:35.473905+00	2026-06-02 01:56:09.502686+00	in_app	delivered	none	\N	2026-05-29 06:39:35.322863+00	\N	ops_oversight	sales	sales
25deab2c-86c5-41d4-ac5b-95d531f22003	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/338c6c5d-108e-4674-9b34-cb25ec5c3ca4	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 06:39:35.473902+00	2026-06-02 06:27:51.525386+00	in_app	delivered	none	\N	2026-05-29 06:39:35.322863+00	\N	ops_oversight	sales	sales
e0de88b7-e782-4ceb-ae1a-26d009a4de26	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:287ac016-6306-4b20-a122-e8fe6b0e58e8:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/00b27ccd-7a35-4f49-a42b-cabce1a618d6	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 05:57:40.180007+00	2026-06-02 06:27:51.525391+00	in_app	delivered	none	\N	2026-05-29 05:57:40.120073+00	\N	ops_oversight	sales	sales
5bb4efda-c293-4e93-a260-928b310c6e39	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:eeea76e3-82e2-4f60-bd42-c113a261e100	medium	Approval queue: Yavin UG	Berikan penjelasan lebih jelas tentang produk dan keunggulannya, serta tanyakan kebutuhan atau masalah yang ingin diselesaikan customer untuk meningkatkan minat.	/dashboard/sales/conversations/59f1578d-d6a6-47a6-9950-541c2659e2f1	active	\N	\N	2026-05-29 06:39:35.473907+00	2026-05-29 06:39:35.473908+00	in_app	delivered	none	\N	2026-05-29 06:39:35.322863+00	\N	ops_oversight	sales	sales
48eae309-1c64-4c44-87a8-d3383808f1d5	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:f1c6e74f-b2ad-46d4-997a-404fbd1a7abf	medium	Approval queue: Kak Nita NM23	Melanjutkan dengan pertanyaan lebih spesifik tentang kebutuhan customer untuk membuka percakapan lebih lanjut.	/dashboard/sales/conversations/f9dfb897-7af0-4890-b51d-d3e4735f4ea4	active	\N	\N	2026-05-29 06:39:35.473909+00	2026-05-29 06:39:35.473909+00	in_app	delivered	none	\N	2026-05-29 06:39:35.322863+00	\N	ops_oversight	sales	sales
c7b1cd46-924d-402f-b111-b28a6dc1b13e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:f43c0e8e-8b5c-46bc-abaa-c664e27cb56e	medium	Approval queue: IT DEV Newsmaker23	Berikan penjelasan detail mengenai keamanan layanan dan proses perpindahan agar customer merasa yakin dan dapat melangkah ke tahap edukasi atau closing.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	active	\N	\N	2026-05-29 06:39:35.47391+00	2026-05-29 06:39:35.47391+00	in_app	delivered	none	\N	2026-05-29 06:39:35.322863+00	\N	ops_oversight	sales	sales
ccd9beb5-2853-4341-84d5-502b97c0d457	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:5f9fe310-bc8d-4609-bb07-e4a0190e8650	medium	Approval queue: Ara≡ƒÆò	Fokus pada membina hubungan personal dan memberikan dukungan emosional. Tunda pendekatan penjualan hingga kondisi customer lebih kondusif.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	active	\N	\N	2026-05-29 06:39:35.473912+00	2026-05-29 06:39:35.473912+00	in_app	delivered	none	\N	2026-05-29 06:39:35.322863+00	\N	ops_oversight	sales	sales
49ffa3e1-7b8e-41fd-9cc9-21ff27b8baee	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:eeea76e3-82e2-4f60-bd42-c113a261e100	medium	Approval queue: Yavin UG	Berikan penjelasan lebih jelas tentang produk dan keunggulannya, serta tanyakan kebutuhan atau masalah yang ingin diselesaikan customer untuk meningkatkan minat.	/dashboard/sales/conversations/59f1578d-d6a6-47a6-9950-541c2659e2f1	active	\N	\N	2026-05-29 06:39:35.466517+00	2026-05-29 06:39:35.466517+00	in_app	delivered	none	\N	2026-05-29 06:39:35.311127+00	\N	ops_oversight	sales	sales
a750ada0-ca15-4054-a190-93387087af13	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:f1c6e74f-b2ad-46d4-997a-404fbd1a7abf	medium	Approval queue: Kak Nita NM23	Melanjutkan dengan pertanyaan lebih spesifik tentang kebutuhan customer untuk membuka percakapan lebih lanjut.	/dashboard/sales/conversations/f9dfb897-7af0-4890-b51d-d3e4735f4ea4	active	\N	\N	2026-05-29 06:39:35.466519+00	2026-05-29 06:39:35.466519+00	in_app	delivered	none	\N	2026-05-29 06:39:35.311127+00	\N	ops_oversight	sales	sales
8ce05a40-6daf-4862-a47d-e008afbaee9f	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:f43c0e8e-8b5c-46bc-abaa-c664e27cb56e	medium	Approval queue: IT DEV Newsmaker23	Berikan penjelasan detail mengenai keamanan layanan dan proses perpindahan agar customer merasa yakin dan dapat melangkah ke tahap edukasi atau closing.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	active	\N	\N	2026-05-29 06:39:35.46652+00	2026-05-29 06:39:35.466521+00	in_app	delivered	none	\N	2026-05-29 06:39:35.311127+00	\N	ops_oversight	sales	sales
29501eeb-debf-4b0d-ac23-6889cb00937e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:5f9fe310-bc8d-4609-bb07-e4a0190e8650	medium	Approval queue: Ara≡ƒÆò	Fokus pada membina hubungan personal dan memberikan dukungan emosional. Tunda pendekatan penjualan hingga kondisi customer lebih kondusif.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	active	\N	\N	2026-05-29 06:39:35.466522+00	2026-05-29 06:39:35.466522+00	in_app	delivered	none	\N	2026-05-29 06:39:35.311127+00	\N	ops_oversight	sales	sales
3a0fb02a-71f6-4d85-81a0-0b4c6c5f5b1c	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:447c6eee-9c8c-40c1-ba5a-caeb4e3f6a43	medium	Approval queue: Kak Nita NM23	Menindaklanjuti dengan pertanyaan ringan yang relevan untuk membangun hubungan, tanpa memaksa penawaran.	/dashboard/sales/conversations/f9dfb897-7af0-4890-b51d-d3e4735f4ea4	resolved	\N	2026-05-29 06:39:35.405887+00	2026-05-29 05:57:40.180015+00	2026-05-29 06:39:35.460048+00	in_app	delivered	none	\N	2026-05-29 05:57:40.120073+00	\N	ops_oversight	sales	sales
59853e0e-558a-49ab-b3a1-6bc8f32b33ef	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:e69f587a-cb60-4fdb-acc2-cb62bbbb8873	medium	Approval queue: Yavin UG	Membangun komunikasi yang lebih menarik dan memberikan informasi produk dengan cara mudah dipahami untuk menggugah minat customer.	/dashboard/sales/conversations/59f1578d-d6a6-47a6-9950-541c2659e2f1	resolved	\N	2026-05-29 06:39:35.405887+00	2026-05-29 05:57:40.180013+00	2026-05-29 06:39:35.46005+00	in_app	delivered	none	\N	2026-05-29 05:57:40.120073+00	\N	ops_oversight	sales	sales
ca9eef88-7236-44a7-86a7-7790b5308cfe	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:eeea76e3-82e2-4f60-bd42-c113a261e100	medium	Approval queue: Yavin UG	Berikan penjelasan lebih jelas tentang produk dan keunggulannya, serta tanyakan kebutuhan atau masalah yang ingin diselesaikan customer untuk meningkatkan minat.	/dashboard/sales/conversations/59f1578d-d6a6-47a6-9950-541c2659e2f1	active	\N	\N	2026-05-29 06:39:35.494337+00	2026-05-29 06:39:35.494338+00	in_app	delivered	none	\N	2026-05-29 06:39:35.375458+00	\N	ops_oversight	sales	sales
608aa6e3-2f48-4728-bf49-31244554d59d	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:f0f609f4-9795-473b-8d86-8434e4ef0bd1	medium	Approval queue: Mas Arya NM23	Berikan penjelasan detail mengenai aspek keamanan dan proses perpindahan agar pelanggan semakin yakin, kemudian tawarkan opsi langkah selanjutnya.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-05-29 06:39:35.405887+00	2026-05-29 04:51:15.340951+00	2026-05-29 06:39:35.460051+00	in_app	delivered	none	\N	2026-05-29 04:51:15.310677+00	\N	ops_oversight	sales	sales
872feb3e-8edd-4df8-bd12-8e8784a06a46	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:f0f609f4-9795-473b-8d86-8434e4ef0bd1	medium	Approval queue: Mas Arya NM23	Berikan penjelasan detail mengenai aspek keamanan dan proses perpindahan agar pelanggan semakin yakin, kemudian tawarkan opsi langkah selanjutnya.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-05-29 06:39:35.405887+00	2026-05-29 04:36:41.792364+00	2026-05-29 06:39:35.460051+00	in_app	delivered	none	\N	2026-05-29 04:36:41.738278+00	\N	ops_oversight	sales	sales
008e0800-0d74-4b55-8c5a-7bdc66912659	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:50865d10-abb2-4c9d-91d5-63260857be10:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/b7191080-f685-4c04-b8a5-e7a48caeb188	resolved	\N	2026-06-02 01:56:09.426902+00	2026-05-29 06:39:35.494335+00	2026-06-02 01:56:09.502684+00	in_app	delivered	none	\N	2026-05-29 06:39:35.375458+00	\N	ops_oversight	sales	sales
976acf10-c6b8-484d-a0e9-bd74a06f84af	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:50865d10-abb2-4c9d-91d5-63260857be10:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/b7191080-f685-4c04-b8a5-e7a48caeb188	resolved	\N	2026-06-02 01:56:09.426902+00	2026-05-29 06:39:35.466515+00	2026-06-02 01:56:09.502686+00	in_app	delivered	none	\N	2026-05-29 06:39:35.311127+00	\N	ops_oversight	sales	sales
bee82c79-9d83-4f1a-9c5d-c03698ba23ba	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/338c6c5d-108e-4674-9b34-cb25ec5c3ca4	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 06:39:35.494329+00	2026-06-02 06:27:51.525389+00	in_app	delivered	none	\N	2026-05-29 06:39:35.375458+00	\N	ops_oversight	sales	sales
c1d1cc19-402f-42f2-b751-7a3e35fa637b	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/338c6c5d-108e-4674-9b34-cb25ec5c3ca4	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 06:39:35.466512+00	2026-06-02 06:27:51.52539+00	in_app	delivered	none	\N	2026-05-29 06:39:35.311127+00	\N	ops_oversight	sales	sales
e379fd14-d61a-4ad8-9de0-2d142b289a18	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:f1c6e74f-b2ad-46d4-997a-404fbd1a7abf	medium	Approval queue: Kak Nita NM23	Melanjutkan dengan pertanyaan lebih spesifik tentang kebutuhan customer untuk membuka percakapan lebih lanjut.	/dashboard/sales/conversations/f9dfb897-7af0-4890-b51d-d3e4735f4ea4	active	\N	\N	2026-05-29 06:39:35.494339+00	2026-05-29 06:39:35.49434+00	in_app	delivered	none	\N	2026-05-29 06:39:35.375458+00	\N	ops_oversight	sales	sales
4497c3ca-aaf1-47c4-87ce-09cc4f0a260e	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:f43c0e8e-8b5c-46bc-abaa-c664e27cb56e	medium	Approval queue: IT DEV Newsmaker23	Berikan penjelasan detail mengenai keamanan layanan dan proses perpindahan agar customer merasa yakin dan dapat melangkah ke tahap edukasi atau closing.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	active	\N	\N	2026-05-29 06:39:35.494341+00	2026-05-29 06:39:35.494342+00	in_app	delivered	none	\N	2026-05-29 06:39:35.375458+00	\N	ops_oversight	sales	sales
b5ce1004-a8fa-43c9-a28c-7f4a04704f27	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:5f9fe310-bc8d-4609-bb07-e4a0190e8650	medium	Approval queue: Ara≡ƒÆò	Fokus pada membina hubungan personal dan memberikan dukungan emosional. Tunda pendekatan penjualan hingga kondisi customer lebih kondusif.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	active	\N	\N	2026-05-29 06:39:35.494343+00	2026-05-29 06:39:35.494343+00	in_app	delivered	none	\N	2026-05-29 06:39:35.375458+00	\N	ops_oversight	sales	sales
91284086-4056-48cf-a8cf-b6bdb54ce3db	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:bf801e3e-988a-494c-bb59-ea20f9671c00	medium	Approval queue: Ara≡ƒÆò	Fokus pada dukungan empati dan bangun hubungan kepercayaan sebelum mencoba menawarkan sesuatu lebih lanjut.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	resolved	\N	2026-05-29 06:39:35.405887+00	2026-05-29 05:57:40.180016+00	2026-05-29 06:39:35.460052+00	in_app	delivered	none	\N	2026-05-29 05:57:40.120073+00	\N	ops_oversight	sales	sales
a46fe3f6-0087-476b-a760-6f8dba57aa89	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:f0f609f4-9795-473b-8d86-8434e4ef0bd1	medium	Approval queue: Mas Arya NM23	Berikan penjelasan detail mengenai aspek keamanan dan proses perpindahan agar pelanggan semakin yakin, kemudian tawarkan opsi langkah selanjutnya.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-05-29 06:39:35.405887+00	2026-05-29 04:36:41.79703+00	2026-05-29 06:39:35.460052+00	in_app	delivered	none	\N	2026-05-29 04:36:41.745643+00	\N	ops_oversight	sales	sales
e88874cd-0da4-4294-8e09-b5bc40991e2f	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:eeea76e3-82e2-4f60-bd42-c113a261e100	medium	Approval queue: Yavin UG	Berikan penjelasan lebih jelas tentang produk dan keunggulannya, serta tanyakan kebutuhan atau masalah yang ingin diselesaikan customer untuk meningkatkan minat.	/dashboard/sales/conversations/59f1578d-d6a6-47a6-9950-541c2659e2f1	active	\N	\N	2026-05-29 06:39:35.502969+00	2026-05-29 06:39:35.50297+00	in_app	delivered	none	\N	2026-05-29 06:39:35.405887+00	\N	ops_oversight	sales	sales
e365cc9e-86aa-44c0-b2cd-ef4e33d0352f	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:f1c6e74f-b2ad-46d4-997a-404fbd1a7abf	medium	Approval queue: Kak Nita NM23	Melanjutkan dengan pertanyaan lebih spesifik tentang kebutuhan customer untuk membuka percakapan lebih lanjut.	/dashboard/sales/conversations/f9dfb897-7af0-4890-b51d-d3e4735f4ea4	active	\N	\N	2026-05-29 06:39:35.502971+00	2026-05-29 06:39:35.502971+00	in_app	delivered	none	\N	2026-05-29 06:39:35.405887+00	\N	ops_oversight	sales	sales
18aca901-d504-4908-b5c4-03319d989d5d	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:5f9fe310-bc8d-4609-bb07-e4a0190e8650	medium	Approval queue: Ara≡ƒÆò	Fokus pada membina hubungan personal dan memberikan dukungan emosional. Tunda pendekatan penjualan hingga kondisi customer lebih kondusif.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	active	\N	\N	2026-05-29 06:39:35.502974+00	2026-05-29 06:39:35.502974+00	in_app	delivered	none	\N	2026-05-29 06:39:35.405887+00	\N	ops_oversight	sales	sales
6f709c7a-c229-49e8-b8af-192e6adf544f	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	approval_queue	approval:f43c0e8e-8b5c-46bc-abaa-c664e27cb56e	medium	Approval queue: IT DEV Newsmaker23	Berikan penjelasan detail mengenai keamanan layanan dan proses perpindahan agar customer merasa yakin dan dapat melangkah ke tahap edukasi atau closing.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	active	\N	\N	2026-05-29 06:39:35.502972+00	2026-05-29 06:46:32.031941+00	in_app	delivered	none	\N	2026-05-29 06:39:35.405887+00	\N	ops_oversight	sales	sales
a6946a85-d8eb-4f4b-93d5-f6b6bdea102b	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:50865d10-abb2-4c9d-91d5-63260857be10:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/b7191080-f685-4c04-b8a5-e7a48caeb188	resolved	\N	2026-06-02 01:56:09.426902+00	2026-05-29 06:39:35.502967+00	2026-06-02 01:56:09.502687+00	in_app	delivered	none	\N	2026-05-29 06:39:35.405887+00	\N	ops_oversight	sales	sales
ec811130-06c4-47af-b8e6-1d5e335bbc99	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:50865d10-abb2-4c9d-91d5-63260857be10:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/b7191080-f685-4c04-b8a5-e7a48caeb188	resolved	\N	2026-06-02 01:56:09.426902+00	2026-05-29 07:12:39.435111+00	2026-06-02 01:56:09.502687+00	in_app	delivered	none	\N	2026-05-29 07:12:39.29115+00	\N	ops_oversight	sales	sales
01002a45-f78c-4a6f-8314-2f870e0ef28c	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:f2ea889d-069d-4ee7-b58d-0144508999b4:overdue_follow_up	high	Follow up overdue	Lead ini sudah melewati jadwal follow-up yang ditentukan.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 06:45:50.414202+00	2026-06-02 06:27:51.525385+00	in_app	delivered	none	\N	2026-05-29 06:45:50.317105+00	\N	ops_oversight	sales	sales
8ee1204e-8597-4727-b160-dfa8b2052152	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/338c6c5d-108e-4674-9b34-cb25ec5c3ca4	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 06:39:35.502964+00	2026-06-02 06:27:51.525387+00	in_app	delivered	none	\N	2026-05-29 06:39:35.405887+00	\N	ops_oversight	sales	sales
a84fed65-700d-4b9c-b6c9-8794e6c0bb96	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:f2ea889d-069d-4ee7-b58d-0144508999b4:overdue_follow_up	high	Follow up overdue	Lead ini sudah melewati jadwal follow-up yang ditentukan.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 06:45:50.427263+00	2026-06-02 06:27:51.525388+00	in_app	delivered	none	\N	2026-05-29 06:45:50.325518+00	\N	ops_oversight	sales	sales
372c2e04-51ee-40b2-aa13-e2bec7aaef53	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:eeea76e3-82e2-4f60-bd42-c113a261e100	medium	Approval queue: Yavin UG	Berikan penjelasan lebih jelas tentang produk dan keunggulannya, serta tanyakan kebutuhan atau masalah yang ingin diselesaikan customer untuk meningkatkan minat.	/dashboard/sales/conversations/59f1578d-d6a6-47a6-9950-541c2659e2f1	active	\N	\N	2026-05-29 07:12:39.435114+00	2026-05-29 07:12:39.435114+00	in_app	delivered	none	\N	2026-05-29 07:12:39.29115+00	\N	ops_oversight	sales	sales
ead0ca4e-bc06-408a-8b40-9b3da1a10ae4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:f1c6e74f-b2ad-46d4-997a-404fbd1a7abf	medium	Approval queue: Kak Nita NM23	Melanjutkan dengan pertanyaan lebih spesifik tentang kebutuhan customer untuk membuka percakapan lebih lanjut.	/dashboard/sales/conversations/f9dfb897-7af0-4890-b51d-d3e4735f4ea4	active	\N	\N	2026-05-29 07:12:39.435115+00	2026-05-29 07:12:39.435116+00	in_app	delivered	none	\N	2026-05-29 07:12:39.29115+00	\N	ops_oversight	sales	sales
fc777994-f562-4b89-a987-1aa930c5e2f8	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:f43c0e8e-8b5c-46bc-abaa-c664e27cb56e	medium	Approval queue: IT DEV Newsmaker23	Berikan penjelasan detail mengenai keamanan layanan dan proses perpindahan agar customer merasa yakin dan dapat melangkah ke tahap edukasi atau closing.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	active	\N	\N	2026-05-29 07:12:39.435117+00	2026-05-29 07:12:39.435117+00	in_app	delivered	none	\N	2026-05-29 07:12:39.29115+00	\N	ops_oversight	sales	sales
c413fb0b-014f-4ebd-a8ab-f44ebc304903	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:5f9fe310-bc8d-4609-bb07-e4a0190e8650	medium	Approval queue: Ara≡ƒÆò	Fokus pada membina hubungan personal dan memberikan dukungan emosional. Tunda pendekatan penjualan hingga kondisi customer lebih kondusif.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	active	\N	\N	2026-05-29 07:12:39.435119+00	2026-05-29 07:12:39.435119+00	in_app	delivered	none	\N	2026-05-29 07:12:39.29115+00	\N	ops_oversight	sales	sales
d61f11ec-d049-42bf-a528-a0c18e874357	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:d4b97c2d-2cd0-4239-8c31-44f7feaa2d93	medium	Approval queue: CIMB Niaga	Tanyakan secara sopan apakah customer memerlukan informasi lebih lanjut atau bantuan terkait promo yang disebutkan.	/dashboard/sales/conversations/67343055-cd9f-4943-abcd-0016838210cd	active	\N	\N	2026-05-29 07:12:39.43512+00	2026-05-29 07:12:39.43512+00	in_app	delivered	none	\N	2026-05-29 07:12:39.29115+00	\N	ops_oversight	sales	sales
40bdc83d-75f6-4fb4-bb3e-f2559e4d8106	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:f1c6e74f-b2ad-46d4-997a-404fbd1a7abf	medium	Approval queue: Kak Nita NM23	Melanjutkan dengan pertanyaan lebih spesifik tentang kebutuhan customer untuk membuka percakapan lebih lanjut.	/dashboard/sales/conversations/f9dfb897-7af0-4890-b51d-d3e4735f4ea4	active	\N	\N	2026-05-29 07:12:39.464301+00	2026-06-02 01:40:35.527401+00	in_app	delivered	none	\N	2026-05-29 07:12:39.352462+00	\N	admin_review	sales	manager
52b2d279-ba82-4f3c-b930-540e528c32d7	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:f43c0e8e-8b5c-46bc-abaa-c664e27cb56e	medium	Approval queue: IT DEV Newsmaker23	Berikan penjelasan detail mengenai keamanan layanan dan proses perpindahan agar customer merasa yakin dan dapat melangkah ke tahap edukasi atau closing.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	active	\N	\N	2026-05-29 07:12:39.464303+00	2026-06-02 01:40:35.527402+00	in_app	delivered	none	\N	2026-05-29 07:12:39.352462+00	\N	admin_review	sales	manager
846359f2-da43-4c0c-8ac6-a424592dfd2f	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:f2ea889d-069d-4ee7-b58d-0144508999b4:overdue_follow_up	high	Follow up overdue	Lead ini sudah melewati jadwal follow-up yang ditentukan.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 07:12:39.464291+00	2026-06-02 06:27:51.525387+00	in_app	delivered	superadmin	\N	2026-05-29 07:12:39.352462+00	2026-06-02 01:40:35.455405+00	head_follow_up	sales	head
1470fe69-8ccc-4802-a89c-bfd8c0e91918	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:eeea76e3-82e2-4f60-bd42-c113a261e100	medium	Approval queue: Yavin UG	Berikan penjelasan lebih jelas tentang produk dan keunggulannya, serta tanyakan kebutuhan atau masalah yang ingin diselesaikan customer untuk meningkatkan minat.	/dashboard/sales/conversations/59f1578d-d6a6-47a6-9950-541c2659e2f1	active	\N	\N	2026-05-29 07:12:39.4643+00	2026-06-02 01:40:35.527397+00	in_app	delivered	none	\N	2026-05-29 07:12:39.352462+00	\N	admin_review	sales	manager
a9b245f4-d7aa-4d3f-b58d-d4a011bc9d55	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:5f9fe310-bc8d-4609-bb07-e4a0190e8650	medium	Approval queue: Ara≡ƒÆò	Fokus pada membina hubungan personal dan memberikan dukungan emosional. Tunda pendekatan penjualan hingga kondisi customer lebih kondusif.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	active	\N	\N	2026-05-29 07:12:39.464305+00	2026-06-02 01:40:35.603266+00	in_app	delivered	none	\N	2026-05-29 07:12:39.352462+00	\N	admin_review	sales	manager
f0fb1c41-b4dc-4a07-9fa3-16e18ab0fcc3	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	approval_queue	approval:d4b97c2d-2cd0-4239-8c31-44f7feaa2d93	medium	Approval queue: CIMB Niaga	Tanyakan secara sopan apakah customer memerlukan informasi lebih lanjut atau bantuan terkait promo yang disebutkan.	/dashboard/sales/conversations/67343055-cd9f-4943-abcd-0016838210cd	active	\N	\N	2026-05-29 07:12:39.464307+00	2026-06-02 01:40:35.603269+00	in_app	delivered	none	\N	2026-05-29 07:12:39.352462+00	\N	admin_review	sales	manager
aff7288f-63a5-42c5-9497-985ef9603f73	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	3c94e3d2-fb01-470a-a45c-7b00be2d208e	sales_worklist	worklist:dfe2465b-b9db-41c8-a43b-386ee3819955:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/a1f51fee-463c-4356-b702-9f6555241c18	resolved	2026-06-02 03:53:44.675597+00	2026-06-02 04:29:33.957616+00	2026-06-02 02:56:26.290902+00	2026-06-02 04:29:33.967978+00	in_app	delivered	none	\N	2026-06-02 02:56:26.256466+00	\N	head_follow_up	sales	head
f4224bc7-9741-4f28-bb45-f113fc86ca63	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:50865d10-abb2-4c9d-91d5-63260857be10:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/b7191080-f685-4c04-b8a5-e7a48caeb188	resolved	\N	2026-06-02 01:56:09.426902+00	2026-05-29 07:12:39.464297+00	2026-06-02 01:56:09.502688+00	in_app	delivered	none	\N	2026-05-29 07:12:39.352462+00	\N	head_follow_up	sales	head
5a86d964-d7fb-43bb-8fe4-a766f373f2f4	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:eeea76e3-82e2-4f60-bd42-c113a261e100	medium	Approval queue: Yavin UG	Berikan penjelasan lebih jelas tentang produk dan keunggulannya, serta tanyakan kebutuhan atau masalah yang ingin diselesaikan customer untuk meningkatkan minat.	/dashboard/sales/conversations/59f1578d-d6a6-47a6-9950-541c2659e2f1	active	\N	\N	2026-06-02 03:59:31.782106+00	2026-06-02 03:59:31.782107+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	admin_review	sales	manager
70005e45-b9d6-46d4-9225-f604f177ffd6	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:f1c6e74f-b2ad-46d4-997a-404fbd1a7abf	medium	Approval queue: Kak Nita NM23	Melanjutkan dengan pertanyaan lebih spesifik tentang kebutuhan customer untuk membuka percakapan lebih lanjut.	/dashboard/sales/conversations/f9dfb897-7af0-4890-b51d-d3e4735f4ea4	active	\N	\N	2026-06-02 03:59:31.782108+00	2026-06-02 03:59:31.782108+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	admin_review	sales	manager
330ffa31-713d-4174-aece-9c367d66fac3	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	sales_worklist	worklist:5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/338c6c5d-108e-4674-9b34-cb25ec5c3ca4	resolved	\N	2026-06-02 04:11:24.85487+00	2026-06-02 03:59:31.782103+00	2026-06-02 04:11:24.871341+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	head_follow_up	sales	head
5397c30e-963e-4c7b-9f1e-99bc951e0299	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	sales_worklist	worklist:f2ea889d-069d-4ee7-b58d-0144508999b4:overdue_follow_up	high	Follow up overdue	Lead ini sudah melewati jadwal follow-up yang ditentukan.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-06-02 04:11:24.85487+00	2026-06-02 03:59:31.782094+00	2026-06-02 04:11:24.871344+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	head_follow_up	sales	head
a57ba9e4-4bb6-47d0-8a6f-190aefddc282	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	sales_worklist	worklist:dfe2465b-b9db-41c8-a43b-386ee3819955:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/a1f51fee-463c-4356-b702-9f6555241c18	resolved	\N	2026-06-02 04:11:24.85487+00	2026-06-02 03:59:31.782101+00	2026-06-02 04:11:24.871345+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	head_follow_up	sales	head
bb6edc4e-7138-4801-b67a-35ed1fc9aa14	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	sales_worklist	worklist:287ac016-6306-4b20-a122-e8fe6b0e58e8:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/00b27ccd-7a35-4f49-a42b-cabce1a618d6	resolved	\N	2026-06-02 04:11:24.85487+00	2026-06-02 03:59:31.782105+00	2026-06-02 04:11:24.871346+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	head_follow_up	sales	head
9925ad23-b265-4214-ac76-9345398bb92f	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:287ac016-6306-4b20-a122-e8fe6b0e58e8:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/00b27ccd-7a35-4f49-a42b-cabce1a618d6	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 07:12:39.464298+00	2026-06-02 06:27:51.525388+00	in_app	delivered	none	\N	2026-05-29 07:12:39.352462+00	\N	head_follow_up	sales	head
9ffb15d8-a15e-4917-b1bd-ab917a0080f3	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N	sales_worklist	worklist:dfe2465b-b9db-41c8-a43b-386ee3819955:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/a1f51fee-463c-4356-b702-9f6555241c18	resolved	\N	2026-06-02 06:27:51.491331+00	2026-06-02 02:55:29.171865+00	2026-06-02 06:27:51.525388+00	in_app	delivered	none	\N	2026-06-02 02:55:29.000065+00	\N	head_follow_up	sales	head
bb143e07-8ed9-476d-af8e-5a5ddd4ac0d0	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/338c6c5d-108e-4674-9b34-cb25ec5c3ca4	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 07:12:39.464295+00	2026-06-02 06:27:51.525389+00	in_app	delivered	none	\N	2026-05-29 07:12:39.352462+00	\N	head_follow_up	sales	head
2cbb62cd-6ef4-49e3-9366-4353419673aa	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:f43c0e8e-8b5c-46bc-abaa-c664e27cb56e	medium	Approval queue: IT DEV Newsmaker23	Berikan penjelasan detail mengenai keamanan layanan dan proses perpindahan agar customer merasa yakin dan dapat melangkah ke tahap edukasi atau closing.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	active	\N	\N	2026-06-02 03:59:31.78211+00	2026-06-02 03:59:31.78211+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	admin_review	sales	manager
1dfde39b-16fd-48d1-9712-8a8d22b2ae11	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:5f9fe310-bc8d-4609-bb07-e4a0190e8650	medium	Approval queue: Ara≡ƒÆò	Fokus pada membina hubungan personal dan memberikan dukungan emosional. Tunda pendekatan penjualan hingga kondisi customer lebih kondusif.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	active	\N	\N	2026-06-02 03:59:31.782111+00	2026-06-02 03:59:31.782111+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	admin_review	sales	manager
d9207db7-ba49-424c-b0e8-5e4a21f3a5d0	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:d4b97c2d-2cd0-4239-8c31-44f7feaa2d93	medium	Approval queue: CIMB Niaga	Tanyakan secara sopan apakah customer memerlukan informasi lebih lanjut atau bantuan terkait promo yang disebutkan.	/dashboard/sales/conversations/67343055-cd9f-4943-abcd-0016838210cd	active	\N	\N	2026-06-02 03:59:31.782113+00	2026-06-02 03:59:31.782113+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	admin_review	sales	manager
33f9ceba-d12b-4455-abd1-569f8555a3dc	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:00762691-36cb-46d1-8e48-466c4a3187be	medium	Approval queue: defa UG	Sales harus responsif dan memberikan informasi detil serta memastikan customer tidak bingung terkait proses administrasi dan lokasi pengambilan, agar mempermudah langkah selanjutnya.	/dashboard/sales/conversations/a3b451c1-a339-4cb5-bfe2-b02fee6568ec	active	\N	\N	2026-06-02 03:59:31.782114+00	2026-06-02 03:59:31.782115+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	admin_review	sales	manager
80970f7a-5c27-4643-a71b-7cd7e03d7061	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:c994e7d3-0f52-40dd-a456-d68f74c6390a	medium	Approval queue: Customer	Kirim dokumen legalitas resmi dan tawarkan informasi tambahan atau konfirmasi lebih lanjut mengenai program.	/dashboard/sales/conversations/3db559c2-41f6-425c-ada3-e6564da25422	active	\N	\N	2026-06-02 03:59:31.782116+00	2026-06-02 03:59:31.782116+00	in_app	delivered	none	\N	2026-06-02 03:59:31.657141+00	\N	admin_review	sales	manager
3c5d33c3-ec55-442c-91ed-ef66a6c9b824	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:eeea76e3-82e2-4f60-bd42-c113a261e100	medium	Approval queue: Yavin UG	Berikan penjelasan lebih jelas tentang produk dan keunggulannya, serta tanyakan kebutuhan atau masalah yang ingin diselesaikan customer untuk meningkatkan minat.	/dashboard/sales/conversations/59f1578d-d6a6-47a6-9950-541c2659e2f1	active	\N	\N	2026-06-02 03:59:31.798675+00	2026-06-02 03:59:31.798675+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	admin_review	sales	manager
b9a6d55b-03dc-41c3-b339-a7af084de07a	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:f1c6e74f-b2ad-46d4-997a-404fbd1a7abf	medium	Approval queue: Kak Nita NM23	Melanjutkan dengan pertanyaan lebih spesifik tentang kebutuhan customer untuk membuka percakapan lebih lanjut.	/dashboard/sales/conversations/f9dfb897-7af0-4890-b51d-d3e4735f4ea4	active	\N	\N	2026-06-02 03:59:31.798677+00	2026-06-02 03:59:31.798678+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	admin_review	sales	manager
1ee7afc2-cb9e-414d-92fc-c1dbe7bd6e07	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:f43c0e8e-8b5c-46bc-abaa-c664e27cb56e	medium	Approval queue: IT DEV Newsmaker23	Berikan penjelasan detail mengenai keamanan layanan dan proses perpindahan agar customer merasa yakin dan dapat melangkah ke tahap edukasi atau closing.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	active	\N	\N	2026-06-02 03:59:31.79868+00	2026-06-02 03:59:31.79868+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	admin_review	sales	manager
0046f4bc-cb87-4b83-8e60-01e70b63160a	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:5f9fe310-bc8d-4609-bb07-e4a0190e8650	medium	Approval queue: Ara≡ƒÆò	Fokus pada membina hubungan personal dan memberikan dukungan emosional. Tunda pendekatan penjualan hingga kondisi customer lebih kondusif.	/dashboard/sales/conversations/d8dc1bef-c282-4bcd-9468-19b12d65bc90	active	\N	\N	2026-06-02 03:59:31.798682+00	2026-06-02 03:59:31.798683+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	admin_review	sales	manager
9bf5a81d-da9d-4a70-8456-e23c1e4c5a94	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:d4b97c2d-2cd0-4239-8c31-44f7feaa2d93	medium	Approval queue: CIMB Niaga	Tanyakan secara sopan apakah customer memerlukan informasi lebih lanjut atau bantuan terkait promo yang disebutkan.	/dashboard/sales/conversations/67343055-cd9f-4943-abcd-0016838210cd	active	\N	\N	2026-06-02 03:59:31.798685+00	2026-06-02 03:59:31.798685+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	admin_review	sales	manager
68daf8a9-ad88-4607-b60a-6ea2d6588050	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:00762691-36cb-46d1-8e48-466c4a3187be	medium	Approval queue: defa UG	Sales harus responsif dan memberikan informasi detil serta memastikan customer tidak bingung terkait proses administrasi dan lokasi pengambilan, agar mempermudah langkah selanjutnya.	/dashboard/sales/conversations/a3b451c1-a339-4cb5-bfe2-b02fee6568ec	active	\N	\N	2026-06-02 03:59:31.798687+00	2026-06-02 03:59:31.798688+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	admin_review	sales	manager
8633bcc7-5268-4cbd-8649-9d92eaada00c	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:c994e7d3-0f52-40dd-a456-d68f74c6390a	medium	Approval queue: Customer	Kirim dokumen legalitas resmi dan tawarkan informasi tambahan atau konfirmasi lebih lanjut mengenai program.	/dashboard/sales/conversations/3db559c2-41f6-425c-ada3-e6564da25422	active	\N	\N	2026-06-02 03:59:31.798689+00	2026-06-02 03:59:31.79869+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	admin_review	sales	manager
1fce9491-846d-410a-a4f8-985093fda100	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	sales_worklist	worklist:dfe2465b-b9db-41c8-a43b-386ee3819955:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/a1f51fee-463c-4356-b702-9f6555241c18	resolved	\N	2026-06-02 04:11:24.85487+00	2026-06-02 03:59:31.798667+00	2026-06-02 04:11:24.871338+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	head_follow_up	sales	head
34ea0dce-ca04-4177-815e-354de0afe891	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	sales_worklist	worklist:287ac016-6306-4b20-a122-e8fe6b0e58e8:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/00b27ccd-7a35-4f49-a42b-cabce1a618d6	resolved	\N	2026-06-02 04:11:24.85487+00	2026-06-02 03:59:31.798672+00	2026-06-02 04:11:24.871342+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	head_follow_up	sales	head
95aa2f95-f306-4851-9d7a-2b7b0757b1a9	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	sales_worklist	worklist:f2ea889d-069d-4ee7-b58d-0144508999b4:overdue_follow_up	high	Follow up overdue	Lead ini sudah melewati jadwal follow-up yang ditentukan.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-06-02 04:11:24.85487+00	2026-06-02 03:59:31.798661+00	2026-06-02 04:11:24.871344+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	head_follow_up	sales	head
9eddf343-35e1-4a69-b891-d5ab5f89fadd	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	sales_worklist	worklist:5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/338c6c5d-108e-4674-9b34-cb25ec5c3ca4	resolved	\N	2026-06-02 04:11:24.85487+00	2026-06-02 03:59:31.79867+00	2026-06-02 04:11:24.871345+00	in_app	delivered	none	\N	2026-06-02 03:59:31.707523+00	\N	head_follow_up	sales	head
90eec227-c7cf-4ae1-a421-0843642bee02	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	3c94e3d2-fb01-470a-a45c-7b00be2d208e	\N	approval_queue	approval:63865216-8488-480a-b093-67944c9d504f	medium	Approval queue: +62 821-7775-7812	Follow up dengan pertanyaan klarifikasi kebutuhan dan tawarkan informasi produk lebih lengkap untuk memperkuat keputusan pembelian.	/dashboard/sales/conversations/a1f51fee-463c-4356-b702-9f6555241c18	active	\N	\N	2026-06-02 05:22:05.317467+00	2026-06-02 05:22:05.317468+00	in_app	delivered	none	\N	2026-06-02 05:22:05.309163+00	\N	admin_review	sales	manager
b0dff5f9-347a-4dce-b925-8337e5393269	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:287ac016-6306-4b20-a122-e8fe6b0e58e8:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/00b27ccd-7a35-4f49-a42b-cabce1a618d6	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 07:12:39.435112+00	2026-06-02 06:27:51.525388+00	in_app	delivered	none	\N	2026-05-29 07:12:39.29115+00	\N	ops_oversight	sales	sales
d1cfc209-0e38-4f8c-b181-bd09207aff0c	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:5e1e9dcf-6e05-47d3-bd0a-a8947027d4c1:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/338c6c5d-108e-4674-9b34-cb25ec5c3ca4	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 07:12:39.435109+00	2026-06-02 06:27:51.52539+00	in_app	delivered	none	\N	2026-05-29 07:12:39.29115+00	\N	ops_oversight	sales	sales
d960a8b8-17d8-4e2b-b04f-715d354e16d6	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	4ecdbaf1-8c3a-4802-80ae-06e50067763f	\N	sales_worklist	worklist:f2ea889d-069d-4ee7-b58d-0144508999b4:overdue_follow_up	high	Follow up overdue	Lead ini sudah melewati jadwal follow-up yang ditentukan.	/dashboard/sales/conversations/93619231-dc0a-4756-9df3-2b824355d3f1	resolved	\N	2026-06-02 06:27:51.491331+00	2026-05-29 07:12:39.435105+00	2026-06-02 06:27:51.525391+00	in_app	delivered	none	\N	2026-05-29 07:12:39.29115+00	\N	ops_oversight	sales	sales
82320bb4-0c6d-45aa-a71a-9b1b73ec507d	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	2dfcc01b-ffc0-4da3-a152-db877f6895ab	\N	sales_worklist	worklist:6ce9423c-714e-49c7-884d-0569eb99b339:needs_analysis	medium	Butuh analisis ulang	Ada balasan customer baru yang belum dibaca ulang oleh AI.	/dashboard/sales/conversations/2a377930-58c3-473f-a9b6-dd56909f54d3	resolved	\N	2026-06-02 06:35:24.717473+00	2026-06-02 06:35:12.44997+00	2026-06-02 06:35:24.763184+00	in_app	delivered	none	\N	2026-06-02 06:35:12.402326+00	\N	cs_follow_up	sales	sales
bf7ee1e0-a10c-487a-9746-af60f6771275	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:63865216-8488-480a-b093-67944c9d504f	medium	Approval queue: +62 821-7775-7812	Follow up dengan pertanyaan klarifikasi kebutuhan dan tawarkan informasi produk lebih lengkap untuk memperkuat keputusan pembelian.	/dashboard/sales/conversations/a1f51fee-463c-4356-b702-9f6555241c18	active	\N	\N	2026-06-02 06:35:42.030171+00	2026-06-02 06:35:42.030172+00	in_app	delivered	none	\N	2026-06-02 06:35:41.997492+00	\N	admin_review	sales	manager
a7c3a5ea-5187-4104-bd00-55ff15a74a29	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	2dfcc01b-ffc0-4da3-a152-db877f6895ab	\N	approval_queue	approval:12765cf7-e660-4cc5-a7f0-f9cfd412dead	medium	Approval queue: Keysha Alea	Menunggu sinyal minat lebih jelas dari customer atau inisiatif customer untuk membahas produk/jasa.	/dashboard/sales/conversations/2a377930-58c3-473f-a9b6-dd56909f54d3	resolved	\N	2026-06-02 06:55:29.040013+00	2026-06-02 06:39:36.287956+00	2026-06-02 06:55:29.0595+00	in_app	delivered	none	\N	2026-06-02 06:39:36.22239+00	\N	admin_review	sales	manager
1156d97e-d525-4f7c-9cff-c9b7e4f818eb	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	2dfcc01b-ffc0-4da3-a152-db877f6895ab	\N	sales_worklist	worklist:6ce9423c-714e-49c7-884d-0569eb99b339:approved_ready_to_send	medium	Draft siap dikirim	Sudah ada draft approved, tapi pesan final belum dikirim ke customer.	/dashboard/sales/conversations/2a377930-58c3-473f-a9b6-dd56909f54d3	resolved	\N	2026-06-02 06:55:35.32931+00	2026-06-02 06:55:29.060074+00	2026-06-02 06:55:35.351844+00	in_app	delivered	none	\N	2026-06-02 06:55:29.040013+00	\N	cs_follow_up	sales	sales
60083fde-8a95-4d7a-aeac-fb5157b5298c	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	50cf0fdc-6cbb-44a8-b50d-0401765ddc89	\N	approval_queue	approval:12765cf7-e660-4cc5-a7f0-f9cfd412dead	medium	Approval queue: Keysha Alea	Menunggu sinyal minat lebih jelas dari customer atau inisiatif customer untuk membahas produk/jasa.	/dashboard/sales/conversations/2a377930-58c3-473f-a9b6-dd56909f54d3	resolved	\N	2026-06-02 06:58:17.586024+00	2026-06-02 06:35:42.030165+00	2026-06-02 06:58:17.605333+00	in_app	delivered	none	\N	2026-06-02 06:35:41.997492+00	\N	admin_review	sales	manager
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.organizations (id, name, slug, created_at) FROM stdin;
6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	SuperAdminOrg	superadmin-local	2026-05-26 02:03:35.16695+00
\.


--
-- Data for Name: product_knowledge; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.product_knowledge (id, organization_id, title, category, content, source_type, is_active, created_at, updated_at, created_by_user_id) FROM stdin;
a0486436-a36a-4435-bd6a-7402f4c36672	\N	Objection Handling	objection_handling	User: takut rugi\nRespon:\n"Wajar kok, hampir semua yang baru mulai pasti kepikiran itu. Justru karena itu biasanya disarankan mulai dari nominal kecil dulu, jadi bisa belajar tanpa tekanan besar."\n\nUser: takut ditipu\nRespon:\n"Make sense kalau ada kekhawatiran ke situ. Makanya penting cek legalitas dan alurnya jelas, biar dari awal sudah ngerti sistemnya seperti apa."\n\nUser: belum paham\nRespon:\n"Justru itu normal di awal. Biasanya nanti dijelasin step by step dulu, jadi nggak dilepas gitu aja."\n\nUser: mahal\nRespon:\n"Kalau dibandingkan, memang bukan yang paling murah. Tapi biasanya fokusnya di pendampingan dan cara mulainya, bukan sekadar masuk aja."\n\nUser: mikir dulu\nRespon:\n"Siap, nggak harus buru-buru juga. Yang penting sudah dapat gambaran dulu, nanti kalau sudah siap baru lanjut."\n\nUser: pernah rugi\nRespon:\n"Biasanya yang pernah rugi justru lebih cepat ngerti kedepannya. Tinggal dibenerin cara mulainya aja biar nggak keulang."\n\nUser: marah / negatif\nRespon:\n"Gapapa, wajar kalau ada pengalaman kurang enak sebelumnya. Justru penting pelan-pelan dulu biar lebih paham sebelum lanjut lagi."	markdown_import	t	2026-05-26 01:53:37.602652+00	2026-05-26 02:03:39.932605+00	ef7c2ccc-3158-49a1-99f8-3550da95eec9
b66a5847-da1c-4654-8cc7-4ff798704f1e	\N	Sales Knowledge Bridge Mini	product_facts	User: ini legal gak?\nJawaban:\n"Untuk legalitasnya sudah masuk pengawasan resmi seperti BAPPEBTI, jadi secara sistem diawasi. Tapi tetap penting dipahami cara kerjanya, bukan hanya lihat legalitas saja."\n\n---\n\nUser: ini aman gak?\nJawaban:\n"Kalau dibilang aman sepenuhnya nggak juga, karena market tetap punya risiko. Makanya biasanya disarankan mulai dari kecil dulu supaya lebih nyaman."\n\n---\n\nUser: sistemnya gimana?\nJawaban:\n"Sistemnya ada alurnya, jadi nggak langsung dilepas. Biasanya dijelaskan step by step dulu sebelum mulai."\n\n---\n\nUser: bisa profit terus?\nJawaban:\n"Nggak ada yang bisa jamin itu, karena market berubah terus. Biasanya yang ditekankan justru cara jalaninnya dulu."\n\n---\n\nUser: minimal berapa?\nJawaban:\n"Biasanya bisa mulai dari nominal kecil dulu, tujuannya biar belajar tanpa tekanan besar."\n\n---\n\nUser: kalau rugi gimana?\nJawaban:\n"Rugi itu bagian dari proses juga. Makanya biasanya mulai dari kecil dulu supaya lebih siap secara mental."\n\n---\n\nUser: ini beda apa sama yang lain?\nJawaban:\n"Kalau dilihat sekilas mungkin mirip, tapi biasanya beda di cara pendekatan dan pendampingannya."\n\n---\n\nUser: apakah ini trading?\nJawaban:\n"Iya berkaitan dengan market, tapi biasanya lebih difokuskan ke cara memahami dan menjalankannya dulu, bukan langsung hasil."	markdown_import	t	2026-05-26 01:53:37.602643+00	2026-05-26 02:03:39.932607+00	ef7c2ccc-3158-49a1-99f8-3550da95eec9
b9f0cb03-ec2b-424d-96a5-4ce8dccc5eee	\N	Solid Prime Positioning	positioning	Mini account digunakan untuk pemula yang ingin mulai dengan modal kecil.\n\nFokus utama bukan langsung profit, tapi memahami cara kerja market dan cara memulai dengan benar.\n\nMini account cocok untuk:\n\n* yang belum pernah trading\n* yang ingin belajar tanpa tekanan besar\n* yang ingin mencoba dulu sebelum serius\n\nPendekatan yang digunakan:\n\n* mulai dari kecil\n* belajar sambil jalan\n* dibimbing secara bertahap\n\nValue utama:\n\n* pendampingan\n* cara mulai yang benar\n* bukan janji hasil	markdown_import	t	2026-05-26 01:53:37.60265+00	2026-05-26 02:03:39.932608+00	ef7c2ccc-3158-49a1-99f8-3550da95eec9
cd0497a3-2934-4ceb-8c0f-7f991a3529e7	\N	Extreme Objection Handling	objection_handling	Penipuan:\n"Wajar kalau kelihatan begitu di awal, makanya biasanya dilihat dulu alurnya baru dinilai."\n\nNggak percaya:\n"Justru bagus kalau nggak langsung percaya, jadi bisa lihat dulu pelan-pelan."\n\nJudi:\n"Kelihatan mirip, tapi biasanya beda di cara ngelolanya."\n\nTrauma:\n"Kalau sudah pernah kejadian, wajar banget jadi lebih hati-hati."\n\nSales doang:\n"Haha iya juga ≡ƒÿä tapi memang tujuannya bantu jelasin dulu."\n\nDipaksa deposit:\n"Nggak harus langsung, biasanya lihat dulu baru mutusin."\n\nSibuk:\n"Berarti harus disesuaikan ritmenya, nggak bisa dipaksain."\n\nNggak punya uang:\n"Berarti belum prioritas sekarang, dan itu nggak masalah."\n\n\n\nUser: ini penipuan ya?\nRespon:\n"Kalau langsung dibilang gitu tanpa lihat sistemnya dulu ya wajar sih jadi kelihatan begitu. Justru karena itu biasanya dijelasin dulu alurnya biar bisa dinilai sendiri, bukan percaya omongan aja."\n\n---\n\nUser: pasti ujung2nya disuruh deposit kan\nRespon:\n"Kalau mau lanjut memang ada tahap itu, tapi nggak harus langsung. Biasanya orang lihat dulu, paham dulu, baru mutusin. Nggak ada kewajiban di awal."\n\n---\n\nUser: saya nggak percaya beginian\nRespon:\n"Fair kok, apalagi sekarang banyak hal yang bikin orang jadi lebih hati-hati. Justru bagus kalau nggak langsung percaya, makanya lebih enak dilihat pelan-pelan dulu sistemnya."\n\n---\n\nUser: temen saya rugi di sini\nRespon:\n"Bisa jadi, karena hasil itu biasanya tergantung cara jalaninnya juga. Makanya biasanya yang ditekankan di awal itu cara mulainya dulu, bukan langsung hasil."\n\n---\n\nUser: ini kayak judi ya\nRespon:\n"Kalau dilihat sekilas memang bisa keliatan seperti itu. Bedanya biasanya di pendekatan dan cara ngelolanya. Makanya penting paham dulu sebelum nilai."\n\n---\n\nUser: males ribet\nRespon:\n"Makanya biasanya dibikin step by step sih, jadi nggak langsung dilepas. Tapi kalau memang lagi nggak pengen fokus ke situ, nggak masalah juga."\n\n---\n\nUser: saya sibuk\nRespon:\n"Berarti memang harus disesuaikan sih. Ada yang cocoknya santai, ada yang butuh waktu lebih. Jadi biasanya disesuaikan dulu, nggak dipaksain."\n\n---\n\nUser: saya nggak punya uang\nRespon:\n"Berarti memang belum prioritas sekarang. Biasanya yang mulai pun dari nominal kecil dulu, bukan langsung besar."\n\n---\n\nUser: ah sales doang ini\nRespon:\n"Haha kalau dibilang gitu juga nggak salah ≡ƒÿä tapi memang tujuannya bantu jelasin dulu. Kalau cocok lanjut, kalau nggak ya santai aja."\n\n---\n\nUser: saya trauma\nRespon:\n"Kalau sudah pernah kena pengalaman kurang enak, wajar banget jadi lebih hati-hati. Justru biasanya mulai dari kecil dan pelan itu jadi penting banget."	markdown_import	t	2026-05-26 01:53:37.602654+00	2026-05-26 02:03:39.932609+00	ef7c2ccc-3158-49a1-99f8-3550da95eec9
\.


--
-- Data for Name: reply_suggestions; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.reply_suggestions (id, conversation_id, ai_extraction_id, model_name, schema_version, risk_level, action_mode, approval_status, suggested_replies, policy_reasons, selected_reply_text, final_reply_text, created_at, updated_at) FROM stdin;
73060462-9662-49a1-a01c-73dce532c0e4	3db559c2-41f6-425c-ada3-e6564da25422	b0e8e660-8767-451a-a093-b01198529ffb	gpt-4.1-mini	v1	medium	human_approval_required	approved	[{"text": "Halo Kak,┬áprogram Solid Prime ini diawasi BAPPEBTI, jadi sudah resmi kok≡ƒÿè. Kalau mau, aku bisa kirim dokumen legalitasnya biar Kakak bisa lihat langsung, gimana?", "tone": "friendly", "reasoning": "Gaya santai dan ramah cocok untuk membangun kenyamanan dan memudahkan calon nasabah menerima informasi legalitas sambil tetap membuka kesempatan untuk tanya dan melanjutkan proses."}, {"text": "Terima kasih sudah bertanya, kak. Program Solid Prime berada di bawah pengawasan BAPPEBTI sehingga legalitasnya terjamin secara sistem. Kami akan segera mengirimkan dokumen resmi sebagai bukti legalitas dan siap membantu jika ada pertanyaan lebih lanjut.", "tone": "professional", "reasoning": "Gaya formal dan informatif sesuai dengan kebutuhan memberikan kejelasan legalitas secara profesional, sesuai permintaan dan untuk membangun kepercayaan calon nasabah yang masih ragu."}, {"text": "Kami paham penting banget memastikan legalitas dulu sebelum melangkah, kak. Solid Prime ini diawasi oleh BAPPEBTI, dan kami siap kirim dokumen resminya supaya kakak bisa merasa lebih yakin. Kalau ada yang mau ditanya soal proses atau lainnya, jangan ragu ya.", "tone": "empathetic", "reasoning": "Nada empati untuk menghargai kekhawatiran calon nasabah dan memberikan rasa aman melalui dokumen legalitas serta membuka ruang komunikasi lebih lanjut tanpa memaksa."}]	["Risk level medium: balasan butuh approval sales."]	Halo Kak,┬áprogram Solid Prime ini diawasi BAPPEBTI, jadi sudah resmi kok≡ƒÿè. Kalau mau, aku bisa kirim dokumen legalitasnya biar Kakak bisa lihat langsung, gimana?	Halo Kak,┬áprogram Solid Prime ini diawasi BAPPEBTI, jadi sudah resmi kok≡ƒÿè. Kalau mau, aku bisa kirim dokumen legalitasnya biar Kakak bisa lihat langsung, gimana?	2026-05-26 09:31:24.458735+00	2026-05-26 09:37:46.635498+00
c994e7d3-0f52-40dd-a456-d68f74c6390a	3db559c2-41f6-425c-ada3-e6564da25422	a71749f6-3566-4aa3-afc0-f210800f9dd5	gpt-4.1-mini	v1	medium	human_approval_required	pending	[{"text": "Hai Kak, program Solid Prime diawasi BAPPEBTI jadi sudah resmi ya ≡ƒÿè. Kalau Kakak mau, aku bisa kirim dokumen legalitasnya untuk dicek dulu, biar makin yakin. Mau aku kirim sekarang?", "tone": "friendly", "reasoning": "Menggunakan bahasa yang hangat dan santai untuk menjaga suasana ramah serta mengarahkan customer agar menerima dokumen resmi sebagai bukti legalitas, sesuai rekomendasi knowledge base."}, {"text": "Selamat pagi, program Solid Prime kami memang diawasi oleh BAPPEBTI sehingga sudah terdaftar secara resmi. Saya dapat mengirimkan dokumen legalitas resmi jika Kakak ingin melakukan pengecekan lebih lanjut. Apakah Kakak berminat untuk menerima dokumennya?", "tone": "professional", "reasoning": "Respon menggunakan nada profesional dan formal yang sesuai untuk menjawab pertanyaan serius terkait legalitas, memberikan fakta dan menawarkan dokumen resmi sebagai bukti tanpa klaim berlebihan."}, {"text": "Saya mengerti pentingnya memastikan program ini legal dan terpercaya. Solid Prime diawasi BAPPEBTI dan sudah memenuhi regulasi yang berlaku. Kalau Kakak butuh, saya bisa kirim dokumen legalitas resminya supaya semakin tenang sebelum mulai. Bagaimana menurut Kakak?", "tone": "empathetic", "reasoning": "Menunjukkan empati terhadap kekhawatiran customer dengan mengakui pentingnya legalitas, memberikan informasi faktual, dan dengan halus mengajak customer melihat dokumen legalitas untuk meningkatkan rasa percaya."}]	["Risk level medium: balasan butuh approval sales."]	\N	\N	2026-05-29 01:36:15.862281+00	2026-05-29 01:36:15.862282+00
bf801e3e-988a-494c-bb59-ea20f9671c00	d8dc1bef-c282-4bcd-9468-19b12d65bc90	b880f5dc-c2eb-4346-8937-f6435d157fab	gpt-4.1-mini	v1	low	auto_draft_only	pending	[{"text": "Wah, aku ngerti kok kalau kamu lagi bingung dan capek sekarang. Santai saja ya, nggak usah buru-buru. Kalau mau, kita bisa mulai pelan-pelan dulu aja, lihat step-nya bareng supaya gak berat di awal.", "tone": "friendly", "reasoning": "Respon ini menggunakan bahasa yang santai dan mengedepankan empati, cocok untuk mengurangi kecemasan customer yang sedang bingung atau belum siap. Memberikan arahan ringan agar merasa tidak terbebani, sesuai dengan kondisi customer yang tampak ragu dan bingung."}, {"text": "Terima kasih sudah berbagi, saya paham situasi Anda sekarang. Jika Anda tertarik, kita bisa mulai dengan modal kecil supaya proses belajar dan adaptasi lebih nyaman. Saya siap mendampingi agar langkah awal Anda berjalan lancar.", "tone": "professional", "reasoning": "Balasan ini bersifat profesional dengan nada hangat dan dukungan, menegaskan kesiapan membantu sambil mengarahkan ke langkah awal yang realistis dan kecil, sesuai standar pendampingan dari PT Solid Gold Berjangka."}, {"text": "Saya ikut sedih dengar kondisi kamu sekarang. Memang wajar kalau bingung mau mulai dari mana, apalagi kalau lagi banyak pikiran. Santai saja dulu, nanti kalau sudah siap kita bisa lihat cara mulai yang benar dan pelan-pelan, supaya kamu nggak terbebani.", "tone": "empathetic", "reasoning": "Balasan ini menunjukkan empati mendalam terhadap keadaan customer yang tampak sedang kesulitan. Mengakui perasaan customer dan memberi rasa pengertian serta pilihan memulai secara gradual agar membantu membangun kepercayaan dan kenyamanan."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	\N	\N	2026-05-29 05:51:29.534132+00	2026-05-29 05:51:29.534135+00
a4aac0a4-3471-455a-b984-df5e4fb684be	d8dc1bef-c282-4bcd-9468-19b12d65bc90	83758b7d-bc56-4ad9-990f-2e6b206b9b2a	gpt-4.1-mini	v1	low	auto_draft_only	approved	[{"text": "Terima kasih ya sudah perhatian. Kalau kamu mau, kita bisa ngobrol santai dulu soal trading, mulai dari yang kecil dan nyaman aja.", "tone": "friendly", "reasoning": "Balasan ini bersifat santai dan ramah, menanggapi perhatian pengguna dengan hangat sambil perlahan mengarah ke topik trading dengan pendekatan yang tidak memaksa."}, {"text": "Saya mengapresiasi dukungan kamu. Jika kamu tertarik, kami bisa mulai jelaskan langkah awal trading dengan modal kecil agar proses belajar lebih nyaman dan terarah.", "tone": "professional", "reasoning": "Balasan ini menampilkan sikap profesional dan terstruktur, mengakui perasaan user lalu menawarkan informasi trading secara terencana dan sesuai dengan prinsip memulai dari kecil."}, {"text": "Saya paham banget kalau situasi sekarang bikin berat. Nanti kalau sudah siap, kita bisa pelan-pelan mulai belajar trading dari yang kecil dulu supaya kamu nggak terbebani.", "tone": "empathetic", "reasoning": "Respon ini menempatkan empati sebagai fokus utama, mengakui beban emosional pengguna dan mengajak mulai dari tahap ringan supaya tidak menambah tekanan."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	Terima kasih ya sudah perhatian. Kalau kamu mau, kita bisa ngobrol santai dulu soal trading, mulai dari yang kecil dan nyaman aja.	Terima kasih ya sudah perhatian. Kalau kamu mau, kita bisa ngobrol santai dulu soal trading, mulai dari yang kecil dan nyaman aja.	2026-05-29 04:31:24.802763+00	2026-05-29 04:31:46.806772+00
7d4b8a5b-d59d-4db0-8e0a-bb4b5fff27dc	d8dc1bef-c282-4bcd-9468-19b12d65bc90	83758b7d-bc56-4ad9-990f-2e6b206b9b2a	gpt-4.1-mini	v1	low	auto_draft_only	approved	[{"text": "Iya, aku ngerti banget perasaan kamu sekarang. Penting banget kok ambil waktu dan jaga hati, ya. Kalau nanti kamu pengen cerita atau tanya-tanya ringan soal SOLID PRIME, aku siap bantu pelan-pelan kok.", "tone": "friendly", "reasoning": "User menunjukkan kesedihan dan keinginan untuk didukung secara emosional. Respon friendly ini membangun kedekatan sambil membuka ruang untuk diskusi ringan tentang produk tanpa tekanan."}, {"text": "Saya mengerti situasinya memang berat sekarang. Sambil kamu istirahat dan memulihkan semangat, kalau ada pertanyaan terkait produk SOLID PRIME kapan saja bisa hubungi saya. Kita mulai dari langkah kecil dan pelan agar kamu nyaman.", "tone": "professional", "reasoning": "Memberikan dukungan secara profesional dengan mengakui kondisi user, sambil tetap menjaga kesempatan untuk diskusi produk secara bertahap mengikuti kebutuhan user."}, {"text": "Sedih dan butuh waktu itu wajar banget, sayang. Jangan paksakan diri untuk cepat ceria, aku di sini kalau kamu butuh dengar atau pelan-pelan kalau mau tahu soal cara mulai yang benar nanti ya.", "tone": "empathetic", "reasoning": "Memvalidasi emosi user yang sedang sedih, menawarkan empati tanpa memaksa pembicaraan produk, menunjukkan kesiapan untuk support kapan pun user siap."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	Sedih dan butuh waktu itu wajar banget, sayang. Jangan paksakan diri untuk cepat ceria, aku di sini kalau kamu butuh dengar atau pelan-pelan kalau mau tahu soal cara mulai yang benar nanti ya.	Sedih dan butuh waktu itu wajar banget, sayang. Jangan paksakan diri untuk cepat ceria, aku di sini kalau kamu butuh dengar atau pelan-pelan kalau mau tahu soal cara mulai yang benar nanti ya.	2026-05-29 04:31:56.365813+00	2026-05-29 04:32:22.558713+00
f0f609f4-9795-473b-8d86-8434e4ef0bd1	93619231-dc0a-4756-9df3-2b824355d3f1	8fcc181c-053f-4d7d-829e-9d9174a2683d	gpt-4.1-mini	v1	low	auto_draft_only	pending	[{"text": "Halo, soal keamanan layanan kami memang diawasi oleh BAPPEBTI, jadi sudah di bawah pengawasan resmi. Untuk proses perpindahan biasanya dijadwalkan dengan jelas, misalnya Senin seperti yang disebut tadi, supaya semuanya lancar. Kalau ingin, saya bisa bantu jelaskan langkah awalnya supaya kamu makin yakin.", "tone": "friendly", "reasoning": "Balasan ini menggunakan nada santai dan ramah agar pelanggan merasa nyaman dan terhubung, menjelaskan legalitas dan proses perpindahan secara sederhana, lalu mengarahkan ke langkah selanjutnya tanpa memaksa."}, {"text": "Terima kasih atas pertanyaannya. PT Solid Gold Berjangka sudah diawasi BAPPEBTI yang menjamin aspek legal dan keamanan layanan secara resmi. Mengenai perpindahan, prosedurnya sudah terjadwal dan diinformasikan terlebih dahulu, seperti pelaksanaan pada hari Senin. Apakah Bapak/Ibu ingin saya jelaskan lebih detail tentang tahapan memulainya?", "tone": "professional", "reasoning": "Balasan ini bersifat formal dan informatif, menegaskan aspek legalitas dan prosedur perpindahan dengan jelas, sekaligus menawarkan penjelasan lebih lanjut sebagai langkah selanjutnya tanpa tekanan."}, {"text": "Saya paham kalau soal keamanan dan proses perpindahan kadang bikin bingung atau ragu. Kami memang diawasi BAPPEBTI, dan proses perpindahan biasanya dijalankan dengan waktu yang sudah disepakati, seperti hari Senin kemarin. Kalau mau, saya bisa bantu jelaskan cara mulai dari langkah kecil dulu biar kamu lebih nyaman.", "tone": "empathetic", "reasoning": "Balasan ini menunjukkan empati terhadap kekhawatiran customer, menegaskan legalitas dan proses perpindahan secara menenangkan, lalu mengajak untuk mulai dengan cara yang ringan sebagai next step."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	\N	\N	2026-05-29 04:33:36.036479+00	2026-05-29 04:33:36.036482+00
00762691-36cb-46d1-8e48-466c4a3187be	a3b451c1-a339-4cb5-bfe2-b02fee6568ec	87843aad-dcd1-418b-b91b-faaba8cf5f0b	gpt-4.1-mini	v1	low	auto_draft_only	pending	[{"text": "Iya betul, biasanya dipanggil cukup cepat kok, nggak sampai lama. Santai aja, kamu bisa coba dulu semua persiapannya dengan lengkap biar lancar deh prosesnya.", "tone": "friendly", "reasoning": "Menggunakan nada santai dan ramah untuk memberikan informasi cepat tentang proses panggilan agar customer merasa lebih nyaman dan siap dengan langkah selanjutnya tanpa terlalu teknis."}, {"text": "Proses pemanggilan biasanya tidak panjang, sekitar beberapa menit saja dan terjadi secara acak, bukan berdasarkan urutan. Pastikan dokumen sudah lengkap agar proses Anda lancar.", "tone": "professional", "reasoning": "Memberikan informasi dengan gaya profesional dan jelas mengenai sistem pemanggilan dan menyarankan persiapan dokumen, agar customer mendapat penjelasan yang tepat dan bisa menyiapkan diri dengan benar."}, {"text": "Paham kok kalau nunggu dipanggil itu kadang bikin deg-degan, tapi biasanya nggak lama kok, bahkan kalau banyak orang pun prosesnya cepat berjalan. Yuk, kita persiapkan dulu dokumennya supaya kamu lebih tenang saat di sana.", "tone": "empathetic", "reasoning": "Mengakui perasaan customer yang mungkin cemas menunggu dengan nada empati, lalu mengarahkan ke persiapan sebagai langkah berikutnya agar customer merasa didukung dan tidak terbebani."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	\N	\N	2026-05-29 04:34:49.670756+00	2026-05-29 04:34:49.670757+00
5e8be481-3a05-4309-9e62-b968ce50bbf1	d8dc1bef-c282-4bcd-9468-19b12d65bc90	a218a3a8-3fb4-4a3b-80c0-a8053f03eed2	gpt-4.1-mini	v1	low	auto_draft_only	approved	[{"text": "Santai aja, sayang. Kalau bingung mau mulai dari mana, biasanya aku rekomendasiin coba pelan-pelan dulu sambil lihat step yang ada.", "tone": "friendly", "reasoning": "Gaya santai dan hangat digunakan untuk mendukung emosi user yang bingung dan belum pasti mau ke mana, sambil menawarkan solusi ringan dan membuka opsi langkah selanjutnya tanpa tekanan."}, {"text": "Kalau boleh tahu, tujuan kamu untuk besok apa ya? Dengan begitu, saya bisa bantu arahkan langkah mulai yang tepat dan nyaman buat kamu.", "tone": "professional", "reasoning": "Pendekatan profesional dengan bertanya tujuan konkret untuk menggali kebutuhan user, sekaligus membuka peluang untuk memberikan arahan sesuai kebutuhan user dengan nada sopan dan santun."}, {"text": "Aku ngerti kok, kadang bingung mau arah mana setelah situasi kayak gini. Tidak masalah kalau butuh waktu buat mikir dulu, yang penting mulai dari kecil dan pelan aja ya.", "tone": "empathetic", "reasoning": "Pendekatan empati untuk memvalidasi kebingungan dan ketidakpastian user, memberikan dukungan emosional, serta mengingatkan langkah dimulai dengan ringan agar terasa aman dan nyaman."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	Aku ngerti kok, kadang bingung mau arah mana setelah situasi kayak gini. Tidak masalah kalau butuh waktu buat mikir dulu, yang penting mulai dari kecil dan pelan aja ya.	Aku ngerti kok, kadang bingung mau arah mana setelah situasi kayak gini. Tidak masalah kalau butuh waktu buat mikir dulu, yang penting mulai dari kecil dan pelan aja ya.	2026-05-29 05:49:38.051181+00	2026-05-29 05:50:24.652606+00
447c6eee-9c8c-40c1-ba5a-caeb4e3f6a43	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	069e0561-dc29-4569-9479-5cb4de903a1b	gpt-4.1-mini	v1	low	auto_draft_only	pending	[{"text": "Oh gitu ya, Tebet memang strategis buat naik kereta. Nah, ngomongin soal investasi, kamu pernah coba trading mini account? Biasanya cocok buat yang mau mulai pelan-pelan kok.", "tone": "friendly", "reasoning": "Respon ini santai dan menyambung obrolan sebelumnya dengan pendekatan ramah, mengajak customer membuka topik baru terkait produk tanpa tekanan."}, {"text": "Baik Kak, dari Tebet bisa diakses dengan mudah. Kalau terkait SOLID PRIME, produk kami fokus pada mini account mulai dari Rp5 juta yang cocok untuk pemula yang ingin belajar trading secara bertahap.", "tone": "professional", "reasoning": "Memberikan informasi secara terstruktur dan jelas, sekaligus mulai mengenalkan produk sesuai dengan fakta dan positioning tanpa memaksa."}, {"text": "Wah dari Tebet turun lalu naik 6D ya, pasti aktif banget, Kak. Kalau soal investasi, banyak juga yang mulai pelan dari kecil, jadi nggak perlu khawatir langsung besar. Boleh saya bantu jelasin langkah awalnya?", "tone": "empathetic", "reasoning": "Memperlihatkan perhatian pada aktivitas customer dan memberikan validasi atas kekhawatiran mulai investasi, membangun rasa percaya dan arah halus ke pembicaraan produk."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	\N	\N	2026-05-29 05:52:02.607029+00	2026-05-29 05:52:02.607031+00
e69f587a-cb60-4fdb-acc2-cb62bbbb8873	59f1578d-d6a6-47a6-9950-541c2659e2f1	f9f91105-87f3-4048-af43-61adf64115e5	gpt-4.1-mini	v1	low	auto_draft_only	pending	[{"text": "Hai! Kalau soal turun, biasanya memang pasar bersifat fluktuatif ya. Kalau kamu mau, kita coba pelan-pelan dulu, mulai dari mini account yang modalnya kecil aja. Gimana, kamu tertarik untuk lanjut pelan-pelan sambil belajar?", "tone": "friendly", "reasoning": "Menggunakan tone friendly untuk membangun kedekatan dan mendorong customer mulai dengan cara yang benar tanpa paksaan, sesuai kondisi customer yang santai dan belum jelas niatnya."}, {"text": "Pergerakan turun pada pasar bisa terjadi sewaktu-waktu karena sifatnya yang dinamis. Kalau kamu berminat, kami sarankan mulai dari mini account dengan modal kecil supaya bisa belajar sambil meminimalkan risiko. Saya bisa bantu jelaskan langkah awalnya jika kamu mau.", "tone": "professional", "reasoning": "Memberi penjelasan singkat dan profesional tentang kondisi pasar, sekaligus mengarahkan customer untuk mulai dari modal kecil, sesuai standar komunikasi profesional yang informatif tanpa memaksa."}, {"text": "Saya ngerti sih, kalau tiba-tiba turun bisa bikin ragu dan khawatir. Makanya biasanya kami sarankan mulai dari yang kecil dulu agar bisa belajar santai dan nggak terbebani. Gimana kalau coba dulu dengan modal minimal, pelan-pelan?", "tone": "empathetic", "reasoning": "Mengakui kekhawatiran customer terhadap penurunan pasar dengan nada empati, sambil mengajak memulai dari modal kecil yang sesuai dengan kebutuhan perlindungan emosi customer yang mungkin ragu."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	\N	\N	2026-05-29 05:53:19.911662+00	2026-05-29 05:53:19.911663+00
d4b97c2d-2cd0-4239-8c31-44f7feaa2d93	67343055-cd9f-4943-abcd-0016838210cd	b1af4939-0af5-43ce-92f1-77723dea27db	gpt-4.1-mini	v1	low	auto_draft_only	pending	[{"text": "Hai! Promo cashback di OCTO memang menarik ya ≡ƒÿä Kalau kamu mau tahu gimana cara mulai trading di Solid Prime dengan modal kecil dan pendampingan, aku siap bantu. Mau tahu langkah awalnya?", "tone": "friendly", "reasoning": "Nada santai dan ramah untuk menciptakan keakraban sekaligus mengarahkan pembicaraan ke langkah memulai trading yang sesuai tanpa memaksa."}, {"text": "Terima kasih sudah sharing info promo cashbacknya. Kalau berkenan, kami bisa jelaskan bagaimana memulai trading dengan mini account di Solid Prime yang diawasi BAPPEBTI, fokus pendampingan dan modal kecil. Apakah Anda ingin informasi lebih lanjut?", "tone": "professional", "reasoning": "Nada formal dan jelas untuk memberikan kesan profesional, sekaligus menawarkan penjelasan produk dengan cara yang terstruktur untuk membangun kepercayaan."}, {"text": "Wah, promo cashback di OCTO memang bikin senang, ya. Kalau kamu masih ragu memulai trading, kita bisa mulai pelan-pelan dengan modal kecil di Solid Prime, fokus belajar dengan pendampingan. Kamu ingin aku jelaskan tahap awalnya?", "tone": "empathetic", "reasoning": "Nada hangat dan memvalidasi kondisi calon pelanggan, mengakui ketertarikan mereka pada promo sambil mengarahkan perlahan ke cara mulai yang tepat tanpa menekan."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	\N	\N	2026-05-29 05:54:27.508355+00	2026-05-29 05:54:27.508358+00
5f9fe310-bc8d-4609-bb07-e4a0190e8650	d8dc1bef-c282-4bcd-9468-19b12d65bc90	b3f1b3e7-36a7-4302-b980-77d4d3e857ba	gpt-4.1-mini	v1	low	auto_draft_only	pending	[{"text": "Aku paham banget kondisi kamu yang lagi berat sekarang, jangan ragu buat cerita atau curhat ya. Kalau nanti ada yang ingin dibahas soal trading-nya, aku siap bantu pelan-pelan kok.", "tone": "friendly", "reasoning": "Tanggapan hangat dan penuh pengertian sesuai dengan kondisi emosional user yang sedang mengalami situasi sulit, sekaligus membuka ruang komunikasi tanpa memaksa pembahasan jualan."}, {"text": "Aku turut merasakan beban kamu sekarang, wajar kok kalau lagi nggak fokus. Nanti kalau kamu sudah siap, kita bisa mulai pelan-pelan tanpa tekanan, dari hal yang paling ringan dulu.", "tone": "empathetic", "reasoning": "Memberikan dukungan emosional dan validasi keadaan user yang sulit, mengarahkan dengan halus bahwa proses bisa dimulai kapan pun user siap tanpa paksaan."}, {"text": "Terima kasih sudah terbuka soal situasimu. Kita bisa terus komunikasi kapanpun kamu siap, dan aku akan bantu jalankan langkah awal dengan modal kecil agar prosesnya nyaman dan bertahap.", "tone": "professional", "reasoning": "Gaya profesional yang tetap sopan dan tidak kaku, memberi sinyal kesiapan mendukung user sambil mengarahkan proses mulai dengan cara yang benar dan bertahap tanpa tekanan."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	\N	\N	2026-05-29 06:31:47.688137+00	2026-05-29 06:31:47.688146+00
f43c0e8e-8b5c-46bc-abaa-c664e27cb56e	93619231-dc0a-4756-9df3-2b824355d3f1	f911af02-6c29-40a6-a26a-717f7ae42c28	gpt-4.1-mini	v1	medium	human_approval_required	pending	[{"text": "Halo! Untuk keamanan, PT Solid Gold Berjangka diawasi oleh BAPPEBTI, jadi sistemnya resmi dan diawasi. Buat perpindahan biasanya ada proses yang jelas dan nggak langsung pindah tanpa info lengkap. Kamu mau saya jelaskan detailnya pelan-pelan?", "tone": "friendly", "reasoning": "Balasan ini menggunakan nada friendly untuk membangun kepercayaan dengan menyampaikan legalitas dan menjelaskan proses perpindahan secara sederhana. Memberi kemungkinan melanjutkan diskusi dengan santai agar customer merasa nyaman untuk bertanya lebih lanjut."}, {"text": "Terima kasih sudah bertanya. Produk kami berada di bawah pengawasan resmi BAPPEBTI sehingga sesuai regulasi. Untuk perpindahan, ada prosedur yang terstruktur agar proses berjalan aman dan transparan. Apakah Anda ingin saya kirimkan detail prosesnya atau dokumen terkait?", "tone": "professional", "reasoning": "Nada profesional dipilih sesuai rekomendasi untuk memberikan kejelasan dan meyakinkan customer secara sistematis. menawarkan dokumen resmi sebagai bahan pendukung agar menciptakan rasa aman dan perlindungan bagi customer yang masih dalam tahap pertimbangan."}, {"text": "Mengerti kok kekhawatiran soal keamanan dan proses perpindahan ini. Kami memang sangat mengedepankan transparansi dan proses yang jelas supaya kamu bisa merasa tenang mulai dari langkah kecil. Yuk, saya bantu jelaskan step by step biar makin nyaman buat kamu.", "tone": "empathetic", "reasoning": "Nada empati dipakai untuk merespons keraguan dan rasa takut customer dengan pengakuan atas perasaan mereka dan menekankan pendampingan serta pendekatan yang bertahap untuk mengurangi rasa cemas dan membangun kepercayaan."}]	["Risk level medium: balasan butuh approval sales."]	\N	\N	2026-05-29 06:32:34.783597+00	2026-05-29 06:32:34.783599+00
f1c6e74f-b2ad-46d4-997a-404fbd1a7abf	f9dfb897-7af0-4890-b51d-d3e4735f4ea4	70e8b571-985a-4f61-a5e7-032e619cfc16	gpt-4.1-mini	v1	low	auto_draft_only	pending	[{"text": "Wah, Tebet pas banget strateginya! Nah, ngomong-ngomong soal mulai trading, kamu udah pernah coba atau baru mau coba? Biasanya buat yang mau coba, kita saranin mulai dari modal kecil dulu, biar nggak keteteran. ≡ƒÿè", "tone": "friendly", "reasoning": "Menggunakan tone friendly untuk membangun keakraban dengan customer yang santai, membuka percakapan dengan pertanyaan ringan untuk mengetahui pengalaman dan kesiapan customer, sekaligus mengarahkan ke konsep mulai dari kecil sesuai produk."}, {"text": "Terima kasih sudah berbagi informasi. Untuk memulai trading dengan SOLID PRIME, biasanya kami sarankan untuk mulai dari mini account dengan modal Rp5 Juta agar bisa belajar dengan pendampingan yang tepat. Apakah Anda ingin saya jelaskan langkah awalnya?", "tone": "professional", "reasoning": "Pendekatan profesional dengan jelas menyampaikan informasi modal minimal dan menawarkan penjelasan tahap awal, sesuai goal mengarahkan customer mulai dari kecil dengan cara yang benar."}, {"text": "Sip, Tebet itu strateginya oke banget, kadang kita semua butuh step demi step kan. Kalau kamu baru mulai, nggak apa-apa kok mulai pelan-pelan dulu dengan modal kecil supaya nyaman dan nggak terbebani. Mau coba saya bantu jelasin cara mulai yang mudah?", "tone": "empathetic", "reasoning": "Menggunakan nada empatik untuk mengakui kondisi customer yang santai sekaligus membangun trust dengan menawarkan bantuan dan menegaskan cara mulai yang ringan dan bertahap."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	\N	\N	2026-05-29 06:33:25.173334+00	2026-05-29 06:33:25.173336+00
eeea76e3-82e2-4f60-bd42-c113a261e100	59f1578d-d6a6-47a6-9950-541c2659e2f1	03a8af0e-aed5-4651-9537-168d0695b5e9	gpt-4.1-mini	v1	low	auto_draft_only	pending	[{"text": "Halo! Kalau kamu penasaran soal turun di market, biasanya memang ada waktunya naik dan turun karena fluktuasi pasar. Btw, kamu udah pernah coba trading belum? Biar aku bisa bantu arahkan cara mulai yang pas!", "tone": "friendly", "reasoning": "Tone friendly untuk membuka komunikasi santai, menjelaskan soal turun-naiknya pasar secara sederhana, dan mengajak bertanya pengalaman supaya bisa arahkan langkah selanjutnya dengan ringan."}, {"text": "Terima kasih sudah menghubungi. Fluktuasi harga seperti turun itu memang wajar dalam market trading. Apakah Anda sudah pernah memulai trading sebelumnya? Kami bisa bantu jelaskan langkah awal yang tepat agar mulai dengan cara yang benar dan minimal risiko.", "tone": "professional", "reasoning": "Tone professional untuk memberikan info yang jelas dan menanyakan pengalaman customer, agar bisa mendukung pendekatan yang edukatif dan terarah sesuai konteks percakapan."}, {"text": "Aku ngerti sih, kadang kondisi pasar yang turun bikin ragu buat mulai. Makanya penting banget mulai dari kecil dulu, biar bisa belajar sambil jalan tanpa terbebani. Kamu sendiri pengen coba mulai pelan-pelan gak?", "tone": "empathetic", "reasoning": "Tone empati untuk validasi perasaan ragu customer terkait kondisi pasar dan mengarahkan supaya mulai dengan cara yang ringan dan nyaman, sekaligus membuka ruang untuk respon lebih lanjut."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	\N	\N	2026-05-29 06:35:24.142413+00	2026-05-29 06:35:24.142415+00
6f8a72b1-d79c-4503-b4f7-5b49bd51aafe	fe84cb9f-5247-4e0a-8921-8e51b911c774	24f93c8f-24af-44d8-895f-bb06460870c4	gpt-4.1-mini	v1	low	auto_draft_only	approved	[{"text": "Pagi sayang! Kalau kamu tertarik soal investasi atau trading yang terstruktur dan resmi, aku siap bantu jelasin. Jangan khawatir, kita jalankan dengan sistem yang jelas dan pengelolaan risiko yang matang ya.", "tone": "friendly", "reasoning": "Balasan ramah dan hangat sesuai gaya percakapan, sekaligus menawarkan informasi produk secara halus tanpa tekanan. Mengajak customer eksplorasi dengan pendekatan yang natural."}, {"text": "Selamat pagi, terima kasih sudah menghubungi. Jika Anda ingin mengetahui lebih lanjut tentang produk Regular kami yang memiliki sistem pengelolaan risiko dan pendampingan resmi, saya siap jelaskan. Apakah Anda ingin informasi mengenai proses atau persyaratan minimum?", "tone": "professional", "reasoning": "Nada profesional untuk menjawab secara informatif. Fokus pada aspek produk dan proses yang relevan dengan profil pengguna yang tampak santai namun serius menanyakan. Arah ke klarifikasi kebutuhan lebih lanjut."}, {"text": "Pagi, saya paham kalau kadang kita butuh banyak waktu untuk memutuskan sesuatu yang serius seperti ini. Kalau kamu ada pertanyaan soal mekanisme, risiko, atau legalitas produk Regular kami, saya siap bantu jelaskan agar kamu bisa merasa lebih nyaman sebelum melangkah.", "tone": "empathetic", "reasoning": "Nada empati untuk menghormati waktu dan perasaan customer yang mungkin belum yakin. Memberi ruang dan dukungan dengan menawarkan bantuan informasi agar customer merasa didukung dan tidak terburu-buru."}]	["Low risk dan confidence tinggi: aman untuk auto draft."]	Pagi sayang! Kalau kamu tertarik soal investasi atau trading yang terstruktur dan resmi, aku siap bantu jelasin. Jangan khawatir, kita jalankan dengan sistem yang jelas dan pengelolaan risiko yang matang ya.	Pagi sayang! Kalau kamu tertarik soal investasi atau trading yang terstruktur dan resmi, aku siap bantu jelasin. Jangan khawatir, kita jalankan dengan sistem yang jelas dan pengelolaan risiko yang matang ya.	2026-06-02 02:49:18.892243+00	2026-06-02 02:49:50.31714+00
63865216-8488-480a-b093-67944c9d504f	a1f51fee-463c-4356-b702-9f6555241c18	e1352eee-fe8d-46ce-9865-119982a8ebe7	gpt-4.1-mini	v1	low	human_approval_required	pending	[{"text": "Halo Pak/Bu, senang melihat antusias Anda! Di SOLID REGULAR, kami fokus pada pendampingan dan sistem pengelolaan risiko supaya Anda bisa trading dengan lebih terstruktur. Kalau mau, saya bisa jelaskan gambaran singkatnya dulu supaya makin jelas ya?", "tone": "friendly", "reasoning": "Menggunakan bahasa yang ramah dan mengajak untuk eksplorasi lebih lanjut sesuai dengan level user yang hangat, mendorong keterbukaan dan menyiapkan diri untuk langkah selanjutnya."}, {"text": "Terima kasih atas minat Anda terhadap SOLID REGULAR. Produk ini dirancang untuk calon nasabah dengan kesiapan modal minimal Rp100 juta, yang mengutamakan manajemen risiko dan kontrol aktif. Jika Anda ingin, saya dapat mengirimkan informasi detail tentang sistem kerja dan prosedur pembukaan akun.", "tone": "professional", "reasoning": "Nada profesional dan informatif sesuai tipe user yang sudah memahami konsep dasar, memberikan informasi penting dan menawarkan informasi lanjutan untuk memperkuat keputusan."}, {"text": "Saya paham kalau Anda ingin memastikan semuanya jelas sebelum melangkah. Di SOLID REGULAR, fokusnya memang membantu Anda memahami risiko dan pengelolaan dengan serius, bukan sekadar janji untung. Kalau Anda mau, saya bisa bantu jelaskan lebih detail atau sambungkan dengan tim yang bisa memberikan panduan langkah demi langkah.", "tone": "empathetic", "reasoning": "Menunjukkan empati terhadap keraguan dan kekhawatiran user, sekaligus memberikan opsi bantuan lanjut tanpa memaksa, membantu membangun kepercayaan dan membuka jalan untuk konsultasi lebih mendalam."}]	["Confidence score di bawah 0.85: butuh approval sales."]	\N	\N	2026-06-02 05:22:05.245581+00	2026-06-02 05:22:05.245592+00
12765cf7-e660-4cc5-a7f0-f9cfd412dead	2a377930-58c3-473f-a9b6-dd56909f54d3	e10cd7b3-2451-4492-b382-d874b7248426	gpt-4.1-mini	v1	low	human_approval_required	approved	[{"text": "Halo! Senang ngobrol santai bareng kamu. Kalau ada waktu dan kamu penasaran soal investasi yang lebih serius, saya siap jelasin kok. Santai aja ya, nggak perlu buru-buru.", "tone": "friendly", "reasoning": "Membangun suasana ramah dan santai agar customer merasa nyaman, tanpa menekan topik jualan, menyesuaikan kondisi percakapan yang informal dan ringan."}, {"text": "Terima kasih sudah ngobrol. Jika kamu tertarik mengetahui lebih tentang SOLID REGULAR, kami bisa jelaskan detail legalitas, sistem, dan pengelolaan risikonya kapan pun kamu siap.", "tone": "professional", "reasoning": "Memberikan kesan profesional dengan menawarkan informasi resmi dan struktur, sambil menjaga komunikasi tetap terbuka tanpa paksaan."}, {"text": "Saya paham kalau kamu mungkin lagi santai dan nggak pengen dibahas yang serius sekarang. Kalau kapan-kapan mau tahu soal investasi dengan pendekatan yang lebih terstruktur dan siap, saya di sini untuk bantu.", "tone": "empathetic", "reasoning": "Empati terhadap kondisi customer yang sedang tidak fokus pada topik investasi agar tidak terkesan memaksa, sambil menjaga pintu komunikasi tetap terbuka."}]	["Confidence score di bawah 0.85: butuh approval sales."]	Halo! Senang ngobrol santai bareng kamu. Kalau ada waktu dan kamu penasaran soal investasi yang lebih serius, saya siap jelasin kok. Santai aja ya, nggak perlu buru-buru.	Halo! Senang ngobrol santai bareng kamu. Kalau ada waktu dan kamu penasaran soal investasi yang lebih serius, saya siap jelasin kok. Santai aja ya, nggak perlu buru-buru.	2026-06-02 06:35:28.544188+00	2026-06-02 06:55:28.982322+00
\.


--
-- Data for Name: sales_teams; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.sales_teams (id, organization_id, unit_id, manager_user_id, name, code, created_at) FROM stdin;
9fe8c342-ac88-4919-a22e-c48a733cffea	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	3c94e3d2-fb01-470a-a45c-7b00be2d208e	SGB Mini	sgb-mini	2026-06-02 01:57:23.931554+00
\.


--
-- Data for Name: sales_units; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.sales_units (id, organization_id, name, code, created_at) FROM stdin;
\.


--
-- Data for Name: sent_messages; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.sent_messages (id, conversation_id, reply_suggestion_id, send_mode, message_text, sent_by_name, external_message_id, sent_at, created_at) FROM stdin;
028af6f4-0694-4262-ab27-04d534676a68	3db559c2-41f6-425c-ada3-e6564da25422	73060462-9662-49a1-a01c-73dce532c0e4	manual_simulation	Halo Kak,┬áprogram Solid Prime ini diawasi BAPPEBTI, jadi sudah resmi kok≡ƒÿè. Kalau mau, aku bisa kirim dokumen legalitasnya biar Kakak bisa lihat langsung, gimana?	Sales Dashboard	\N	2026-05-26 09:37:55.037391+00	2026-05-26 09:37:55.037394+00
df397c5c-4768-4576-bac9-c0c7d01efa5d	d8dc1bef-c282-4bcd-9468-19b12d65bc90	7d4b8a5b-d59d-4db0-8e0a-bb4b5fff27dc	manual_simulation	Sedih dan butuh waktu itu wajar banget, sayang. Jangan paksakan diri untuk cepat ceria, aku di sini kalau kamu butuh dengar atau pelan-pelan kalau mau tahu soal cara mulai yang benar nanti ya.	Sales Dashboard	\N	2026-05-29 04:32:27.637317+00	2026-05-29 04:32:27.637322+00
10686406-e941-42d6-b6a7-c3c8a7a4bfaa	d8dc1bef-c282-4bcd-9468-19b12d65bc90	5e8be481-3a05-4309-9e62-b968ce50bbf1	manual_simulation	Aku ngerti kok, kadang bingung mau arah mana setelah situasi kayak gini. Tidak masalah kalau butuh waktu buat mikir dulu, yang penting mulai dari kecil dan pelan aja ya.	Sales Dashboard	\N	2026-05-29 05:50:26.319026+00	2026-05-29 05:50:26.319028+00
ea096ce4-50f7-48d9-8c5d-4943941ecd69	fe84cb9f-5247-4e0a-8921-8e51b911c774	6f8a72b1-d79c-4503-b4f7-5b49bd51aafe	whatsapp_extension	Pagi sayang! Kalau kamu tertarik soal investasi atau trading yang terstruktur dan resmi, aku siap bantu jelasin. Jangan khawatir, kita jalankan dengan sistem yang jelas dan pengelolaan risiko yang matang ya.	extension_user	\N	2026-06-02 02:49:50.322506+00	2026-06-02 02:49:50.32251+00
f2693b76-b851-4453-ad53-629ada5c63ca	2a377930-58c3-473f-a9b6-dd56909f54d3	12765cf7-e660-4cc5-a7f0-f9cfd412dead	manual_simulation	Halo! Senang ngobrol santai bareng kamu. Kalau ada waktu dan kamu penasaran soal investasi yang lebih serius, saya siap jelasin kok. Santai aja ya, nggak perlu buru-buru.	Sales Dashboard	\N	2026-06-02 06:55:35.254945+00	2026-06-02 06:55:35.254948+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: clara_user
--

COPY public.users (id, name, email, hashed_password, role, is_active, created_at, organization_id, created_by_user_id, team_id) FROM stdin;
ef7c2ccc-3158-49a1-99f8-3550da95eec9	SuperAdmin	superadmin@clara.local	$argon2id$v=19$m=65536,t=3,p=4$8x3xgJg8BIB+AQICyZeHhg$vnzF6Lc5/sOSx2ahgj98jsiYyg/OSgbxcLsTVEW2uC4	superadmin	t	2026-05-26 02:03:35.210913+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	\N	\N
4ecdbaf1-8c3a-4802-80ae-06e50067763f	User1	user1@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$FOaAkUbdKzLLW4m8IlDLPA$3Fykl1vitrWuLCBdo5FDEcwttvwBzPv/exrxTH/yXBs	sales	t	2026-05-26 02:05:43.491263+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	\N
c4fdae7a-d761-41ea-9016-f27c91c9d19b	kresnoNM	kresnonm@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$lNBQ4/qjtGTDxKYhGBzNKg$lMZq2XNZz5246+iZ+j6YyK4mI6eOhZjlyECrUAiterI	head	t	2026-05-26 07:56:54.930961+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	\N
3c94e3d2-fb01-470a-a45c-7b00be2d208e	Arya	arya.aa@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$mZfV8qLSNVDQ0yEKiqSnNA$AW1pDVuZdPaIN+T9vx+DFN4+PFB0zZ4piKD99Ie/CtY	manager	t	2026-05-26 07:54:50.221321+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	9fe8c342-ac88-4919-a22e-c48a733cffea
2dfcc01b-ffc0-4da3-a152-db877f6895ab	Sales SGB	salessgb@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$7IcsmMwcI5ztu2ZM9NO54A$n9Lo3iAfl1de6V4Lp5dlil+cZKWWTFSC7+uWCoysjh8	sales	t	2026-06-02 01:56:52.655287+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	9fe8c342-ac88-4919-a22e-c48a733cffea
50cf0fdc-6cbb-44a8-b50d-0401765ddc89	Head SGB	headsgb@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$8tni6zBymQG9Ubo3P0M22w$g3LU/KaE3n4Tc3fQtS84k9ByX3LABT3QKKv4PNNh3nE	head	t	2026-06-02 03:59:19.013966+00	6c8e5be1-34bb-4e0c-9898-cb86d5c49dfd	ef7c2ccc-3158-49a1-99f8-3550da95eec9	9fe8c342-ac88-4919-a22e-c48a733cffea
\.


--
-- Name: ai_extractions ai_extractions_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.ai_extractions
    ADD CONSTRAINT ai_extractions_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: approval_logs approval_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.approval_logs
    ADD CONSTRAINT approval_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: chat_review_cases chat_review_cases_conversation_id_key; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.chat_review_cases
    ADD CONSTRAINT chat_review_cases_conversation_id_key UNIQUE (conversation_id);


--
-- Name: chat_review_cases chat_review_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.chat_review_cases
    ADD CONSTRAINT chat_review_cases_pkey PRIMARY KEY (id);


--
-- Name: chat_review_notes chat_review_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.chat_review_notes
    ADD CONSTRAINT chat_review_notes_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: customer_profiles customer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_pkey PRIMARY KEY (id);


--
-- Name: knowledge_update_proposals knowledge_update_proposals_chat_review_case_id_key; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.knowledge_update_proposals
    ADD CONSTRAINT knowledge_update_proposals_chat_review_case_id_key UNIQUE (chat_review_case_id);


--
-- Name: knowledge_update_proposals knowledge_update_proposals_conversation_id_key; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.knowledge_update_proposals
    ADD CONSTRAINT knowledge_update_proposals_conversation_id_key UNIQUE (conversation_id);


--
-- Name: knowledge_update_proposals knowledge_update_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.knowledge_update_proposals
    ADD CONSTRAINT knowledge_update_proposals_pkey PRIMARY KEY (id);


--
-- Name: kpi_alert_records kpi_alert_records_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.kpi_alert_records
    ADD CONSTRAINT kpi_alert_records_pkey PRIMARY KEY (id);


--
-- Name: kpi_command_snapshots kpi_command_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.kpi_command_snapshots
    ADD CONSTRAINT kpi_command_snapshots_pkey PRIMARY KEY (id);


--
-- Name: lead_activity_events lead_activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_activity_events
    ADD CONSTRAINT lead_activity_events_pkey PRIMARY KEY (id);


--
-- Name: lead_deals lead_deals_lead_id_key; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_deals
    ADD CONSTRAINT lead_deals_lead_id_key UNIQUE (lead_id);


--
-- Name: lead_deals lead_deals_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_deals
    ADD CONSTRAINT lead_deals_pkey PRIMARY KEY (id);


--
-- Name: lead_discipline_logs lead_discipline_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_discipline_logs
    ADD CONSTRAINT lead_discipline_logs_pkey PRIMARY KEY (id);


--
-- Name: lead_task_events lead_task_events_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_task_events
    ADD CONSTRAINT lead_task_events_pkey PRIMARY KEY (id);


--
-- Name: lead_tasks lead_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_tasks
    ADD CONSTRAINT lead_tasks_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: marketing_execution_items marketing_execution_items_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.marketing_execution_items
    ADD CONSTRAINT marketing_execution_items_pkey PRIMARY KEY (id);


--
-- Name: marketing_insight_snapshots marketing_insight_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.marketing_insight_snapshots
    ADD CONSTRAINT marketing_insight_snapshots_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: ops_notifications ops_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.ops_notifications
    ADD CONSTRAINT ops_notifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: product_knowledge product_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.product_knowledge
    ADD CONSTRAINT product_knowledge_pkey PRIMARY KEY (id);


--
-- Name: reply_suggestions reply_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.reply_suggestions
    ADD CONSTRAINT reply_suggestions_pkey PRIMARY KEY (id);


--
-- Name: sales_teams sales_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sales_teams
    ADD CONSTRAINT sales_teams_pkey PRIMARY KEY (id);


--
-- Name: sales_units sales_units_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sales_units
    ADD CONSTRAINT sales_units_pkey PRIMARY KEY (id);


--
-- Name: sent_messages sent_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sent_messages
    ADD CONSTRAINT sent_messages_pkey PRIMARY KEY (id);


--
-- Name: sales_teams uq_sales_teams_org_code; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sales_teams
    ADD CONSTRAINT uq_sales_teams_org_code UNIQUE (organization_id, code);


--
-- Name: sales_teams uq_sales_teams_org_name; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sales_teams
    ADD CONSTRAINT uq_sales_teams_org_name UNIQUE (organization_id, name);


--
-- Name: sales_units uq_sales_units_org_code; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sales_units
    ADD CONSTRAINT uq_sales_units_org_code UNIQUE (organization_id, code);


--
-- Name: sales_units uq_sales_units_org_name; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sales_units
    ADD CONSTRAINT uq_sales_units_org_name UNIQUE (organization_id, name);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_ai_extractions_conversation_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_ai_extractions_conversation_id ON public.ai_extractions USING btree (conversation_id);


--
-- Name: ix_approval_logs_reply_suggestion_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_approval_logs_reply_suggestion_id ON public.approval_logs USING btree (reply_suggestion_id);


--
-- Name: ix_audit_logs_action; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: ix_audit_logs_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_audit_logs_organization_id ON public.audit_logs USING btree (organization_id);


--
-- Name: ix_chat_review_cases_conversation_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE UNIQUE INDEX ix_chat_review_cases_conversation_id ON public.chat_review_cases USING btree (conversation_id);


--
-- Name: ix_chat_review_cases_feedback_status; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_chat_review_cases_feedback_status ON public.chat_review_cases USING btree (feedback_status);


--
-- Name: ix_chat_review_cases_lead_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_chat_review_cases_lead_id ON public.chat_review_cases USING btree (lead_id);


--
-- Name: ix_chat_review_cases_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_chat_review_cases_organization_id ON public.chat_review_cases USING btree (organization_id);


--
-- Name: ix_chat_review_cases_reviewer_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_chat_review_cases_reviewer_user_id ON public.chat_review_cases USING btree (reviewer_user_id);


--
-- Name: ix_chat_review_cases_submitted_by_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_chat_review_cases_submitted_by_user_id ON public.chat_review_cases USING btree (submitted_by_user_id);


--
-- Name: ix_chat_review_cases_workflow_scope; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_chat_review_cases_workflow_scope ON public.chat_review_cases USING btree (workflow_scope);


--
-- Name: ix_chat_review_notes_author_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_chat_review_notes_author_user_id ON public.chat_review_notes USING btree (author_user_id);


--
-- Name: ix_chat_review_notes_review_case_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_chat_review_notes_review_case_id ON public.chat_review_notes USING btree (review_case_id);


--
-- Name: ix_conversations_external_thread_key; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_conversations_external_thread_key ON public.conversations USING btree (external_thread_key);


--
-- Name: ix_conversations_lead_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_conversations_lead_id ON public.conversations USING btree (lead_id);


--
-- Name: ix_conversations_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_conversations_organization_id ON public.conversations USING btree (organization_id);


--
-- Name: ix_conversations_provider_key; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_conversations_provider_key ON public.conversations USING btree (provider_key);


--
-- Name: ix_conversations_sales_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_conversations_sales_user_id ON public.conversations USING btree (sales_user_id);


--
-- Name: ix_customer_profiles_assigned_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_customer_profiles_assigned_user_id ON public.customer_profiles USING btree (assigned_user_id);


--
-- Name: ix_customer_profiles_canonical_key; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_customer_profiles_canonical_key ON public.customer_profiles USING btree (canonical_key);


--
-- Name: ix_customer_profiles_merged_into_profile_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_customer_profiles_merged_into_profile_id ON public.customer_profiles USING btree (merged_into_profile_id);


--
-- Name: ix_customer_profiles_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_customer_profiles_organization_id ON public.customer_profiles USING btree (organization_id);


--
-- Name: ix_customer_profiles_status; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_customer_profiles_status ON public.customer_profiles USING btree (status);


--
-- Name: ix_knowledge_update_proposals_chat_review_case_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_knowledge_update_proposals_chat_review_case_id ON public.knowledge_update_proposals USING btree (chat_review_case_id);


--
-- Name: ix_knowledge_update_proposals_conversation_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_knowledge_update_proposals_conversation_id ON public.knowledge_update_proposals USING btree (conversation_id);


--
-- Name: ix_knowledge_update_proposals_lead_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_knowledge_update_proposals_lead_id ON public.knowledge_update_proposals USING btree (lead_id);


--
-- Name: ix_knowledge_update_proposals_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_knowledge_update_proposals_organization_id ON public.knowledge_update_proposals USING btree (organization_id);


--
-- Name: ix_knowledge_update_proposals_proposed_by_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_knowledge_update_proposals_proposed_by_user_id ON public.knowledge_update_proposals USING btree (proposed_by_user_id);


--
-- Name: ix_knowledge_update_proposals_published_product_knowledge_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_knowledge_update_proposals_published_product_knowledge_id ON public.knowledge_update_proposals USING btree (published_product_knowledge_id);


--
-- Name: ix_knowledge_update_proposals_reviewed_by_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_knowledge_update_proposals_reviewed_by_user_id ON public.knowledge_update_proposals USING btree (reviewed_by_user_id);


--
-- Name: ix_kpi_alert_records_acknowledged_by_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_kpi_alert_records_acknowledged_by_user_id ON public.kpi_alert_records USING btree (acknowledged_by_user_id);


--
-- Name: ix_kpi_alert_records_alert_key; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_kpi_alert_records_alert_key ON public.kpi_alert_records USING btree (alert_key);


--
-- Name: ix_kpi_alert_records_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_kpi_alert_records_organization_id ON public.kpi_alert_records USING btree (organization_id);


--
-- Name: ix_kpi_alert_records_resolved_by_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_kpi_alert_records_resolved_by_user_id ON public.kpi_alert_records USING btree (resolved_by_user_id);


--
-- Name: ix_kpi_alert_records_scope_type; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_kpi_alert_records_scope_type ON public.kpi_alert_records USING btree (scope_type);


--
-- Name: ix_kpi_command_snapshots_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_kpi_command_snapshots_organization_id ON public.kpi_command_snapshots USING btree (organization_id);


--
-- Name: ix_kpi_command_snapshots_scope_type; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_kpi_command_snapshots_scope_type ON public.kpi_command_snapshots USING btree (scope_type);


--
-- Name: ix_lead_activity_events_actor_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_activity_events_actor_user_id ON public.lead_activity_events USING btree (actor_user_id);


--
-- Name: ix_lead_activity_events_lead_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_activity_events_lead_id ON public.lead_activity_events USING btree (lead_id);


--
-- Name: ix_lead_activity_events_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_activity_events_organization_id ON public.lead_activity_events USING btree (organization_id);


--
-- Name: ix_lead_deals_lead_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE UNIQUE INDEX ix_lead_deals_lead_id ON public.lead_deals USING btree (lead_id);


--
-- Name: ix_lead_deals_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_deals_organization_id ON public.lead_deals USING btree (organization_id);


--
-- Name: ix_lead_deals_owner_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_deals_owner_user_id ON public.lead_deals USING btree (owner_user_id);


--
-- Name: ix_lead_discipline_logs_actor_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_discipline_logs_actor_user_id ON public.lead_discipline_logs USING btree (actor_user_id);


--
-- Name: ix_lead_discipline_logs_lead_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_discipline_logs_lead_id ON public.lead_discipline_logs USING btree (lead_id);


--
-- Name: ix_lead_discipline_logs_log_date; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_discipline_logs_log_date ON public.lead_discipline_logs USING btree (log_date);


--
-- Name: ix_lead_discipline_logs_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_discipline_logs_organization_id ON public.lead_discipline_logs USING btree (organization_id);


--
-- Name: ix_lead_task_events_actor_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_task_events_actor_user_id ON public.lead_task_events USING btree (actor_user_id);


--
-- Name: ix_lead_task_events_task_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_task_events_task_id ON public.lead_task_events USING btree (task_id);


--
-- Name: ix_lead_tasks_assigned_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_tasks_assigned_user_id ON public.lead_tasks USING btree (assigned_user_id);


--
-- Name: ix_lead_tasks_completed_by_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_tasks_completed_by_user_id ON public.lead_tasks USING btree (completed_by_user_id);


--
-- Name: ix_lead_tasks_lead_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_tasks_lead_id ON public.lead_tasks USING btree (lead_id);


--
-- Name: ix_lead_tasks_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_tasks_organization_id ON public.lead_tasks USING btree (organization_id);


--
-- Name: ix_lead_tasks_workflow_scope; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_lead_tasks_workflow_scope ON public.lead_tasks USING btree (workflow_scope);


--
-- Name: ix_leads_assigned_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_leads_assigned_user_id ON public.leads USING btree (assigned_user_id);


--
-- Name: ix_leads_customer_profile_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_leads_customer_profile_id ON public.leads USING btree (customer_profile_id);


--
-- Name: ix_leads_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_leads_organization_id ON public.leads USING btree (organization_id);


--
-- Name: ix_marketing_execution_items_assigned_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_marketing_execution_items_assigned_user_id ON public.marketing_execution_items USING btree (assigned_user_id);


--
-- Name: ix_marketing_execution_items_created_by_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_marketing_execution_items_created_by_user_id ON public.marketing_execution_items USING btree (created_by_user_id);


--
-- Name: ix_marketing_execution_items_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_marketing_execution_items_organization_id ON public.marketing_execution_items USING btree (organization_id);


--
-- Name: ix_marketing_insight_snapshots_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_marketing_insight_snapshots_organization_id ON public.marketing_insight_snapshots USING btree (organization_id);


--
-- Name: ix_marketing_insight_snapshots_scope_type; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_marketing_insight_snapshots_scope_type ON public.marketing_insight_snapshots USING btree (scope_type);


--
-- Name: ix_messages_conversation_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- Name: ix_messages_external_message_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE UNIQUE INDEX ix_messages_external_message_id ON public.messages USING btree (external_message_id);


--
-- Name: ix_ops_notifications_acknowledged_by_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_ops_notifications_acknowledged_by_user_id ON public.ops_notifications USING btree (acknowledged_by_user_id);


--
-- Name: ix_ops_notifications_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_ops_notifications_organization_id ON public.ops_notifications USING btree (organization_id);


--
-- Name: ix_ops_notifications_source_key; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_ops_notifications_source_key ON public.ops_notifications USING btree (source_key);


--
-- Name: ix_ops_notifications_source_type; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_ops_notifications_source_type ON public.ops_notifications USING btree (source_type);


--
-- Name: ix_ops_notifications_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_ops_notifications_user_id ON public.ops_notifications USING btree (user_id);


--
-- Name: ix_ops_notifications_workflow_scope; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_ops_notifications_workflow_scope ON public.ops_notifications USING btree (workflow_scope);


--
-- Name: ix_organizations_slug; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE UNIQUE INDEX ix_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: ix_product_knowledge_created_by_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_product_knowledge_created_by_user_id ON public.product_knowledge USING btree (created_by_user_id);


--
-- Name: ix_product_knowledge_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_product_knowledge_organization_id ON public.product_knowledge USING btree (organization_id);


--
-- Name: ix_reply_suggestions_ai_extraction_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_reply_suggestions_ai_extraction_id ON public.reply_suggestions USING btree (ai_extraction_id);


--
-- Name: ix_reply_suggestions_conversation_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_reply_suggestions_conversation_id ON public.reply_suggestions USING btree (conversation_id);


--
-- Name: ix_sales_teams_manager_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_sales_teams_manager_user_id ON public.sales_teams USING btree (manager_user_id);


--
-- Name: ix_sales_teams_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_sales_teams_organization_id ON public.sales_teams USING btree (organization_id);


--
-- Name: ix_sales_teams_unit_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_sales_teams_unit_id ON public.sales_teams USING btree (unit_id);


--
-- Name: ix_sales_units_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_sales_units_organization_id ON public.sales_units USING btree (organization_id);


--
-- Name: ix_sent_messages_conversation_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_sent_messages_conversation_id ON public.sent_messages USING btree (conversation_id);


--
-- Name: ix_sent_messages_reply_suggestion_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_sent_messages_reply_suggestion_id ON public.sent_messages USING btree (reply_suggestion_id);


--
-- Name: ix_users_created_by_user_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_users_created_by_user_id ON public.users USING btree (created_by_user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_organization_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_users_organization_id ON public.users USING btree (organization_id);


--
-- Name: ix_users_team_id; Type: INDEX; Schema: public; Owner: clara_user
--

CREATE INDEX ix_users_team_id ON public.users USING btree (team_id);


--
-- Name: ai_extractions ai_extractions_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.ai_extractions
    ADD CONSTRAINT ai_extractions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: approval_logs approval_logs_reply_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.approval_logs
    ADD CONSTRAINT approval_logs_reply_suggestion_id_fkey FOREIGN KEY (reply_suggestion_id) REFERENCES public.reply_suggestions(id) ON DELETE CASCADE;


--
-- Name: chat_review_cases chat_review_cases_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.chat_review_cases
    ADD CONSTRAINT chat_review_cases_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: chat_review_cases chat_review_cases_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.chat_review_cases
    ADD CONSTRAINT chat_review_cases_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: chat_review_cases chat_review_cases_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.chat_review_cases
    ADD CONSTRAINT chat_review_cases_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: chat_review_cases chat_review_cases_reviewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.chat_review_cases
    ADD CONSTRAINT chat_review_cases_reviewer_user_id_fkey FOREIGN KEY (reviewer_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_review_cases chat_review_cases_submitted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.chat_review_cases
    ADD CONSTRAINT chat_review_cases_submitted_by_user_id_fkey FOREIGN KEY (submitted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_review_notes chat_review_notes_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.chat_review_notes
    ADD CONSTRAINT chat_review_notes_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_review_notes chat_review_notes_review_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.chat_review_notes
    ADD CONSTRAINT chat_review_notes_review_case_id_fkey FOREIGN KEY (review_case_id) REFERENCES public.chat_review_cases(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customer_profiles customer_profiles_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customer_profiles customer_profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: conversations fk_conversations_lead_id_leads; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT fk_conversations_lead_id_leads FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: customer_profiles fk_customer_profiles_merged_into_profile_id; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT fk_customer_profiles_merged_into_profile_id FOREIGN KEY (merged_into_profile_id) REFERENCES public.customer_profiles(id) ON DELETE SET NULL;


--
-- Name: kpi_alert_records fk_kpi_alert_records_resolved_by_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.kpi_alert_records
    ADD CONSTRAINT fk_kpi_alert_records_resolved_by_user_id_users FOREIGN KEY (resolved_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_tasks fk_lead_tasks_completed_by_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_tasks
    ADD CONSTRAINT fk_lead_tasks_completed_by_user_id_users FOREIGN KEY (completed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leads fk_leads_customer_profile_id_customer_profiles; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT fk_leads_customer_profile_id_customer_profiles FOREIGN KEY (customer_profile_id) REFERENCES public.customer_profiles(id) ON DELETE SET NULL;


--
-- Name: product_knowledge fk_product_knowledge_created_by_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.product_knowledge
    ADD CONSTRAINT fk_product_knowledge_created_by_user_id_users FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users fk_users_created_by_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_created_by_user_id_users FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users fk_users_team_id_sales_teams; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_team_id_sales_teams FOREIGN KEY (team_id) REFERENCES public.sales_teams(id) ON DELETE SET NULL;


--
-- Name: knowledge_update_proposals knowledge_update_proposals_chat_review_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.knowledge_update_proposals
    ADD CONSTRAINT knowledge_update_proposals_chat_review_case_id_fkey FOREIGN KEY (chat_review_case_id) REFERENCES public.chat_review_cases(id) ON DELETE SET NULL;


--
-- Name: knowledge_update_proposals knowledge_update_proposals_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.knowledge_update_proposals
    ADD CONSTRAINT knowledge_update_proposals_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: knowledge_update_proposals knowledge_update_proposals_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.knowledge_update_proposals
    ADD CONSTRAINT knowledge_update_proposals_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: knowledge_update_proposals knowledge_update_proposals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.knowledge_update_proposals
    ADD CONSTRAINT knowledge_update_proposals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: knowledge_update_proposals knowledge_update_proposals_proposed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.knowledge_update_proposals
    ADD CONSTRAINT knowledge_update_proposals_proposed_by_user_id_fkey FOREIGN KEY (proposed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_update_proposals knowledge_update_proposals_published_product_knowledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.knowledge_update_proposals
    ADD CONSTRAINT knowledge_update_proposals_published_product_knowledge_id_fkey FOREIGN KEY (published_product_knowledge_id) REFERENCES public.product_knowledge(id) ON DELETE SET NULL;


--
-- Name: knowledge_update_proposals knowledge_update_proposals_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.knowledge_update_proposals
    ADD CONSTRAINT knowledge_update_proposals_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: kpi_alert_records kpi_alert_records_acknowledged_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.kpi_alert_records
    ADD CONSTRAINT kpi_alert_records_acknowledged_by_user_id_fkey FOREIGN KEY (acknowledged_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: kpi_alert_records kpi_alert_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.kpi_alert_records
    ADD CONSTRAINT kpi_alert_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: kpi_command_snapshots kpi_command_snapshots_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.kpi_command_snapshots
    ADD CONSTRAINT kpi_command_snapshots_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_activity_events lead_activity_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_activity_events
    ADD CONSTRAINT lead_activity_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_activity_events lead_activity_events_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_activity_events
    ADD CONSTRAINT lead_activity_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_activity_events lead_activity_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_activity_events
    ADD CONSTRAINT lead_activity_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: lead_deals lead_deals_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_deals
    ADD CONSTRAINT lead_deals_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_deals lead_deals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_deals
    ADD CONSTRAINT lead_deals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: lead_deals lead_deals_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_deals
    ADD CONSTRAINT lead_deals_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_discipline_logs lead_discipline_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_discipline_logs
    ADD CONSTRAINT lead_discipline_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_discipline_logs lead_discipline_logs_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_discipline_logs
    ADD CONSTRAINT lead_discipline_logs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_discipline_logs lead_discipline_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_discipline_logs
    ADD CONSTRAINT lead_discipline_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: lead_task_events lead_task_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_task_events
    ADD CONSTRAINT lead_task_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_task_events lead_task_events_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_task_events
    ADD CONSTRAINT lead_task_events_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.lead_tasks(id) ON DELETE CASCADE;


--
-- Name: lead_tasks lead_tasks_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_tasks
    ADD CONSTRAINT lead_tasks_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_tasks lead_tasks_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_tasks
    ADD CONSTRAINT lead_tasks_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_tasks lead_tasks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.lead_tasks
    ADD CONSTRAINT lead_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: leads leads_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leads leads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: marketing_execution_items marketing_execution_items_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.marketing_execution_items
    ADD CONSTRAINT marketing_execution_items_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: marketing_execution_items marketing_execution_items_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.marketing_execution_items
    ADD CONSTRAINT marketing_execution_items_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: marketing_execution_items marketing_execution_items_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.marketing_execution_items
    ADD CONSTRAINT marketing_execution_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: marketing_insight_snapshots marketing_insight_snapshots_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.marketing_insight_snapshots
    ADD CONSTRAINT marketing_insight_snapshots_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: ops_notifications ops_notifications_acknowledged_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.ops_notifications
    ADD CONSTRAINT ops_notifications_acknowledged_by_user_id_fkey FOREIGN KEY (acknowledged_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ops_notifications ops_notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.ops_notifications
    ADD CONSTRAINT ops_notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ops_notifications ops_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.ops_notifications
    ADD CONSTRAINT ops_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: product_knowledge product_knowledge_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.product_knowledge
    ADD CONSTRAINT product_knowledge_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: reply_suggestions reply_suggestions_ai_extraction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.reply_suggestions
    ADD CONSTRAINT reply_suggestions_ai_extraction_id_fkey FOREIGN KEY (ai_extraction_id) REFERENCES public.ai_extractions(id) ON DELETE CASCADE;


--
-- Name: reply_suggestions reply_suggestions_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.reply_suggestions
    ADD CONSTRAINT reply_suggestions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: sales_teams sales_teams_manager_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sales_teams
    ADD CONSTRAINT sales_teams_manager_user_id_fkey FOREIGN KEY (manager_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sales_teams sales_teams_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sales_teams
    ADD CONSTRAINT sales_teams_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sales_teams sales_teams_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sales_teams
    ADD CONSTRAINT sales_teams_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.sales_units(id) ON DELETE SET NULL;


--
-- Name: sales_units sales_units_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sales_units
    ADD CONSTRAINT sales_units_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sent_messages sent_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sent_messages
    ADD CONSTRAINT sent_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: sent_messages sent_messages_reply_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.sent_messages
    ADD CONSTRAINT sent_messages_reply_suggestion_id_fkey FOREIGN KEY (reply_suggestion_id) REFERENCES public.reply_suggestions(id) ON DELETE SET NULL;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: clara_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict qml3vHpDUaQZa93PfaMVEcbgF0WFVLT4eQaRSl6Zmw0LLMu7avYzarblbucoqm7

