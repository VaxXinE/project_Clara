import { useEffect, useMemo, useState } from "react"

import type {
  ClaraExtensionSessionUser,
  WhatsAppActionResponse,
  WhatsAppChatSnapshot,
  WhatsAppMessage,
  WhatsAppMessageDirection,
  WhatsAppReadResponse,
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
  isDevFallbackAllowed,
  getProxyCandidates,
  getSnapshotSyncCandidates
} from "~/utils/proxy"

import chatWallpaper from "./assets/eb24786e5579a01bdd4bb103695b8286.jpg"

const OPENAI_PROXY_URL = getConfiguredProxyUrl()
const CHAT_SNAPSHOT_PROXY_URL = getChatSnapshotProxyUrl(OPENAI_PROXY_URL)
const INSERT_LOCK_KEY = "__sgExtensionSidePanelInsertLock__"
const AUTO_REFRESH_INTERVAL_MS = 2500
const LOGIN_MESSAGE =
  "Login dulu di dashboard Clara supaya extension terhubung ke akun yang sama."
const AUTH_REFRESH_INTERVAL_MS = 2000

const panelCss = `
  html,
  body {
    background: #070503;
    margin: 0;
    min-height: 100%;
    padding: 0;
  }

  body {
    overflow-x: hidden;
  }

  .clara-panel {
    --clara-ink: #f7e7b7;
    --clara-muted: #c9aa68;
    --clara-line: rgba(240, 203, 115, 0.14);
    --clara-surface: rgba(23, 17, 11, 0.94);
    --clara-surface-2: rgba(33, 24, 16, 0.9);
    --clara-accent: #f0cb73;
    --clara-accent-strong: #c29032;
    --clara-warm: #e1b24a;
    --clara-danger: #e17c54;
    background:
      radial-gradient(circle at top left, rgba(240,203,115,0.16), rgba(240,203,115,0) 28%),
      radial-gradient(circle at 100% 0%, rgba(194,144,50,0.14), rgba(194,144,50,0) 32%),
      linear-gradient(180deg, #120d08 0%, #0b0805 42%, #070503 100%);
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
      radial-gradient(circle at top right, rgba(240, 203, 115, 0.28), rgba(240, 203, 115, 0) 30%),
      linear-gradient(155deg, #171008 0%, #24180e 48%, #3a260f 100%);
    border: 1px solid rgba(240, 203, 115, 0.14);
    border-radius: 22px;
    box-shadow:
      0 24px 54px rgba(0, 0, 0, 0.28),
      inset 0 1px 0 rgba(255, 240, 201, 0.08);
    color: #fff0c9;
    overflow: hidden;
    padding: 14px;
    position: relative;
  }

  .clara-hero::after {
    background:
      linear-gradient(90deg, rgba(255,240,201,0.08), rgba(240,203,115,0)),
      repeating-linear-gradient(
        135deg,
        rgba(240,203,115,0.04),
        rgba(240,203,115,0.04) 10px,
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
    color: rgba(240, 203, 115, 0.88);
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
    color: rgba(247, 231, 183, 0.84);
    font-size: 12px;
    line-height: 1.5;
    margin: 8px 0 0;
    max-width: none;
  }

  .clara-identity {
    background: rgba(12, 9, 6, 0.44);
    border: 1px solid rgba(240, 203, 115, 0.14);
    border-radius: 16px;
    min-width: 0;
    max-width: 100%;
    width: 100%;
    padding: 12px;
  }

  .clara-identity__label {
    color: rgba(240, 203, 115, 0.72);
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
    color: rgba(247, 231, 183, 0.7);
    font-size: 11px;
    line-height: 1.45;
    margin-top: 6px;
    overflow-wrap: anywhere;
  }

  .clara-pane {
    background: linear-gradient(180deg, rgba(28,20,13,0.96), rgba(16,12,9,0.96));
    border: 1px solid rgba(240, 203, 115, 0.14);
    border-radius: 22px;
    box-shadow:
      0 20px 42px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 240, 201, 0.06);
    display: grid;
    gap: 12px;
    min-width: 0;
    padding: 14px;
  }

  .clara-pane--reply {
    background:
      linear-gradient(180deg, rgba(35,25,16,0.96), rgba(18,13,10,0.98));
  }

  .clara-pane__eyebrow {
    color: #c9aa68;
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

  .clara-pane__actions {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .clara-action-bridge {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 1fr auto 1fr;
    margin: -2px 0;
  }

  .clara-action-bridge__line {
    background: linear-gradient(
      90deg,
      rgba(240, 203, 115, 0),
      rgba(240, 203, 115, 0.18),
      rgba(240, 203, 115, 0)
    );
    height: 1px;
    width: 100%;
  }

  .clara-action-bridge__actions {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-width: min(100%, 420px);
    width: min(100%, 420px);
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
    background: rgba(240, 203, 115, 0.12);
    border: 1px solid rgba(240, 203, 115, 0.16);
    color: #fff0c9;
  }

  .clara-chip--soft {
    background: rgba(255, 240, 201, 0.06);
    border: 1px solid rgba(240, 203, 115, 0.12);
    color: #e5c98b;
  }

  .clara-chip--good {
    background: rgba(240, 203, 115, 0.14);
    border: 1px solid rgba(240, 203, 115, 0.18);
    color: #f0cb73;
  }

  .clara-chip--warn {
    background: rgba(194, 144, 50, 0.14);
    border: 1px solid rgba(240, 203, 115, 0.18);
    color: #f3d694;
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

  .clara-button--compact {
    min-height: 40px;
  }

  .clara-button--primary {
    background: linear-gradient(135deg, #f6d98c 0%, #c29032 100%);
    box-shadow:
      0 18px 30px rgba(0, 0, 0, 0.22),
      inset 0 1px 0 rgba(255, 248, 224, 0.18);
    color: #140f08;
  }

  .clara-button--ghost {
    background: rgba(255, 240, 201, 0.05);
    border: 1px solid rgba(240, 203, 115, 0.14);
    color: #f0cb73;
  }

  .clara-button--insert {
    background: linear-gradient(135deg, #2b1c0f 0%, #8b6321 100%);
    color: #fff0c9;
  }

  .clara-button--send {
    background: linear-gradient(135deg, #f0cb73 0%, #b67d27 100%);
    color: #140f08;
  }

  .clara-note {
    border-radius: 16px;
    font-size: 12px;
    line-height: 1.5;
    padding: 11px 12px;
  }

  .clara-note--warn {
    background: rgba(55, 38, 18, 0.96);
    border: 1px solid rgba(240, 203, 115, 0.22);
    color: #f3d694;
  }

  .clara-note--success {
    background: rgba(41, 30, 17, 0.98);
    border: 1px solid rgba(240, 203, 115, 0.18);
    color: #f0cb73;
  }

  .clara-note--error {
    background: rgba(66, 33, 21, 0.98);
    border: 1px solid rgba(225, 124, 84, 0.28);
    color: var(--clara-danger);
  }

  .clara-overview {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .clara-chat-shell {
    background: #130d08;
    border: 1px solid rgba(240, 203, 115, 0.12);
    border-radius: 20px;
    overflow: hidden;
  }

  .clara-chat-appbar {
    align-items: center;
    background: #1b130b;
    border-bottom: 1px solid rgba(240, 203, 115, 0.12);
    display: grid;
    gap: 12px;
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding: 10px 12px;
  }

  .clara-chat-avatar {
    align-items: center;
    background: linear-gradient(135deg, #f6d98c, #c29032);
    border-radius: 50%;
    color: #140f08;
    display: inline-flex;
    font-size: 14px;
    font-weight: 800;
    height: 36px;
    justify-content: center;
    width: 36px;
  }

  .clara-chat-appbar__title {
    color: #fff0c9;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .clara-chat-appbar__meta {
    color: #c9aa68;
    font-size: 11px;
    line-height: 1.35;
    margin-top: 2px;
    overflow-wrap: anywhere;
  }

  .clara-chat-latest {
    background: rgba(255, 240, 201, 0.06);
    border-bottom: 1px solid rgba(240, 203, 115, 0.08);
    color: #d6bb84;
    font-size: 11px;
    line-height: 1.45;
    padding: 8px 12px;
  }

  .clara-chat-latest strong {
    color: #fff0c9;
  }

  .clara-thread {
    background:
      linear-gradient(rgba(10, 7, 5, 0.82), rgba(10, 7, 5, 0.82)),
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
    background: rgba(240, 203, 115, 0.28);
    border-radius: 999px;
  }

  .clara-thread-message {
    background: #24180f;
    border-radius: 10px;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.16), 0 1px 3px rgba(0, 0, 0, 0.2);
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
    border-right: 10px solid #24180f;
    border-top: 10px solid #24180f;
    left: -5px;
    transform: skewX(-24deg);
  }

  .clara-thread-message--out::before {
    border-left: 10px solid #f0cb73;
    border-top: 10px solid #f0cb73;
    right: -5px;
    transform: skewX(24deg);
  }

  .clara-thread-message--in {
    align-self: flex-start;
  }

  .clara-thread-message--out {
    align-self: flex-end;
    background: #f0cb73;
  }

  .clara-thread-message__author {
    color: #f0cb73;
    font-size: 11px;
    font-weight: 800;
    line-height: 1.3;
    margin-bottom: 4px;
    overflow-wrap: anywhere;
  }

  .clara-thread-message__text {
    color: #f7e7b7;
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .clara-thread-message__footer {
    color: #c9aa68;
    display: flex;
    font-size: 10px;
    justify-content: flex-end;
    line-height: 1.2;
    margin-top: 4px;
  }

  .clara-thread-message--out .clara-thread-message__author {
    color: rgba(20, 15, 8, 0.68);
  }

  .clara-thread-message--out .clara-thread-message__text {
    color: #140f08;
  }

  .clara-thread-message--out .clara-thread-message__footer {
    color: rgba(20, 15, 8, 0.72);
  }

  .clara-empty {
    background: rgba(255,240,201,0.06);
    border: 1px dashed rgba(240, 203, 115, 0.18);
    border-radius: 16px;
    color: #d6bb84;
    font-size: 13px;
    line-height: 1.6;
    padding: 14px;
  }

  .clara-empty__title {
    color: #fff0c9;
    font-size: 13px;
    font-weight: 800;
    margin-bottom: 6px;
  }

  .clara-empty__meta {
    color: #c9aa68;
    font-size: 12px;
    line-height: 1.6;
  }

  .clara-brief {
    background:
      linear-gradient(180deg, rgba(34,24,16,0.96), rgba(19,13,10,0.96));
    border: 1px solid rgba(240, 203, 115, 0.12);
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
    color: #c9aa68;
  }

  .clara-brief__grid {
    display: grid;
    gap: 10px;
  }

  .clara-brief__text {
    color: #e5c98b;
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
    background: linear-gradient(180deg, rgba(34,24,16,0.96), rgba(18,13,10,0.94));
    border: 1px solid rgba(240, 203, 115, 0.12);
    border-radius: 18px;
    box-shadow:
      0 14px 28px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255,240,201,0.06);
    display: grid;
    gap: 10px;
    min-width: 0;
    padding: 12px;
  }

  .clara-draft__number {
    color: #f0cb73;
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
    color: #f7e7b7;
    font-size: 12px;
    line-height: 1.58;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .clara-draft__editor {
    display: grid;
    gap: 10px;
  }

  .clara-input {
    appearance: none;
    background: linear-gradient(180deg, rgba(20,14,10,0.98), rgba(15,10,7,0.94));
    border: 1px solid rgba(240, 203, 115, 0.16);
    border-radius: 16px;
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.18),
      0 10px 24px rgba(0, 0, 0, 0.14);
    color: #f7e7b7;
    font-family: "Aptos", "Segoe UI Variable Display", "Trebuchet MS", "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.65;
    min-width: 0;
    outline: none;
    padding: 14px 15px;
    resize: vertical;
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
    width: 100%;
  }

  .clara-input::placeholder {
    color: rgba(201, 170, 104, 0.72);
  }

  .clara-input:focus {
    background: #1b130b;
    border-color: rgba(240, 203, 115, 0.42);
    box-shadow:
      0 0 0 4px rgba(240, 203, 115, 0.12),
      0 14px 26px rgba(0, 0, 0, 0.18);
  }

  .clara-input--textarea {
    min-height: 172px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .clara-draft__reason {
    background: rgba(255, 240, 201, 0.06);
    border-radius: 14px;
    color: #d6bb84;
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

    .clara-action-bridge {
      grid-template-columns: 1fr;
    }

    .clara-action-bridge__line {
      display: none;
    }

    .clara-action-bridge__actions,
    .clara-pane__actions {
      grid-template-columns: 1fr;
      min-width: 0;
      width: 100%;
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
    "radial-gradient(circle at 10% 10%, rgba(240,203,115,0.18), rgba(240,203,115,0) 24%), radial-gradient(circle at 88% 14%, rgba(194,144,50,0.16), rgba(194,144,50,0) 26%), radial-gradient(circle at 18% 78%, rgba(240,203,115,0.1), rgba(240,203,115,0) 24%), linear-gradient(160deg, #120d08 0%, #0b0805 38%, #070503 100%)",
  color: "#f7e7b7",
  fontFamily:
    "'Aptos', 'Segoe UI Variable Display', 'Trebuchet MS', 'Segoe UI', sans-serif",
  minHeight: "100vh",
  overflowX: "hidden",
  padding: 16,
  width: "100%"
} as const

const primaryButtonStyle = {
  background:
    "linear-gradient(135deg, rgba(246,217,140,0.98) 0%, rgba(194,144,50,0.96) 100%)",
  border: "1px solid rgba(255, 240, 201, 0.18)",
  borderRadius: 18,
  boxShadow:
    "0 18px 36px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255,248,224,0.22)",
  color: "#140f08",
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
    "linear-gradient(180deg, rgba(33,24,16,0.9), rgba(19,13,10,0.82))",
  border: "1px solid rgba(240, 203, 115, 0.16)",
  borderRadius: 18,
  boxShadow:
    "0 12px 28px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255,240,201,0.06)",
  color: "#f0cb73",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  minHeight: 48,
  padding: "14px 16px",
  width: "100%"
} as const

const actionButtonStyle = {
  background: "rgba(255,240,201,0.06)",
  border: "1px solid rgba(240,203,115,0.16)",
  borderRadius: 14,
  color: "#f0cb73",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  minHeight: 40,
  padding: "10px 12px"
} as const

const softCardStyle = {
  background:
    "linear-gradient(180deg, rgba(31,22,15,0.88), rgba(18,13,10,0.7))",
  backdropFilter: "blur(18px) saturate(155%)",
  border: "1px solid rgba(240, 203, 115, 0.14)",
  borderRadius: 24,
  boxShadow:
    "0 18px 40px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255,240,201,0.06)",
  padding: 16
} as const

const chipStyle = {
  alignItems: "center",
  background: "rgba(255,240,201,0.08)",
  border: "1px solid rgba(240,203,115,0.16)",
  borderRadius: 999,
  color: "#f3d694",
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

const getComposeFooter = () => getComposeBox()?.closest("footer") || document

const clickElement = (node: HTMLElement) => {
  node.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window
    })
  )
  node.dispatchEvent(
    new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      view: window
    })
  )
  node.click()
}

const getSendButtonTarget = (): HTMLElement | null => {
  const searchRoot = getComposeFooter()
  const selectors = [
    '[data-testid="compose-btn-send"]',
    'button[aria-label="Send"]',
    'button[aria-label="Kirim"]',
    '[aria-label="Send"]',
    '[aria-label="Kirim"]',
    '[data-icon="send"]'
  ]

  for (const selector of selectors) {
    const node = searchRoot.querySelector<HTMLElement>(selector)

    if (!node) {
      continue
    }

    const clickableTarget =
      node.tagName === "BUTTON"
        ? node
        : node.closest<HTMLElement>('button, [role="button"], [tabindex]')

    const target = clickableTarget || node

    if (
      target instanceof HTMLButtonElement &&
      (target.disabled || target.hasAttribute("disabled"))
    ) {
      continue
    }

    return target
  }

  return null
}

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

const sendReplyFromPanel = async (
  text: string
): Promise<WhatsAppActionResponse> => {
  const wait = (ms: number) =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms)
    })

  const normalizeMessageText = (value: string) =>
    value.replace(/\s+/g, " ").trim().toLowerCase()

  const getMessageContainers = () =>
    Array.from(
      new Set(
        Array.from(
          (
            document.querySelector<HTMLElement>(
              '[data-testid="conversation-panel-messages"]'
            ) || document
          ).querySelectorAll<HTMLElement>('[data-testid="msg-container"]')
        )
      )
    )

  const getLatestOutgoingMessageSnapshot = () => {
    const outgoingMessages = getMessageContainers()
      .map((container, index) => ({
        direction: getMessageDirection(container),
        index,
        text: getMessageText(container)
      }))
      .filter((message) => message.direction === "outgoing" && message.text.trim())

    const latestOutgoingMessage = outgoingMessages[outgoingMessages.length - 1]

    return {
      count: outgoingMessages.length,
      text: latestOutgoingMessage?.text.trim() || ""
    }
  }

  const waitForOutgoingMessageConfirmation = async (expectedText: string) => {
    const normalizedExpected = normalizeMessageText(expectedText)
    const beforeSendSnapshot = getLatestOutgoingMessageSnapshot()

    for (let attempt = 0; attempt < 12; attempt += 1) {
      await wait(250)

      const composeBox = document.querySelector<HTMLElement>(
        '[data-testid="conversation-compose-box-input"][contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], footer [contenteditable="true"][role="textbox"]'
      )
      const composeText =
        composeBox?.innerText.replace(/\s+/g, " ").trim() || ""
      const afterSendSnapshot = getLatestOutgoingMessageSnapshot()
      const normalizedLatestOutgoing = normalizeMessageText(
        afterSendSnapshot.text
      )

      const outgoingMessageAppended =
        afterSendSnapshot.count > beforeSendSnapshot.count &&
        normalizedLatestOutgoing === normalizedExpected

      const latestOutgoingReplaced =
        afterSendSnapshot.count === beforeSendSnapshot.count &&
        afterSendSnapshot.text !== beforeSendSnapshot.text &&
        normalizedLatestOutgoing === normalizedExpected

      if (outgoingMessageAppended || latestOutgoingReplaced) {
        return true
      }

      if (!composeText.trim() && normalizedLatestOutgoing === normalizedExpected) {
        return true
      }
    }

    return false
  }

  const insertResult = insertReplyIntoPage(text)

  if (!insertResult.ok) {
    return insertResult
  }

  const sendButtonTarget = getSendButtonTarget()

  if (sendButtonTarget) {
    clickElement(sendButtonTarget)

    const isConfirmed = await waitForOutgoingMessageConfirmation(text)

    if (!isConfirmed) {
      return {
        error:
          "Tombol kirim sudah ditekan, tapi WhatsApp belum menampilkan pesan baru. Pesan belum dianggap terkirim.",
        ok: false
      }
    }

    return {
      ok: true
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

  const isConfirmed = await waitForOutgoingMessageConfirmation(text)

  if (!isConfirmed) {
    return {
      error:
        "Enter sudah dipicu, tapi WhatsApp belum menampilkan pesan baru. Pesan belum dianggap terkirim.",
      ok: false
    }
  }

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

  return {
    actionMode:
      typeof payload?.actionMode === "string"
        ? payload.actionMode
        : typeof payload?.action_mode === "string"
          ? payload.action_mode
          : undefined,
    cached:
      typeof payload?.cached === "boolean" ? payload.cached : undefined,
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
    suggestions: suggestions.slice(0, 1)
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
  const SELF_AUTHOR_PATTERN = /^(you|anda|me|saya)$/i

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
    const metaSource =
      container
        .querySelector<HTMLElement>("[data-pre-plain-text]")
        ?.getAttribute("data-pre-plain-text") || ""
    const parsedMeta = parsePrePlainText(metaSource)
    const directionNode =
      container.matches(".message-out, .message-in")
        ? container
        : container.querySelector<HTMLElement>(".message-out, .message-in") ||
          container.closest<HTMLElement>(".message-out, .message-in") ||
          container.parentElement?.closest<HTMLElement>(
            ".message-out, .message-in"
          ) ||
          null

    if (directionNode?.classList.contains("message-out")) {
      return "outgoing"
    }

    if (directionNode?.classList.contains("message-in")) {
      return "incoming"
    }

    if (
      container.querySelector(
        '[data-icon="msg-check"], [data-icon="msg-dblcheck"], [data-icon="status-dblcheck"], [data-icon="msg-time"]'
      ) &&
      SELF_AUTHOR_PATTERN.test(parsedMeta.author)
    ) {
      return "outgoing"
    }

    if (SELF_AUTHOR_PATTERN.test(parsedMeta.author)) {
      return "outgoing"
    }

    const alignmentNodes = [
      container,
      container.parentElement,
      container.parentElement?.parentElement
    ].filter((node): node is HTMLElement => Boolean(node))

    for (const node of alignmentNodes) {
      const computedStyle = window.getComputedStyle(node)

      if (computedStyle.justifyContent === "flex-end") {
        return "outgoing"
      }

      if (computedStyle.justifyContent === "flex-start") {
        return "incoming"
      }

      if (node.classList.contains("xuk3077")) {
        return "outgoing"
      }

      if (node.classList.contains("x1cy8zhl")) {
        return "incoming"
      }
    }

    const rect = container.getBoundingClientRect()
    const leftSpace = rect.left
    const rightSpace = window.innerWidth - rect.right

    if (rightSpace < leftSpace) {
      return "outgoing"
    }

    return "incoming"
  }

  const normalizeMessageBlockText = (value: string) =>
    value
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
      .trim()

  const getPreferredMessageTexts = (nodes: HTMLElement[]) => {
    const uniqueTexts = Array.from(
      new Set(
        nodes
          .map((node) => normalizeMessageBlockText(node.innerText || ""))
          .filter(Boolean)
      )
    )

    return uniqueTexts.filter(
      (text) =>
        !uniqueTexts.some(
          (otherText) =>
            otherText !== text &&
            otherText.length > text.length &&
            otherText.includes(text)
        )
    )
  }

  const getMessageText = (container: HTMLElement) => {
    const primaryCandidates = getPreferredMessageTexts(
      Array.from(
        container.querySelectorAll<HTMLElement>('[data-testid="msg-text"]')
      )
    )
    const fallbackCandidates = getPreferredMessageTexts(
      Array.from(
        container.querySelectorAll<HTMLElement>(
          '[data-testid="selectable-text"], .copyable-text'
        )
      )
    )
    const candidates =
      primaryCandidates.length > 0 ? primaryCandidates : fallbackCandidates

    if (candidates.length > 0) {
      return candidates[0]
    }

    const mediaLabel = container
      .querySelector<HTMLElement>('[data-testid="media-caption"], [aria-label]')
      ?.innerText

    const normalizedMediaLabel = mediaLabel
      ? normalizeMessageBlockText(mediaLabel)
      : ""

    return normalizedMediaLabel || ""
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
    new Set(
      Array.from(
        (
          chatRoot.querySelector<HTMLElement>(
            '[data-testid="conversation-panel-messages"]'
          ) || chatRoot
        ).querySelectorAll<HTMLElement>('[data-testid="msg-container"]')
      )
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

const syncChatSnapshotToProxy = async (chatData: WhatsAppChatSnapshot) => {
  let lastFetchError = ""
  const snapshotCandidates = getSnapshotSyncCandidates()

  if (snapshotCandidates.length === 0) {
    throw new Error(
      "PLASMO_PUBLIC_CLARA_API_BASE_URL belum diisi. Fallback proxy lokal hanya aktif untuk development bila diizinkan eksplisit."
    )
  }

  for (const proxyUrl of snapshotCandidates) {
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
    `Gagal menghubungi API snapshot di ${snapshotCandidates[0] || CHAT_SNAPSHOT_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const clearChatSnapshotInProxy = async () => {
  let lastFetchError = ""
  const snapshotCandidates = getSnapshotSyncCandidates()

  if (snapshotCandidates.length === 0) {
    return
  }

  for (const proxyUrl of snapshotCandidates) {
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
    `Gagal menghubungi API snapshot di ${snapshotCandidates[0] || CHAT_SNAPSHOT_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const fetchSuggestionsFromClaraBackendOnly = async (
  chatData: WhatsAppChatSnapshot
) => {
  const claraReplySuggestionsUrl = getClaraReplySuggestionsUrl()

  if (!claraReplySuggestionsUrl) {
    if (!isDevFallbackAllowed()) {
      throw new Error(
        "Endpoint backend Clara untuk reply suggestion belum dikonfigurasi. Fallback proxy lokal diblokir di mode non-development."
      )
    }
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
    `Gagal menghubungi backend Clara untuk mengambil jawaban terbaik. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const shouldClearSnapshotForError = (message: string) =>
  [
    "Belum ada percakapan yang sedang dibuka.",
    "Buka WhatsApp Web dulu di tab aktif.",
    "Panel chat WhatsApp Web belum ditemukan."
  ].some((pattern) => message.includes(pattern))

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
  const [draftSuggestions, setDraftSuggestions] = useState<string[]>([])
  const [editingSuggestionIndex, setEditingSuggestionIndex] = useState<
    number | null
  >(null)
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
  const primarySuggestion = suggestions[0] || ""
  const primaryDraftSuggestion = draftSuggestions[0] || primarySuggestion

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
    setDraftSuggestions([])
    setEditingSuggestionIndex(null)
    setReplySuggestionId("")

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
          "Chat aktif belum punya pesan teks yang bisa dipakai untuk generate jawaban."
        )
      }

      setChatData(currentChatData)
      const suggestionResult =
        await fetchSuggestionsFromClaraBackendOnly(currentChatData)
      const bestSuggestion = suggestionResult?.suggestions[0]?.trim()

      if (!bestSuggestion) {
        throw new Error("Clara belum mengembalikan jawaban terbaik.")
      }

      setSuggestions([bestSuggestion])
      setDraftSuggestions([bestSuggestion])
      setEditingSuggestionIndex(null)
      setReplySuggestionId(suggestionResult.replySuggestionId || "")
      setFeedback(
        suggestionResult.cached
          ? "Jawaban terbaik tetap sama karena isi chat belum berubah."
          : "Jawaban terbaik Clara sudah siap dipakai."
      )
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat membuat saran jawaban."

      setSuggestions([])
      setDraftSuggestions([])
      setEditingSuggestionIndex(null)
      setReplySuggestionId("")
      setError(message)
    } finally {
      setIsSuggesting(false)
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

  const handleStartEditingSuggestion = (index: number) => {
    setEditingSuggestionIndex(index)
    setError("")
    setFeedback("")
  }

  const handleDraftSuggestionChange = (index: number, value: string) => {
    setDraftSuggestions((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? value : draft
      )
    )
  }

  const handleSaveEditedSuggestion = (index: number) => {
    const editedSuggestion = draftSuggestions[index]?.trim()

    if (!editedSuggestion) {
      setError("Draft balasan tidak boleh kosong.")
      return
    }

    setSuggestions((currentSuggestions) =>
      currentSuggestions.map((suggestion, suggestionIndex) =>
        suggestionIndex === index ? editedSuggestion : suggestion
      )
    )
    setDraftSuggestions((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? editedSuggestion : draft
      )
    )
    setEditingSuggestionIndex(null)
    setError("")
    setFeedback("Draft balasan berhasil diperbarui.")
  }

  const handleCancelEditingSuggestion = (index: number) => {
    setDraftSuggestions((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? suggestions[index] || draft : draft
      )
    )
    setEditingSuggestionIndex(null)
    setError("")
    setFeedback("")
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
    ? "Jawaban terbaik siap"
    : isSuggesting
      ? "Sedang menyusun jawaban"
      : "Belum ada jawaban"

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
                    akan muncul di area ini dan tombol generate bisa langsung
                    dipakai di sebelahnya.
                  </div>
                </div>
              )}
            </section>

            <div className="clara-action-bridge">
              <div className="clara-action-bridge__line" />
              <div className="clara-action-bridge__actions">
                <button
                  className="clara-button clara-button--ghost clara-button--block clara-button--compact"
                  disabled={isLoading}
                  onClick={handleReadChat}>
                  {isLoading
                    ? "Membaca chat..."
                    : chatData
                      ? "Refresh Chat"
                      : "Baca Chat Aktif"}
                </button>
                <button
                  className="clara-button clara-button--primary clara-button--block clara-button--compact"
                  disabled={isSuggesting || isLoading || !chatData}
                  onClick={handleSuggestReplies}>
                  {isSuggesting ? "Generate..." : "Generate Jawaban"}
                </button>
              </div>
              <div className="clara-action-bridge__line" />
            </div>

            <section className="clara-pane clara-pane--reply">
              <div className="clara-pane__header">
                <div>
                  <div className="clara-pane__eyebrow">Balasan AI</div>
                  <div className="clara-pane__title">
                    Satu jawaban terbaik yang siap dipakai
                  </div>
                  <p className="clara-pane__copy">
                    Clara fokus kasih satu hasil generate terbaik biar lebih cepat dan praktis.
                  </p>
                </div>

                <div className="clara-chip clara-chip--soft">
                  {draftStatusLabel}
                </div>
              </div>

              {primarySuggestion ? (
                <>
                  <div className="clara-draft-list">
                    <article className="clara-draft">
                      <div className="clara-draft__head">
                        <div>
                          <div className="clara-draft__number">
                            Jawaban Terbaik
                          </div>
                          <div className="clara-draft__tone">
                            Siap dipakai langsung
                          </div>
                        </div>

                        <div className="clara-draft__hint">
                          Hasil tercepat Clara
                        </div>
                      </div>

                      {editingSuggestionIndex === 0 ? (
                          <div className="clara-draft__editor">
                            <textarea
                              className="clara-input clara-input--textarea"
                              onChange={(event) =>
                                handleDraftSuggestionChange(0, event.target.value)
                              }
                              rows={6}
                              value={primaryDraftSuggestion}
                            />
                            <div className="clara-draft__actions">
                              <button
                                className="clara-button clara-button--ghost"
                                onClick={() => handleCancelEditingSuggestion(0)}>
                                Batal
                              </button>
                              <button
                                className="clara-button clara-button--insert"
                                onClick={() => handleSaveEditedSuggestion(0)}>
                                Simpan
                              </button>
                            </div>
                          </div>
                        ) : (
                        <div className="clara-draft__text">
                          {primarySuggestion}
                        </div>
                        )}

                      {editingSuggestionIndex !== 0 ? (
                          <div className="clara-draft__actions">
                            <button
                              className="clara-button clara-button--ghost"
                              onClick={() => handleStartEditingSuggestion(0)}>
                              Edit
                            </button>
                            <button
                              className="clara-button clara-button--insert"
                              disabled={isInsertingIndex === 0}
                              onClick={() =>
                                handleInsertSuggestion(primarySuggestion, 0)
                              }>
                              {isInsertingIndex === 0
                                ? "Memasukkan..."
                                : "Masukkan ke Chat"}
                            </button>
                            <button
                              className="clara-button clara-button--send"
                              disabled={isInsertingIndex === 0}
                              onClick={() =>
                                handleSendSuggestion(primarySuggestion, 0)
                              }>
                              {isInsertingIndex === 0
                                ? "Mengirim..."
                                : "Kirim Sekarang"}
                            </button>
                          </div>
                        ) : null}
                    </article>
                  </div>
                </>
              ) : (
                <div className="clara-empty">
                  <div className="clara-empty__title">
                    Belum ada jawaban terbaik
                  </div>
                  <div className="clara-empty__meta">
                    Setelah isi chat berhasil dibaca, klik{" "}
                    <strong>Generate Jawaban</strong> supaya Clara menyiapkan
                    satu balasan terbaik yang bisa langsung kamu pakai.
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
