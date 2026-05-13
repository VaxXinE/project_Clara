import { useEffect, useMemo, useState } from "react"

import type {
  ClaraExtensionSessionUser,
  WhatsAppActionResponse,
  WhatsAppChatSnapshot,
  WhatsAppMessage,
  WhatsAppMessageDirection,
  WhatsAppReadResponse,
  WhatsAppSuggestionDetail,
  WhatsAppSuggestionResult
} from "~/types/whatsapp"
import {
  getChatSnapshotProxyUrl,
  getClaraAuthHeaders,
  getClaraDashboardLoginUrl,
  getClaraReplySuggestionsUrl,
  getClaraSendReplyUrl,
  getClaraSessionOrigins,
  getConfiguredClaraApiBaseUrl,
  getConfiguredClaraAuthCookieName,
  getConfiguredProxyUrl,
  getCurrentClaraSessionUser,
  getProxyCandidates,
  getReplySuggestionCandidates,
  getSnapshotSyncCandidates
} from "~/utils/proxy"

import chatWallpaper from "./assets/eb24786e5579a01bdd4bb103695b8286.jpg"

const OPENAI_PROXY_URL = getConfiguredProxyUrl()
const CHAT_SNAPSHOT_PROXY_URL = getChatSnapshotProxyUrl(OPENAI_PROXY_URL)
const INSERT_LOCK_KEY = "__sgExtensionSidePanelInsertLock__"
const AUTO_REFRESH_INTERVAL_MS = 2500
const SUGGESTION_TONE_LABELS = ["Friendly", "Casual", "Profesional"] as const
const LOGIN_MESSAGE =
  "Login dulu di dashboard Clara supaya extension terhubung ke akun yang sama."
const AUTH_REFRESH_INTERVAL_MS = 2000

const panelCss = `
  .clara-panel {
    --clara-ink: #13212d;
    --clara-muted: #617383;
    --clara-line: rgba(19, 33, 45, 0.1);
    --clara-surface: rgba(255, 253, 248, 0.94);
    --clara-surface-2: rgba(255, 255, 255, 0.82);
    --clara-accent: #0f766e;
    --clara-accent-strong: #164e63;
    --clara-warm: #d97706;
    --clara-danger: #b42318;
    background:
      radial-gradient(circle at top left, rgba(255,255,255,0.9), rgba(255,255,255,0) 28%),
      radial-gradient(circle at 100% 0%, rgba(14,165,233,0.12), rgba(14,165,233,0) 32%),
      linear-gradient(180deg, #f6f1e8 0%, #eef3f7 42%, #f7fbf8 100%);
    color: var(--clara-ink);
    font-family: "Aptos", "Segoe UI Variable Display", "Trebuchet MS", "Segoe UI", sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
    padding: 12px;
    box-sizing: border-box;
    width: 100%;
  }

  .clara-panel *,
  .clara-panel *::before,
  .clara-panel *::after {
    box-sizing: border-box;
  }

  .clara-stage {
    display: grid;
    gap: 12px;
    min-width: 0;
  }

  .clara-stage > * {
    max-width: 100%;
    min-width: 0;
  }

  .clara-hero {
    background:
      radial-gradient(circle at top right, rgba(249, 183, 77, 0.24), rgba(249, 183, 77, 0) 28%),
      linear-gradient(155deg, #11222d 0%, #133b46 48%, #175f66 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 22px;
    box-shadow:
      0 24px 54px rgba(17, 34, 45, 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
    color: #f8fbfc;
    overflow: hidden;
    padding: 14px;
    position: relative;
  }

  .clara-hero::after {
    background:
      linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0)),
      repeating-linear-gradient(
        135deg,
        rgba(255,255,255,0.03),
        rgba(255,255,255,0.03) 10px,
        rgba(255,255,255,0) 10px,
        rgba(255,255,255,0) 20px
      );
    content: "";
    inset: 0;
    pointer-events: none;
    position: absolute;
  }

  .clara-hero__top,
  .clara-pane__header,
  .clara-draft__head {
    align-items: flex-start;
    display: flex;
    flex-wrap: nowrap;
    gap: 12px;
    justify-content: space-between;
    position: relative;
    z-index: 1;
  }

  .clara-hero__top {
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr);
  }

  .clara-hero__eyebrow {
    color: rgba(243, 248, 250, 0.74);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .clara-hero__title {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 0.98;
    margin: 8px 0 0;
    max-width: none;
  }

  .clara-hero__copy {
    color: rgba(243, 248, 250, 0.82);
    font-size: 12px;
    line-height: 1.5;
    margin: 8px 0 0;
    max-width: none;
  }

  .clara-identity {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 16px;
    min-width: 0;
    max-width: 100%;
    width: 100%;
    padding: 12px;
  }

  .clara-identity__label {
    color: rgba(243, 248, 250, 0.68);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .clara-identity__name {
    font-size: 15px;
    font-weight: 800;
    line-height: 1.2;
    margin-top: 8px;
    overflow-wrap: anywhere;
  }

  .clara-identity__meta {
    color: rgba(243, 248, 250, 0.74);
    font-size: 11px;
    line-height: 1.45;
    margin-top: 6px;
    overflow-wrap: anywhere;
  }

  .clara-pane {
    background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(252,250,245,0.88));
    border: 1px solid rgba(255, 255, 255, 0.82);
    border-radius: 22px;
    box-shadow:
      0 20px 42px rgba(27, 43, 55, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.84);
    display: grid;
    gap: 12px;
    min-width: 0;
    padding: 14px;
  }

  .clara-pane--reply {
    background:
      linear-gradient(180deg, rgba(247,252,255,0.94), rgba(253,249,244,0.92));
  }

  .clara-pane__eyebrow {
    color: #617383;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .clara-pane__title {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin-top: 4px;
  }

  .clara-pane__copy {
    color: var(--clara-muted);
    font-size: 12px;
    line-height: 1.5;
    margin-top: 4px;
  }

  .clara-chip {
    align-items: center;
    border-radius: 999px;
    display: inline-flex;
    font-size: 11px;
    font-weight: 700;
    justify-content: center;
    max-width: 100%;
    min-height: 28px;
    min-width: 0;
    padding: 6px 10px;
    text-align: center;
    white-space: normal;
  }

  .clara-chip--dark {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #f8fbfc;
  }

  .clara-chip--soft {
    background: rgba(19, 33, 45, 0.05);
    border: 1px solid rgba(19, 33, 45, 0.08);
    color: #274052;
  }

  .clara-chip--good {
    background: rgba(15, 118, 110, 0.1);
    border: 1px solid rgba(15, 118, 110, 0.18);
    color: #0f5f58;
  }

  .clara-chip--warn {
    background: rgba(217, 119, 6, 0.1);
    border: 1px solid rgba(217, 119, 6, 0.18);
    color: #9a5d08;
  }

  .clara-button {
    appearance: none;
    border: none;
    border-radius: 16px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.2;
    min-height: 42px;
    min-width: 0;
    max-width: 100%;
    padding: 11px 13px;
    transition:
      transform 160ms ease,
      opacity 160ms ease,
      box-shadow 160ms ease;
  }

  .clara-button:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .clara-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .clara-button--block {
    width: 100%;
  }

  .clara-button--primary {
    background: linear-gradient(135deg, #124a53 0%, #1d5c86 100%);
    box-shadow:
      0 18px 30px rgba(18, 74, 83, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    color: #ffffff;
  }

  .clara-button--ghost {
    background: rgba(19, 33, 45, 0.06);
    border: 1px solid rgba(19, 33, 45, 0.08);
    color: #1f3e52;
  }

  .clara-button--insert {
    background: linear-gradient(135deg, #18364a 0%, #0f766e 100%);
    color: #ffffff;
  }

  .clara-button--send {
    background: linear-gradient(135deg, #0f766e 0%, #1d5c86 100%);
    color: #ffffff;
  }

  .clara-note {
    border-radius: 16px;
    font-size: 12px;
    line-height: 1.5;
    padding: 11px 12px;
  }

  .clara-note--warn {
    background: rgba(255, 248, 235, 0.96);
    border: 1px solid rgba(233, 176, 78, 0.35);
    color: #8a5a0a;
  }

  .clara-note--success {
    background: rgba(237, 250, 246, 0.98);
    border: 1px solid rgba(84, 176, 144, 0.26);
    color: #12584f;
  }

  .clara-note--error {
    background: rgba(254, 242, 240, 0.98);
    border: 1px solid rgba(229, 137, 121, 0.26);
    color: var(--clara-danger);
  }

  .clara-overview {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .clara-chat-shell {
    background: #e7ded5;
    border: 1px solid rgba(19, 33, 45, 0.08);
    border-radius: 20px;
    overflow: hidden;
  }

  .clara-chat-appbar {
    align-items: center;
    background: #f0f2f5;
    border-bottom: 1px solid rgba(19, 33, 45, 0.08);
    display: grid;
    gap: 12px;
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding: 10px 12px;
  }

  .clara-chat-avatar {
    align-items: center;
    background: linear-gradient(135deg, #1f6f78, #2f8c97);
    border-radius: 50%;
    color: #ffffff;
    display: inline-flex;
    font-size: 14px;
    font-weight: 800;
    height: 36px;
    justify-content: center;
    width: 36px;
  }

  .clara-chat-appbar__title {
    color: #101f2c;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .clara-chat-appbar__meta {
    color: #667781;
    font-size: 11px;
    line-height: 1.35;
    margin-top: 2px;
    overflow-wrap: anywhere;
  }

  .clara-chat-latest {
    background: rgba(255, 255, 255, 0.7);
    border-bottom: 1px solid rgba(19, 33, 45, 0.06);
    color: #526673;
    font-size: 11px;
    line-height: 1.45;
    padding: 8px 12px;
  }

  .clara-chat-latest strong {
    color: #1d3342;
  }

  .clara-thread {
    background:
      linear-gradient(rgba(239, 234, 226, 0.8), rgba(239, 234, 226, 0.8)),
      url("${chatWallpaper}") center / cover no-repeat;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 280px;
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 12px;
  }

  .clara-thread::-webkit-scrollbar {
    width: 8px;
  }

  .clara-thread::-webkit-scrollbar-thumb {
    background: rgba(97, 115, 131, 0.28);
    border-radius: 999px;
  }

  .clara-thread-message {
    background: #ffffff;
    border-radius: 10px;
    box-shadow: 0 1px 0 rgba(17, 27, 33, 0.08), 0 1px 3px rgba(17, 27, 33, 0.12);
    max-width: 82%;
    min-width: 96px;
    padding: 7px 9px 5px;
    position: relative;
    width: fit-content;
  }

  .clara-thread-message::before {
    content: "";
    position: absolute;
    top: 0;
  }

  .clara-thread-message--in::before {
    border-right: 10px solid #ffffff;
    border-top: 10px solid #ffffff;
    left: -5px;
    transform: skewX(-24deg);
  }

  .clara-thread-message--out::before {
    border-left: 10px solid #d9fdd3;
    border-top: 10px solid #d9fdd3;
    right: -5px;
    transform: skewX(24deg);
  }

  .clara-thread-message--in {
    align-self: flex-start;
  }

  .clara-thread-message--out {
    align-self: flex-end;
    background: #d9fdd3;
  }

  .clara-thread-message__author {
    color: #1f6f78;
    font-size: 11px;
    font-weight: 800;
    line-height: 1.3;
    margin-bottom: 4px;
    overflow-wrap: anywhere;
  }

  .clara-thread-message__text {
    color: #111b21;
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .clara-thread-message__footer {
    color: #667781;
    display: flex;
    font-size: 10px;
    justify-content: flex-end;
    line-height: 1.2;
    margin-top: 4px;
  }

  .clara-empty {
    background: rgba(255,255,255,0.6);
    border: 1px dashed rgba(19, 33, 45, 0.14);
    border-radius: 16px;
    color: #677a89;
    font-size: 13px;
    line-height: 1.6;
    padding: 14px;
  }

  .clara-empty__title {
    color: #294356;
    font-size: 13px;
    font-weight: 800;
    margin-bottom: 6px;
  }

  .clara-empty__meta {
    color: #677a89;
    font-size: 12px;
    line-height: 1.6;
  }

  .clara-brief {
    background:
      linear-gradient(180deg, rgba(247,252,255,0.96), rgba(255,249,241,0.96));
    border: 1px solid rgba(19, 33, 45, 0.06);
    border-radius: 18px;
    display: grid;
    gap: 10px;
    padding: 12px;
  }

  .clara-brief__title {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #516879;
  }

  .clara-brief__grid {
    display: grid;
    gap: 10px;
  }

  .clara-brief__text {
    color: #304756;
    font-size: 12px;
    line-height: 1.65;
    overflow-wrap: anywhere;
  }

  .clara-draft-list {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .clara-draft {
    background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,250,253,0.88));
    border: 1px solid rgba(19, 33, 45, 0.06);
    border-radius: 18px;
    box-shadow:
      0 14px 28px rgba(23, 40, 53, 0.08),
      inset 0 1px 0 rgba(255,255,255,0.84);
    display: grid;
    gap: 10px;
    min-width: 0;
    padding: 12px;
  }

  .clara-draft__number {
    color: #b16b05;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .clara-draft__tone {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }

  .clara-draft__hint {
    color: var(--clara-muted);
    font-size: 11px;
    line-height: 1.45;
    margin-top: 4px;
  }

  .clara-draft__text {
    color: #203745;
    font-size: 12px;
    line-height: 1.58;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .clara-draft__reason {
    background: rgba(19, 33, 45, 0.04);
    border-radius: 14px;
    color: #506575;
    font-size: 12px;
    line-height: 1.6;
    padding: 10px 11px;
  }

  .clara-draft__actions {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-width: 0;
  }

  @media (max-width: 560px) {
    .clara-panel {
      padding: 12px;
    }

    .clara-hero,
    .clara-pane {
      border-radius: 20px;
      padding: 12px;
    }

    .clara-hero__title {
      font-size: 22px;
    }

    .clara-overview__grid,
    .clara-draft__actions {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 380px) {
    .clara-hero__title {
      font-size: 24px;
    }
  }
`

const panelStyle = {
  background:
    "radial-gradient(circle at 10% 10%, rgba(255,255,255,0.95), rgba(255,255,255,0) 24%), radial-gradient(circle at 88% 14%, rgba(112,199,255,0.28), rgba(112,199,255,0) 26%), radial-gradient(circle at 18% 78%, rgba(79,255,195,0.16), rgba(79,255,195,0) 24%), linear-gradient(160deg, #eef6ff 0%, #edf5ff 38%, #f4fbf7 100%)",
  color: "#14212f",
  fontFamily:
    "'Aptos', 'Segoe UI Variable Display', 'Trebuchet MS', 'Segoe UI', sans-serif",
  minHeight: "100vh",
  overflowX: "hidden",
  padding: 16,
  width: "100%"
} as const

const primaryButtonStyle = {
  background:
    "linear-gradient(135deg, rgba(13,115,104,0.98) 0%, rgba(25,87,148,0.95) 100%)",
  border: "1px solid rgba(255, 255, 255, 0.26)",
  borderRadius: 18,
  boxShadow:
    "0 18px 36px rgba(36, 96, 128, 0.2), inset 0 1px 0 rgba(255,255,255,0.24)",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: "0.01em",
  minHeight: 48,
  padding: "14px 16px",
  width: "100%"
} as const

const secondaryButtonStyle = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(243,248,252,0.78))",
  border: "1px solid rgba(219, 231, 243, 0.92)",
  borderRadius: 18,
  boxShadow:
    "0 12px 28px rgba(51, 77, 107, 0.08), inset 0 1px 0 rgba(255,255,255,0.82)",
  color: "#15344d",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  minHeight: 48,
  padding: "14px 16px",
  width: "100%"
} as const

const actionButtonStyle = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(214,226,239,0.96)",
  borderRadius: 14,
  color: "#1c3954",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  minHeight: 40,
  padding: "10px 12px"
} as const

const softCardStyle = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.84), rgba(250,252,255,0.62))",
  backdropFilter: "blur(18px) saturate(155%)",
  border: "1px solid rgba(255, 255, 255, 0.76)",
  borderRadius: 24,
  boxShadow:
    "0 18px 40px rgba(64, 87, 109, 0.12), inset 0 1px 0 rgba(255,255,255,0.86)",
  padding: 16
} as const

const chipStyle = {
  alignItems: "center",
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(224,235,244,0.94)",
  borderRadius: 999,
  color: "#35546d",
  display: "inline-flex",
  fontSize: 11,
  fontWeight: 700,
  justifyContent: "center",
  letterSpacing: "0.04em",
  padding: "7px 11px",
  textAlign: "center",
  textTransform: "uppercase"
} as const

const insertReplyIntoPage = (text: string): WhatsAppActionResponse => {
  const getChatRoot = () => {
    const selectors = [
      '#main[data-testid="conversation-panel-wrapper"]',
      "#main",
      '[data-testid="conversation-panel-wrapper"]'
    ]

    for (const selector of selectors) {
      const node = document.querySelector<HTMLElement>(selector)

      if (node) {
        return node
      }
    }

    return null
  }

  const getConversationTitle = (chatRoot: HTMLElement) => {
    const titleSelectors = [
      '[data-testid="conversation-info-header-chat-title"]',
      "header [title]",
      'header [dir="auto"]'
    ]

    for (const selector of titleSelectors) {
      const node = chatRoot.querySelector<HTMLElement>(selector)
      const title =
        node?.getAttribute("title")?.trim() || node?.textContent?.trim()

      if (title) {
        return title
      }
    }

    return ""
  }

  const getComposeBox = () => {
    const selectors = [
      '[data-testid="conversation-compose-box-input"][contenteditable="true"]',
      '[contenteditable="true"][data-lexical-editor="true"]',
      'footer [contenteditable="true"][role="textbox"]'
    ]

    for (const selector of selectors) {
      const node = document.querySelector<HTMLElement>(selector)

      if (node) {
        return node
      }
    }

    return null
  }

  const getComposeText = (composeBox: HTMLElement) =>
    composeBox.innerText.replace(/\s+/g, " ").trim()

  const chatRoot = getChatRoot()

  if (!chatRoot || !getConversationTitle(chatRoot)) {
    return {
      error:
        "Buka percakapan WhatsApp yang aktif dulu sebelum memasukkan balasan.",
      ok: false
    }
  }

  const composeBox = getComposeBox()

  if (!composeBox) {
    return {
      error: "Kolom ketik WhatsApp belum ditemukan.",
      ok: false
    }
  }

  const normalizedText = text.trim()

  if (!normalizedText) {
    return {
      error: "Teks balasan kosong.",
      ok: false
    }
  }

  const activeLock = (
    window as typeof window & {
      [INSERT_LOCK_KEY]?: { text: string; timestamp: number }
    }
  )[INSERT_LOCK_KEY]

  if (
    activeLock &&
    activeLock.text === normalizedText &&
    Date.now() - activeLock.timestamp < 1200
  ) {
    return {
      ok: true
    }
  }

  if (getComposeText(composeBox) === normalizedText) {
    return {
      ok: true
    }
  }

  ;(
    window as typeof window & {
      [INSERT_LOCK_KEY]?: { text: string; timestamp: number }
    }
  )[INSERT_LOCK_KEY] = {
    text: normalizedText,
    timestamp: Date.now()
  }

  composeBox.focus()

  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(composeBox)
  selection?.removeAllRanges()
  selection?.addRange(range)

  let insertedWithNativeCommand = false

  try {
    insertedWithNativeCommand = document.execCommand(
      "insertText",
      false,
      normalizedText
    )
  } catch (_error) {
    // Ignore and fall back to manual insertion below.
  }

  if (
    insertedWithNativeCommand &&
    getComposeText(composeBox) === normalizedText
  ) {
    const afterRange = document.createRange()
    afterRange.selectNodeContents(composeBox)
    afterRange.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(afterRange)
    composeBox.focus()

    return {
      ok: true
    }
  }

  if (getComposeText(composeBox) !== normalizedText) {
    const paragraph = document.createElement("p")
    paragraph.setAttribute("dir", "auto")
    paragraph.appendChild(document.createTextNode(normalizedText))
    composeBox.replaceChildren(paragraph)
  }

  composeBox.dispatchEvent(new Event("input", { bubbles: true }))
  composeBox.dispatchEvent(new Event("change", { bubbles: true }))

  const afterRange = document.createRange()
  afterRange.selectNodeContents(composeBox)
  afterRange.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(afterRange)
  composeBox.focus()

  return {
    ok: true
  }
}

const sendReplyFromPanel = (text: string): WhatsAppActionResponse => {
  const insertResult = insertReplyIntoPage(text)

  if (!insertResult.ok) {
    return insertResult
  }

  const selectors = [
    '[data-testid="compose-btn-send"]',
    'button[aria-label="Send"]',
    'button[aria-label="Kirim"]',
    'span[data-icon="send"]'
  ]

  for (const selector of selectors) {
    const node = document.querySelector<HTMLElement>(selector)
    const button =
      node?.tagName === "BUTTON"
        ? (node as HTMLButtonElement)
        : node?.closest("button")

    if (button && !button.hasAttribute("disabled")) {
      button.click()

      return {
        ok: true
      }
    }
  }

  const composeBox = document.querySelector<HTMLElement>(
    '[data-testid="conversation-compose-box-input"][contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], footer [contenteditable="true"][role="textbox"]'
  )

  if (!composeBox) {
    return {
      error: "Kolom ketik WhatsApp belum ditemukan.",
      ok: false
    }
  }

  composeBox.focus()
  composeBox.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter"
    })
  )
  composeBox.dispatchEvent(
    new KeyboardEvent("keyup", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter"
    })
  )

  return {
    ok: true
  }
}

const normalizeSuggestionPayload = (payload: any): WhatsAppSuggestionResult => {
  const suggestions = Array.isArray(payload?.suggestions)
    ? payload.suggestions.filter(
        (item: unknown): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : []

  const suggestionDetails = Array.isArray(payload?.suggestion_details)
    ? payload.suggestion_details
        .filter(
          (item: unknown): item is WhatsAppSuggestionDetail =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { text?: unknown }).text === "string" &&
            (item as { text: string }).text.trim().length > 0
        )
        .map((item) => ({
          reasoning:
            typeof item.reasoning === "string" &&
            item.reasoning.trim().length > 0
              ? item.reasoning
              : undefined,
          text: item.text,
          tone:
            typeof item.tone === "string" && item.tone.trim().length > 0
              ? item.tone
              : undefined
        }))
    : []

  return {
    actionMode:
      typeof payload?.actionMode === "string"
        ? payload.actionMode
        : typeof payload?.action_mode === "string"
          ? payload.action_mode
          : undefined,
    conversationId:
      typeof payload?.conversationId === "string"
        ? payload.conversationId
        : typeof payload?.conversation_id === "string"
          ? payload.conversation_id
          : undefined,
    customerSummary:
      typeof payload?.customerSummary === "string"
        ? payload.customerSummary
        : typeof payload?.customer_summary === "string"
          ? payload.customer_summary
          : undefined,
    nextBestAction:
      typeof payload?.nextBestAction === "string"
        ? payload.nextBestAction
        : typeof payload?.next_best_action === "string"
          ? payload.next_best_action
          : undefined,
    replySuggestionId:
      typeof payload?.replySuggestionId === "string"
        ? payload.replySuggestionId
        : typeof payload?.reply_suggestion_id === "string"
          ? payload.reply_suggestion_id
          : undefined,
    riskLevel:
      typeof payload?.riskLevel === "string"
        ? payload.riskLevel
        : typeof payload?.risk_level === "string"
          ? payload.risk_level
          : undefined,
    suggestionDetails,
    suggestions: suggestions.slice(0, 3)
  }
}

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  return tab
}

const readWhatsAppFromPage = (): WhatsAppReadResponse => {
  const parsePrePlainText = (value: string) => {
    const trimmedValue = value.trim()
    const match = trimmedValue.match(
      /^\[(?<timestamp>[^\]]+)\]\s?(?<author>.*?)(?::)?$/
    )

    return {
      author: match?.groups?.author?.trim() || "",
      timestampLabel: match?.groups?.timestamp?.trim() || ""
    }
  }

  const getChatRoot = () => {
    const selectors = [
      '#main[data-testid="conversation-panel-wrapper"]',
      "#main",
      '[data-testid="conversation-panel-wrapper"]'
    ]

    for (const selector of selectors) {
      const node = document.querySelector<HTMLElement>(selector)

      if (node) {
        return node
      }
    }

    return null
  }

  const getConversationTitle = (chatRoot: HTMLElement) => {
    const titleSelectors = [
      '[data-testid="conversation-info-header-chat-title"]',
      "header [title]",
      'header [dir="auto"]'
    ]

    for (const selector of titleSelectors) {
      const node = chatRoot.querySelector<HTMLElement>(selector)
      const title =
        node?.getAttribute("title")?.trim() || node?.textContent?.trim()

      if (title) {
        return title
      }
    }

    return ""
  }

  const getConversationSubtitle = (chatRoot: HTMLElement) => {
    const subtitleSelectors = [
      '[data-testid="chat-subtitle"]',
      "header span[title]"
    ]

    for (const selector of subtitleSelectors) {
      const node = chatRoot.querySelector<HTMLElement>(selector)
      const subtitle =
        node?.getAttribute("title")?.trim() || node?.textContent?.trim()

      if (subtitle) {
        return subtitle
      }
    }

    return ""
  }

  const getMessageDirection = (
    container: HTMLElement
  ): WhatsAppMessageDirection => {
    const bubble = container.closest(".message-out, .message-in")

    return bubble?.classList.contains("message-out") ? "outgoing" : "incoming"
  }

  const getLeafTextCandidates = (nodes: HTMLElement[]) => {
    return nodes.filter(
      (node) =>
        !nodes.some(
          (otherNode) => otherNode !== node && node.contains(otherNode)
        )
    )
  }

  const getMessageText = (container: HTMLElement) => {
    const primaryCandidates = getLeafTextCandidates(
      Array.from(
        container.querySelectorAll<HTMLElement>('[data-testid="msg-text"]')
      )
    )
    const fallbackCandidates = getLeafTextCandidates(
      Array.from(
        container.querySelectorAll<HTMLElement>(
          '[data-testid="selectable-text"], .copyable-text'
        )
      )
    )
    const candidates =
      primaryCandidates.length > 0 ? primaryCandidates : fallbackCandidates

    const uniqueTexts = Array.from(
      new Set(
        candidates
          .map((node) => node.innerText.replace(/\s+/g, " ").trim())
          .filter(Boolean)
      )
    )

    if (uniqueTexts.length > 0) {
      return uniqueTexts.join("\n")
    }

    const mediaLabel = container
      .querySelector<HTMLElement>('[data-testid="media-caption"], [aria-label]')
      ?.innerText?.trim()

    return mediaLabel || ""
  }

  const chatRoot = getChatRoot()
  if (!chatRoot) {
    return {
      error: "Panel chat WhatsApp Web belum ditemukan.",
      ok: false
    }
  }

  const chatTitle = getConversationTitle(chatRoot)

  if (!chatTitle) {
    return {
      error: "Belum ada percakapan yang sedang dibuka.",
      ok: false
    }
  }

  const messageContainers = Array.from(
    chatRoot.querySelectorAll<HTMLElement>(
      '[data-testid="conversation-panel-messages"] [data-testid="msg-container"], [data-testid="msg-container"]'
    )
  )

  const messages: WhatsAppMessage[] = messageContainers
    .map((container, index) => {
      const metaSource =
        container
          .querySelector<HTMLElement>("[data-pre-plain-text]")
          ?.getAttribute("data-pre-plain-text") || ""
      const parsedMeta = parsePrePlainText(metaSource)
      const text = getMessageText(container)

      if (!text) {
        return null
      }

      return {
        author:
          parsedMeta.author ||
          (getMessageDirection(container) === "outgoing" ? "Anda" : chatTitle),
        direction: getMessageDirection(container),
        id: `${parsedMeta.timestampLabel}-${index}`,
        text,
        timestampLabel: parsedMeta.timestampLabel
      }
    })
    .filter((message): message is WhatsAppMessage => Boolean(message))

  return {
    data: {
      capturedAt: new Date().toISOString(),
      chatSubtitle: getConversationSubtitle(chatRoot),
      chatTitle,
      messages
    },
    ok: true
  }
}

const fetchSuggestionsFromProxyDirectly = async (
  chatData: WhatsAppChatSnapshot
) => {
  let lastFetchError = ""

  for (const proxyUrl of getReplySuggestionCandidates()) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData
        }),
        headers: {
          "Content-Type": "application/json",
          ...(await getClaraAuthHeaders())
        },
        method: "POST"
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            `API Clara/proxy gagal memproses permintaan saran jawaban di ${proxyUrl}.`
        )
      }

      const normalized = normalizeSuggestionPayload(payload)
      const suggestions = normalized.suggestions

      if (suggestions.length === 0) {
        throw new Error("Proxy tidak mengembalikan saran jawaban.")
      }

      return normalized
    } catch (error) {
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  throw new Error(
    `Gagal menghubungi Clara/proxy reply di ${OPENAI_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const syncChatSnapshotToProxy = async (chatData: WhatsAppChatSnapshot) => {
  let lastFetchError = ""

  for (const proxyUrl of getSnapshotSyncCandidates()) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData
        }),
        headers: {
          "Content-Type": "application/json",
          ...(await getClaraAuthHeaders())
        },
        method: "POST"
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            `API snapshot chat gagal memproses data scraping di ${proxyUrl}.`
        )
      }

      return {
        duplicate: Boolean(payload?.duplicate),
        snapshotId:
          typeof payload?.conversation_id === "string"
            ? payload.conversation_id
            : typeof payload?.snapshot?.id === "string"
              ? payload.snapshot.id
              : ""
      }
    } catch (error) {
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  throw new Error(
    `Gagal menghubungi API snapshot di ${CHAT_SNAPSHOT_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const clearChatSnapshotInProxy = async () => {
  let lastFetchError = ""

  for (const proxyUrl of getSnapshotSyncCandidates()) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData: null
        }),
        headers: {
          "Content-Type": "application/json",
          ...(await getClaraAuthHeaders())
        },
        method: "POST"
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            `API snapshot chat gagal mengosongkan data di ${proxyUrl}.`
        )
      }

      return
    } catch (error) {
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  throw new Error(
    `Gagal menghubungi API snapshot di ${CHAT_SNAPSHOT_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const hasClaraInsight = (result: Partial<WhatsAppSuggestionResult>) =>
  Boolean(result.customerSummary || result.nextBestAction || result.riskLevel)

const fetchSuggestionsFromClaraBackendOnly = async (
  chatData: WhatsAppChatSnapshot
) => {
  const claraReplySuggestionsUrl = getClaraReplySuggestionsUrl()

  if (!claraReplySuggestionsUrl) {
    return null
  }

  let lastFetchError = ""

  for (const proxyUrl of getProxyCandidates(claraReplySuggestionsUrl)) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData
        }),
        headers: {
          "Content-Type": "application/json",
          ...(await getClaraAuthHeaders())
        },
        method: "POST"
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.detail ||
            payload?.error ||
            `Backend Clara gagal memproses saran jawaban di ${proxyUrl}.`
        )
      }

      const normalized = normalizeSuggestionPayload(payload)

      if (normalized.suggestions.length === 0) {
        throw new Error("Backend Clara tidak mengembalikan saran jawaban.")
      }

      return normalized
    } catch (error) {
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  throw new Error(
    `Gagal menghubungi backend Clara untuk mengambil insight. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const shouldClearSnapshotForError = (message: string) =>
  [
    "Belum ada percakapan yang sedang dibuka.",
    "Buka WhatsApp Web dulu di tab aktif.",
    "Panel chat WhatsApp Web belum ditemukan."
  ].some((pattern) => message.includes(pattern))

const requestSuggestionCandidates = async (chatData: WhatsAppChatSnapshot) => {
  try {
    const response = (await chrome.runtime.sendMessage({
      chatData,
      type: "GENERATE_REPLY_SUGGESTIONS"
    })) as
      | {
          actionMode?: string
          customerSummary?: string
          error?: string
          nextBestAction?: string
          ok: boolean
          riskLevel?: string
          suggestionDetails?: WhatsAppSuggestionDetail[]
          suggestions?: string[]
        }
      | undefined

    if (!response?.ok || !response.suggestions) {
      throw new Error(
        response?.error ||
          "Background worker gagal mengambil saran jawaban dari Clara/proxy."
      )
    }

    return normalizeSuggestionPayload(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (!message.includes("Receiving end does not exist")) {
      throw error
    }

    return fetchSuggestionsFromProxyDirectly(chatData)
  }
}

function ClaraSidePanel() {
  const [chatData, setChatData] = useState<WhatsAppChatSnapshot | null>(null)
  const [authStatus, setAuthStatus] = useState<
    "checking" | "authenticated" | "unauthenticated" | "misconfigured"
  >("checking")
  const [authUser, setAuthUser] = useState<ClaraExtensionSessionUser | null>(
    null
  )
  const [hasAutoReadAttempted, setHasAutoReadAttempted] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isInsertingIndex, setIsInsertingIndex] = useState<number | null>(null)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionDetails, setSuggestionDetails] = useState<
    WhatsAppSuggestionDetail[]
  >([])
  const [customerSummary, setCustomerSummary] = useState("")
  const [nextBestAction, setNextBestAction] = useState("")
  const [riskLevel, setRiskLevel] = useState("")
  const [actionMode, setActionMode] = useState("")
  const [replySuggestionId, setReplySuggestionId] = useState("")
  const [tabUrl, setTabUrl] = useState("")

  const isAuthenticated = authStatus === "authenticated"

  const latestMessage = useMemo(
    () =>
      chatData?.messages.length
        ? chatData.messages[chatData.messages.length - 1]
        : null,
    [chatData]
  )

  const chatSignature = useMemo(
    () =>
      JSON.stringify({
        chatTitle: chatData?.chatTitle || "",
        lastMessageId:
          chatData?.messages[chatData.messages.length - 1]?.id || "",
        lastMessageText:
          chatData?.messages[chatData.messages.length - 1]?.text || "",
        messageCount: chatData?.messages.length || 0
      }),
    [chatData]
  )

  useEffect(() => {
    const syncTab = async () => {
      const tab = await getActiveTab()
      setTabUrl(tab?.url || "")
    }

    syncTab().catch(() => {
      setError("Gagal membaca tab aktif.")
    })
  }, [])

  const refreshAuthState = async (options?: { silent?: boolean }) => {
    if (!getConfiguredClaraApiBaseUrl()) {
      setAuthUser(null)
      setAuthStatus("misconfigured")
      return false
    }

    if (!options?.silent) {
      setAuthStatus("checking")
    }

    try {
      const user = await getCurrentClaraSessionUser()

      if (!user) {
        setAuthUser(null)
        setAuthStatus("unauthenticated")
        return false
      }

      setAuthUser(user)
      setAuthStatus("authenticated")
      return true
    } catch (sessionError) {
      setAuthUser(null)
      setAuthStatus("unauthenticated")
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : "Gagal membaca session Clara dari dashboard."
      )
      return false
    }
  }

  useEffect(() => {
    refreshAuthState().catch(() => {
      setAuthStatus("unauthenticated")
    })
  }, [])

  useEffect(() => {
    if (isAuthenticated || authStatus === "misconfigured") {
      return
    }

    const intervalId = window.setInterval(() => {
      refreshAuthState({ silent: true }).catch(() => {
        setAuthStatus("unauthenticated")
      })
    }, AUTH_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [authStatus, isAuthenticated])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return
      }

      refreshAuthState({ silent: true }).catch(() => {
        setAuthStatus("unauthenticated")
      })
    }

    const handleFocus = () => {
      refreshAuthState({ silent: true }).catch(() => {
        setAuthStatus("unauthenticated")
      })
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  useEffect(() => {
    if (!chrome.cookies?.onChanged) {
      return
    }

    const authCookieName = getConfiguredClaraAuthCookieName()
    const allowedOrigins = getClaraSessionOrigins()

    const listener = (changeInfo: chrome.cookies.CookieChangeInfo) => {
      if (changeInfo.cookie.name !== authCookieName) {
        return
      }

      const cookieOrigin = `http${changeInfo.cookie.secure ? "s" : ""}://${changeInfo.cookie.domain.replace(/^\./, "")}`

      if (!allowedOrigins.some((origin) => origin.startsWith(cookieOrigin))) {
        return
      }

      refreshAuthState({ silent: true }).catch(() => {
        setAuthStatus("unauthenticated")
      })
    }

    chrome.cookies.onChanged.addListener(listener)

    return () => {
      chrome.cookies.onChanged.removeListener(listener)
    }
  }, [])

  const openDashboardLogin = async () => {
    await chrome.tabs.create({
      url: getClaraDashboardLoginUrl()
    })
  }

  const ensureAuthenticated = async () => {
    if (isAuthenticated) {
      return true
    }

    const ok = await refreshAuthState()

    if (!ok) {
      setError(LOGIN_MESSAGE)
    }

    return ok
  }

  const readChatFromActiveTab = async () => {
    if (!(await ensureAuthenticated())) {
      throw new Error(LOGIN_MESSAGE)
    }

    const tab = await getActiveTab()

    if (!tab?.id) {
      throw new Error("Tab aktif tidak ditemukan.")
    }

    if (!tab.url?.startsWith("https://web.whatsapp.com/")) {
      throw new Error("Buka WhatsApp Web dulu di tab aktif.")
    }

    let response: WhatsAppReadResponse | undefined

    try {
      response = (await chrome.tabs.sendMessage(tab.id, {
        type: "READ_WHATSAPP_CHAT"
      })) as WhatsAppReadResponse
    } catch (messageError) {
      const message =
        messageError instanceof Error
          ? messageError.message
          : String(messageError)

      if (!message.includes("Receiving end does not exist")) {
        throw messageError
      }

      const [result] = await chrome.scripting.executeScript({
        func: readWhatsAppFromPage,
        target: {
          tabId: tab.id
        }
      })

      response = result?.result as WhatsAppReadResponse | undefined
    }

    if (!response?.ok || !response.data) {
      throw new Error(response?.error || "Chat belum bisa dibaca.")
    }

    setTabUrl(tab.url)

    return response.data
  }

  const handleReadChat = async () => {
    setIsLoading(true)
    setError("")
    setFeedback("")
    setSuggestions([])
    setSuggestionDetails([])
    setCustomerSummary("")
    setNextBestAction("")
    setRiskLevel("")
    setActionMode("")

    try {
      const data = await readChatFromActiveTab()
      setChatData(data)

      try {
        const syncResult = await syncChatSnapshotToProxy(data)
        setFeedback(
          syncResult.duplicate
            ? "Chat aktif berhasil dibaca. Snapshot yang sama sudah ada di API."
            : "Chat aktif berhasil dibaca dan disimpan ke API."
        )
      } catch (syncError) {
        setError(
          syncError instanceof Error
            ? `Chat berhasil dibaca, tapi gagal dikirim ke API: ${syncError.message}`
            : "Chat berhasil dibaca, tapi gagal dikirim ke API."
        )
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat membaca chat WhatsApp Web."

      setChatData(null)

      if (shouldClearSnapshotForError(message)) {
        clearChatSnapshotInProxy().catch(() => {
          // Keep the original read error as the main feedback for the user.
        })
      }

      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshChatSilently = async () => {
    try {
      const data = await readChatFromActiveTab()

      const nextSignature = JSON.stringify({
        chatTitle: data.chatTitle,
        lastMessageId: data.messages[data.messages.length - 1]?.id || "",
        lastMessageText: data.messages[data.messages.length - 1]?.text || "",
        messageCount: data.messages.length
      })

      if (nextSignature !== chatSignature) {
        setChatData(data)

        syncChatSnapshotToProxy(data).catch(() => {
          // Silent refresh should not interrupt the current side panel experience.
        })
      }

      setError((currentError) =>
        currentError.includes("Buka WhatsApp Web") ||
        currentError.includes("Tab aktif tidak ditemukan.") ||
        currentError.includes("Chat belum bisa dibaca.")
          ? ""
          : currentError
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (shouldClearSnapshotForError(message)) {
        setChatData(null)

        clearChatSnapshotInProxy().catch(() => {
          // Silent refresh should not interrupt the current side panel experience.
        })
      }

      // Silent refresh should not interrupt the current side panel experience.
    }
  }

  useEffect(() => {
    if (hasAutoReadAttempted || isLoading || !tabUrl) {
      return
    }

    setHasAutoReadAttempted(true)

    if (!tabUrl.startsWith("https://web.whatsapp.com/")) {
      return
    }

    handleReadChat().catch(() => {
      // Error state is already handled inside handleReadChat.
    })
  }, [hasAutoReadAttempted, isLoading, tabUrl])

  useEffect(() => {
    if (!tabUrl.startsWith("https://web.whatsapp.com/")) {
      return
    }

    const intervalId = window.setInterval(() => {
      if (isLoading || isSuggesting || isInsertingIndex !== null) {
        return
      }

      refreshChatSilently().catch(() => {
        // Silent refresh should stay silent.
      })
    }, AUTO_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [chatSignature, isInsertingIndex, isLoading, isSuggesting, tabUrl])

  const handleSuggestReplies = async () => {
    setIsSuggesting(true)
    setError("")
    setFeedback("")

    try {
      const currentChatData =
        chatData && chatData.messages.length > 0
          ? chatData
          : await readChatFromActiveTab()

      if (currentChatData.messages.length === 0) {
        throw new Error(
          "Chat aktif belum punya pesan teks yang bisa dipakai untuk saran."
        )
      }

      setChatData(currentChatData)

      syncChatSnapshotToProxy(currentChatData).catch(() => {
        // Suggestion flow should continue even when snapshot sync is unavailable.
      })

      const nextSuggestionResult =
        await requestSuggestionCandidates(currentChatData)

      const hydratedSuggestionResult =
        hasClaraInsight(nextSuggestionResult) &&
        nextSuggestionResult.replySuggestionId
          ? nextSuggestionResult
          : (await fetchSuggestionsFromClaraBackendOnly(currentChatData).catch(
              () => null
            )) || nextSuggestionResult

      setSuggestions(hydratedSuggestionResult.suggestions)
      setSuggestionDetails(hydratedSuggestionResult.suggestionDetails || [])
      setCustomerSummary(hydratedSuggestionResult.customerSummary || "")
      setNextBestAction(hydratedSuggestionResult.nextBestAction || "")
      setRiskLevel(hydratedSuggestionResult.riskLevel || "")
      setActionMode(hydratedSuggestionResult.actionMode || "")
      setReplySuggestionId(hydratedSuggestionResult.replySuggestionId || "")
      setFeedback("Saran balasan Clara siap dipakai.")
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat membuat saran jawaban."

      setSuggestions([])
      setSuggestionDetails([])
      setCustomerSummary("")
      setNextBestAction("")
      setRiskLevel("")
      setActionMode("")
      setReplySuggestionId("")
      setReplySuggestionId("")
      setError(message)
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleCopySuggestion = async (suggestion: string) => {
    if (!(await ensureAuthenticated())) {
      return
    }

    try {
      await navigator.clipboard.writeText(suggestion)
      setFeedback("Saran jawaban berhasil disalin.")
      setError("")
    } catch (_error) {
      setError("Clipboard tidak bisa diakses. Coba copy manual dulu.")
    }
  }

  const handleInsertSuggestion = async (suggestion: string, index: number) => {
    if (!(await ensureAuthenticated())) {
      return
    }

    setIsInsertingIndex(index)
    setError("")
    setFeedback("")

    try {
      const tab = await getActiveTab()

      if (!tab?.id) {
        throw new Error("Tab aktif tidak ditemukan.")
      }

      if (!tab.url?.startsWith("https://web.whatsapp.com/")) {
        throw new Error("Buka WhatsApp Web dulu di tab aktif.")
      }

      let response: WhatsAppActionResponse | undefined

      try {
        response = (await chrome.tabs.sendMessage(tab.id, {
          text: suggestion,
          type: "INSERT_WHATSAPP_REPLY"
        })) as WhatsAppActionResponse
      } catch (messageError) {
        const message =
          messageError instanceof Error
            ? messageError.message
            : String(messageError)

        if (!message.includes("Receiving end does not exist")) {
          throw messageError
        }

        const [result] = await chrome.scripting.executeScript({
          args: [suggestion],
          func: insertReplyIntoPage,
          target: {
            tabId: tab.id
          }
        })

        response = result?.result as WhatsAppActionResponse | undefined
      }

      if (!response?.ok) {
        throw new Error(response?.error || "Gagal memasukkan saran ke chatbox.")
      }

      if (replySuggestionId) {
        await chrome.runtime.sendMessage({
          chatTitle: chatData?.chatTitle || "",
          replySuggestionId,
          selectedReplyText: suggestion,
          tabId: tab.id,
          type: "REGISTER_PENDING_REPLY"
        })
      }

      setFeedback(
        "Saran jawaban sudah dimasukkan ke chatbox. Kalau user kirim manual dari WhatsApp, Clara akan ikut menandainya sebagai approved + sent."
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat memasukkan saran ke chatbox."
      )
    } finally {
      setIsInsertingIndex(null)
    }
  }

  const handleSendSuggestion = async (suggestion: string, index: number) => {
    if (!(await ensureAuthenticated())) {
      return
    }

    setIsInsertingIndex(index)
    setError("")
    setFeedback("")

    try {
      const tab = await getActiveTab()

      if (!tab?.id) {
        throw new Error("Tab aktif tidak ditemukan.")
      }

      if (!tab.url?.startsWith("https://web.whatsapp.com/")) {
        throw new Error("Buka WhatsApp Web dulu di tab aktif.")
      }

      let response: WhatsAppActionResponse | undefined

      try {
        response = (await chrome.tabs.sendMessage(tab.id, {
          text: suggestion,
          type: "SEND_WHATSAPP_REPLY"
        })) as WhatsAppActionResponse
      } catch (messageError) {
        const message =
          messageError instanceof Error
            ? messageError.message
            : String(messageError)

        if (!message.includes("Receiving end does not exist")) {
          throw messageError
        }

        const [result] = await chrome.scripting.executeScript({
          args: [suggestion],
          func: sendReplyFromPanel,
          target: {
            tabId: tab.id
          }
        })

        response = result?.result as WhatsAppActionResponse | undefined
      }

      if (!response?.ok) {
        throw new Error(response?.error || "Gagal mengirim saran ke WhatsApp.")
      }

      if (!replySuggestionId) {
        setFeedback(
          "Pesan terkirim ke WhatsApp, tapi belum bisa ditandai di Clara karena reply suggestion id tidak tersedia."
        )
        return
      }

      const claraSendUrl = getClaraSendReplyUrl(replySuggestionId)

      if (!claraSendUrl) {
        setFeedback(
          "Pesan terkirim ke WhatsApp, tapi sinkronisasi status ke Clara belum dikonfigurasi."
        )
        return
      }

      const syncResponse = await fetch(claraSendUrl, {
        body: JSON.stringify({
          finalReplyText: suggestion,
          selectedReplyText: suggestion,
          sentByName: "extension_user"
        }),
        headers: {
          "Content-Type": "application/json",
          ...(await getClaraAuthHeaders())
        },
        method: "POST"
      })

      const syncPayload = await syncResponse.json()

      if (!syncResponse.ok) {
        throw new Error(
          syncPayload?.detail ||
            syncPayload?.error ||
            "Pesan terkirim ke WhatsApp, tapi gagal ditandai sebagai sent di Clara."
        )
      }

      await chrome.runtime.sendMessage({
        tabId: tab.id,
        type: "CLEAR_PENDING_REPLY"
      })

      setFeedback(
        syncPayload?.auto_approved
          ? "Pesan terkirim ke WhatsApp dan otomatis dianggap approved + sent di Clara."
          : "Pesan terkirim ke WhatsApp dan status sent sudah tercatat di Clara."
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat mengirim saran ke WhatsApp."
      )
    } finally {
      setIsInsertingIndex(null)
    }
  }

  const isWhatsAppTab = tabUrl.startsWith("https://web.whatsapp.com/")
  const authStatusLabel =
    authStatus === "authenticated"
      ? "Connected"
      : authStatus === "checking"
        ? "Checking"
        : authStatus === "misconfigured"
          ? "Setup needed"
          : "Login needed"
  const sessionMeta = [
    authUser?.email,
    authUser?.organizationName,
    authUser?.role ? `role ${authUser.role}` : ""
  ]
    .filter(Boolean)
    .join(" | ")
  const draftStatusLabel = suggestions.length
    ? `${suggestions.length} draft siap`
    : isSuggesting
      ? "Sedang menyusun draft"
      : "Belum ada draft"

  return (
    <div className="clara-panel">
      <style>{panelCss}</style>

      <div className="clara-stage">
        <section className="clara-hero">
          <div className="clara-hero__top">
            <div className="clara-identity">
              <div className="clara-identity__label">Workspace</div>
              <div className="clara-identity__name">
                {authUser?.name || "Clara"}
              </div>
              <div className="clara-identity__meta">
                {sessionMeta || LOGIN_MESSAGE}
              </div>
            </div>
          </div>
        </section>

        {!isAuthenticated && (
          <section className="clara-pane">
            <div className="clara-pane__header">
              <div>
                <div className="clara-pane__eyebrow">Login Clara</div>
                <div className="clara-pane__title">
                  Hubungkan extension ke dashboard dulu
                </div>
                <p className="clara-pane__copy">
                  {authStatus === "misconfigured"
                    ? "PLASMO_PUBLIC_CLARA_API_BASE_URL belum diisi. Extension butuh koneksi ke backend Clara."
                    : authStatus === "checking"
                      ? "Sedang memeriksa session login Clara."
                      : "Begitu login berhasil, panel ini akan otomatis lanjut ke mode kerja tanpa perlu refresh manual."}
                </p>
              </div>

              <div className="clara-chip clara-chip--warn">
                {authStatusLabel}
              </div>
            </div>

            <button
              className="clara-button clara-button--primary clara-button--block"
              onClick={openDashboardLogin}>
              Buka Dashboard Login
            </button>
          </section>
        )}

        {!isAuthenticated ? null : (
          <>
            <section className="clara-pane">
              <div className="clara-pane__header">
                <div>
                  <div className="clara-pane__eyebrow">Chat Aktif</div>
                  <div className="clara-pane__title">
                    Ambil percakapan yang sedang dibuka
                  </div>
                  <p className="clara-pane__copy">
                    Baca isi chat dari WhatsApp Web untuk dijadikan konteks.
                  </p>
                </div>

                <div className="clara-chip clara-chip--soft">
                  {chatData
                    ? `${chatData.messages.length} pesan`
                    : "Siap baca chat"}
                </div>
              </div>

              <button
                className="clara-button clara-button--primary clara-button--block"
                disabled={isLoading}
                onClick={handleReadChat}>
                {isLoading
                  ? "Membaca chat..."
                  : chatData
                    ? "Perbarui Isi Chat"
                    : "Baca Chat Aktif"}
              </button>

              {!isWhatsAppTab && !chatData && (
                <div className="clara-note clara-note--warn">
                  Tab aktif saat ini bukan WhatsApp Web. Buka{" "}
                  <strong>https://web.whatsapp.com/</strong>, pilih percakapan,
                  lalu jalankan pembacaan chat dari panel ini.
                </div>
              )}

              {chatData ? (
                <div className="clara-overview">
                  <div className="clara-chat-shell">
                    <div className="clara-chat-appbar">
                      <div className="clara-chat-avatar">
                        {chatData.chatTitle.slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="clara-chat-appbar__title">
                          {chatData.chatTitle}
                        </div>
                        <div className="clara-chat-appbar__meta">
                          {chatData.chatSubtitle ||
                            "last seen recently | Clara preview"}
                        </div>
                      </div>
                      <div className="clara-chip clara-chip--soft">
                        {chatData.messages.length} pesan
                      </div>
                    </div>

                    {latestMessage ? (
                      <div className="clara-chat-latest">
                        <strong>Pesan terbaru:</strong> {latestMessage.text}
                      </div>
                    ) : null}

                    <div className="clara-thread">
                      {chatData.messages.length === 0 ? (
                        <div className="clara-empty">
                          Belum ada pesan teks yang berhasil diambil dari
                          percakapan ini.
                        </div>
                      ) : (
                        chatData.messages.map((message) => (
                          <article
                            className={`clara-thread-message clara-thread-message--${message.direction === "outgoing" ? "out" : "in"}`}
                            key={message.id}>
                            {message.direction !== "outgoing" ? (
                              <div className="clara-thread-message__author">
                                {message.author || "Tanpa nama"}
                              </div>
                            ) : null}
                            <div className="clara-thread-message__text">
                              {message.text}
                            </div>
                            <div className="clara-thread-message__footer">
                              {message.timestampLabel ||
                                (message.direction === "outgoing"
                                  ? "Anda"
                                  : "Diterima")}
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="clara-empty">
                  <div className="clara-empty__title">
                    Belum ada percakapan yang ditampilkan
                  </div>
                  <div className="clara-empty__meta">
                    Buka dulu chat di WhatsApp Web, lalu klik{" "}
                    <strong>Baca Chat Aktif</strong>. Setelah itu isi percakapan
                    akan muncul di area ini seperti tampilan chat.
                  </div>
                </div>
              )}
            </section>

            <section className="clara-pane clara-pane--reply">
              <div className="clara-pane__header">
                <div>
                  <div className="clara-pane__eyebrow">Balasan AI</div>
                  <div className="clara-pane__title">
                    Pilih jawaban yang paling nyaman dipakai
                  </div>
                  <p className="clara-pane__copy">
                    Clara menyiapkan beberapa versi balasan untuk dipilih.
                  </p>
                </div>

                <div className="clara-chip clara-chip--soft">
                  {draftStatusLabel}
                </div>
              </div>

              <button
                className="clara-button clara-button--ghost clara-button--block"
                disabled={isSuggesting || isLoading}
                onClick={handleSuggestReplies}>
                {isSuggesting ? "Menyusun balasan..." : "Buat Saran Jawaban"}
              </button>

              {suggestions.length > 0 ? (
                <>
                  <div className="clara-brief">
                    <div className="clara-brief__title">Insight Clara</div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {riskLevel ? (
                        <div className="clara-chip clara-chip--warn">
                          Risk: {riskLevel}
                        </div>
                      ) : null}
                      {actionMode ? (
                        <div className="clara-chip clara-chip--good">
                          {actionMode}
                        </div>
                      ) : null}
                    </div>

                    {customerSummary || nextBestAction || riskLevel ? (
                      <div className="clara-brief__grid">
                        {customerSummary && (
                          <div className="clara-brief__text">
                            <strong>Ringkasan customer:</strong>{" "}
                            {customerSummary}
                          </div>
                        )}
                        {nextBestAction && (
                          <div className="clara-brief__text">
                            <strong>Aksi berikutnya:</strong> {nextBestAction}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="clara-brief__text">
                        Insight Clara belum tersedia untuk percakapan ini, tapi
                        draft balasan tetap berhasil dibuat.
                      </div>
                    )}
                  </div>

                  <div className="clara-draft-list">
                    {suggestions.map((suggestion, index) => (
                      <article
                        className="clara-draft"
                        key={`${suggestion}-${index}`}>
                        <div className="clara-draft__head">
                          <div>
                            <div className="clara-draft__number">
                              Draft {String(index + 1).padStart(2, "0")}
                            </div>
                            <div className="clara-draft__tone">
                              {SUGGESTION_TONE_LABELS[index] ||
                                `Saran ${index + 1}`}
                            </div>
                          </div>

                          <div className="clara-draft__hint">
                            Bisa dipakai langsung
                          </div>
                        </div>

                        <div className="clara-draft__text">{suggestion}</div>

                        {suggestionDetails[index]?.reasoning && (
                          <div className="clara-draft__reason">
                            <strong>Kenapa draft ini:</strong>{" "}
                            {suggestionDetails[index]?.reasoning}
                          </div>
                        )}

                        <div className="clara-draft__actions">
                          <button
                            className="clara-button clara-button--ghost"
                            onClick={() => handleCopySuggestion(suggestion)}>
                            Salin
                          </button>
                          <button
                            className="clara-button clara-button--insert"
                            disabled={isInsertingIndex === index}
                            onClick={() =>
                              handleInsertSuggestion(suggestion, index)
                            }>
                            {isInsertingIndex === index
                              ? "Memasukkan..."
                              : "Masukkan ke Chat"}
                          </button>
                          <button
                            className="clara-button clara-button--send"
                            disabled={isInsertingIndex === index}
                            onClick={() =>
                              handleSendSuggestion(suggestion, index)
                            }>
                            {isInsertingIndex === index
                              ? "Mengirim..."
                              : "Kirim Sekarang"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="clara-empty">
                  <div className="clara-empty__title">
                    Belum ada draft balasan
                  </div>
                  <div className="clara-empty__meta">
                    Setelah isi chat berhasil dibaca, klik{" "}
                    <strong>Buat Saran Jawaban</strong> supaya Clara menyiapkan
                    beberapa opsi yang bisa langsung kamu pakai.
                  </div>
                </div>
              )}

              {feedback ? (
                <div className="clara-note clara-note--success">{feedback}</div>
              ) : null}

              {error ? (
                <div className="clara-note clara-note--error">{error}</div>
              ) : null}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default ClaraSidePanel
