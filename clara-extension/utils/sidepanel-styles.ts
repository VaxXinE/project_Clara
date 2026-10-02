import manropeFont from "url:../assets/manrope-latin.woff2"
import chatWallpaper from "../assets/eb24786e5579a01bdd4bb103695b8286.jpg"

/** Gaya side panel Clara. Dipisah dari komponen supaya mudah dibaca dan diubah. */
export const panelCss = `
  @font-face {
    font-display: swap;
    font-family: "Manrope";
    font-weight: 400 800;
    src: url("${manropeFont}") format("woff2");
  }

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
    background: linear-gradient(180deg, #120d08 0%, #070503 100%);
    color: var(--clara-ink);
    font-family: "Manrope", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
    padding: 12px;
    box-sizing: border-box;
    width: 100%;
  }

  .clara-panel--chatgpt {
    max-height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-gutter: stable;
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

  .clara-stage--chatgpt {
    grid-template-rows: auto minmax(0, 1fr);
    min-height: calc(100vh - 24px);
  }

  .clara-stage > * {
    max-width: 100%;
    min-width: 0;
  }

  .clara-hero {
    background: #171008;
    border: 1px solid rgba(240, 203, 115, 0.14);
    border-radius: 16px;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
    color: #fff0c9;
    overflow: hidden;
    padding: 14px;
    position: relative;
  }

  .clara-hero::after {
    content: none;
  }

  .clara-hero__top,
  .clara-pane__header,
  .clara-draft__head {
    align-items: flex-start;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    justify-content: space-between;
    position: relative;
    z-index: 1;
  }

  .clara-hero__top {
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr);
  }

  .clara-build-badge {
    align-self: start;
    background: rgba(12, 9, 6, 0.72);
    border: 1px solid rgba(240, 203, 115, 0.28);
    border-radius: 999px;
    color: #ffe3a0;
    font-size: 12px;
    font-weight: 800;
    justify-self: start;
    padding: 8px 10px;
  }

  .clara-workspace-switcher {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    position: relative;
    z-index: 1;
  }

  .clara-workspace-cta {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 10px;
    position: relative;
    z-index: 1;
  }

  .clara-workspace-tab {
    appearance: none;
    background: rgba(12, 9, 6, 0.56);
    border: 1px solid rgba(240, 203, 115, 0.14);
    border-radius: 999px;
    color: rgba(247, 231, 183, 0.82);
    cursor: pointer;
    font-size: 12px;
    font-weight: 800;
    justify-content: center;
    min-height: 44px;
    padding: 9px 12px;
    text-align: center;
    transition:
      border-color 0.16s ease,
      background 0.16s ease,
      color 0.16s ease,
      transform 0.16s ease;
  }

  .clara-workspace-tab:hover {
    border-color: rgba(240, 203, 115, 0.32);
    color: #fff0c9;
    transform: translateY(-1px);
  }

  .clara-hero__footer {
    display: flex;
    justify-content: flex-start;
    margin-top: 12px;
    position: relative;
    z-index: 1;
  }

  .clara-workspace-tab--active {
    background: linear-gradient(135deg, rgba(240, 203, 115, 0.22), rgba(194, 144, 50, 0.18));
    border-color: rgba(240, 203, 115, 0.42);
    color: #fff0c9;
  }

  .clara-workspace-cta .clara-button {
    min-height: 44px;
  }

  .clara-hero__eyebrow {
    color: rgba(240, 203, 115, 0.88);
    font-size: 12px;
    font-weight: 800;
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
    font-size: 12px;
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
    font-size: 12px;
    line-height: 1.45;
    margin-top: 6px;
    overflow-wrap: anywhere;
  }

  .clara-pane {
    background: var(--clara-surface);
    border: 1px solid rgba(240, 203, 115, 0.14);
    border-radius: 16px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
    display: grid;
    gap: 12px;
    min-width: 0;
    padding: 14px;
  }

  .clara-pane--chatgpt {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-height: 72vh;
    overflow: hidden;
    padding: 0;
  }

  .clara-chatgpt-context {
    background:
      linear-gradient(180deg, rgba(28, 20, 13, 0.98), rgba(18, 13, 10, 0.98));
    border-top: 1px solid rgba(240, 203, 115, 0.12);
    display: grid;
    gap: 10px;
    max-height: min(42vh, 360px);
    overflow-x: hidden;
    overflow-y: auto;
    padding: 14px;
    scrollbar-gutter: stable;
  }

  .clara-chatgpt-context--collapsed {
    gap: 8px;
    max-height: none;
    overflow: hidden;
  }

  .clara-chatgpt-context__details {
    display: grid;
    gap: 10px;
  }

  .clara-chatgpt-context::-webkit-scrollbar {
    width: 8px;
  }

  .clara-chatgpt-context::-webkit-scrollbar-thumb {
    background: rgba(240, 203, 115, 0.24);
    border-radius: 999px;
  }

  .clara-chatgpt-context__top {
    align-items: flex-start;
    display: flex;
    gap: 12px;
    justify-content: space-between;
  }

  .clara-chatgpt-context__summary {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .clara-chatgpt-context__actions {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .clara-chatgpt-context__toggle {
    align-items: center;
    appearance: none;
    background: rgba(255, 240, 201, 0.04);
    border: 1px solid rgba(240, 203, 115, 0.14);
    border-radius: 14px;
    color: #f0cb73;
    cursor: pointer;
    display: inline-flex;
    font-size: 12px;
    font-weight: 800;
    gap: 8px;
    justify-content: center;
    min-height: 44px;
    padding: 8px 12px;
    width: 100%;
  }

  .clara-chatgpt-context__toggle:hover {
    border-color: rgba(240, 203, 115, 0.28);
  }

  .clara-chatgpt-context__toggle-icon {
    font-size: 12px;
    line-height: 1;
  }

  .clara-chatgpt-context__meta {
    background: rgba(255, 240, 201, 0.06);
    border: 1px solid rgba(240, 203, 115, 0.12);
    border-radius: 16px;
    color: #e5c98b;
    display: grid;
    gap: 6px;
    font-size: 12px;
    line-height: 1.45;
    padding: 11px 12px;
  }

  .clara-chatgpt-context__meta strong {
    color: #fff0c9;
  }

  .clara-chatgpt-context__prompt {
    font-size: 12px;
    line-height: 1.55;
    min-height: 104px;
    max-height: 148px;
    resize: none;
  }

  .clara-chatgpt-context__prompt[readonly] {
    cursor: text;
  }

  .clara-pane--chatgpt .clara-pane__header {
    gap: 8px;
  }

  .clara-pane--chatgpt .clara-pane__eyebrow {
    font-size: 12px;
  }

  .clara-pane--chatgpt .clara-pane__title {
    font-size: 15px;
    margin-top: 2px;
  }

  .clara-pane--chatgpt .clara-pane__copy {
    font-size: 12px;
    line-height: 1.35;
    margin-top: 2px;
  }

  .clara-pane--reply {
    background:
      linear-gradient(180deg, rgba(35,25,16,0.96), rgba(18,13,10,0.98));
  }

  .clara-pane__eyebrow {
    color: #c9aa68;
    font-size: 12px;
    font-weight: 800;
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
    font-size: 12px;
    font-weight: 700;
    justify-content: center;
    max-width: 100%;
    min-height: 28px;
    overflow-wrap: anywhere;
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
    min-height: 44px;
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
    min-height: 44px;
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
    background: linear-gradient(135deg, #f6d98c 0%, #c29032 100%);
    color: #140f08;
  }

  .clara-button--send {
    background: rgba(66, 33, 21, 0.98);
    border: 1px solid rgba(225, 124, 84, 0.5);
    color: #ffb4a0;
  }

  .clara-note {
    border-radius: 16px;
    font-size: 13px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    padding: 11px 12px;
    word-break: break-word;
  }

  .clara-note--warn {
    background: rgba(55, 38, 18, 0.96);
    border: 1px solid rgba(240, 203, 115, 0.22);
    color: #f3d694;
  }

  .clara-pane--chatgpt .clara-note--warn {
    font-size: 12px;
    line-height: 1.35;
    padding: 9px 10px;
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
    font-size: 12px;
    line-height: 1.35;
    margin-top: 2px;
    overflow-wrap: anywhere;
  }

  .clara-chat-latest {
    background: rgba(255, 240, 201, 0.06);
    border-bottom: 1px solid rgba(240, 203, 115, 0.08);
    color: #d6bb84;
    font-size: 12px;
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
    margin: 0;
    list-style: none;
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
    font-size: 12px;
    font-weight: 800;
    line-height: 1.3;
    margin-bottom: 4px;
    overflow-wrap: anywhere;
  }

  .clara-thread-message__reply-context {
    background: rgba(255, 240, 201, 0.06);
    border: 1px solid rgba(240, 203, 115, 0.14);
    border-radius: 10px;
    margin-bottom: 6px;
    padding: 6px 7px;
  }

  .clara-thread-message__reply-label {
    color: #d6bb84;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.3;
    margin-bottom: 2px;
  }

  .clara-thread-message__reply-text {
    color: #efd8a2;
    font-size: 12px;
    line-height: 1.4;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    word-break: break-word;
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
    font-size: 12px;
    justify-content: flex-end;
    line-height: 1.2;
    margin-top: 4px;
  }

  .clara-thread-message--out .clara-thread-message__author {
    color: rgba(20, 15, 8, 0.68);
  }

  .clara-thread-message--out .clara-thread-message__reply-context {
    background: rgba(20, 15, 8, 0.08);
    border-color: rgba(20, 15, 8, 0.12);
  }

  .clara-thread-message--out .clara-thread-message__reply-label {
    color: rgba(20, 15, 8, 0.65);
  }

  .clara-thread-message--out .clara-thread-message__reply-text {
    color: rgba(20, 15, 8, 0.88);
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

  .clara-embed-shell {
    background: rgba(7, 5, 3, 0.56);
    border: 1px solid rgba(240, 203, 115, 0.12);
    border-radius: 18px;
    min-height: 86vh;
    overflow: hidden;
    position: relative;
  }

  .clara-embed-shell--chatgpt {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    min-height: 72vh;
    border: none;
    border-radius: inherit;
    overflow: hidden;
  }

  .clara-embed-toolbar {
    align-items: center;
    background: rgba(13, 10, 7, 0.92);
    border-bottom: 1px solid rgba(240, 203, 115, 0.12);
    display: flex;
    gap: 8px;
    justify-content: space-between;
    padding: 8px 10px;
  }

  .clara-embed-url {
    color: rgba(247, 231, 183, 0.72);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .clara-embed-frame {
    background: #0b0805;
    border: 0;
    display: block;
    height: 86vh;
    min-height: 820px;
    width: 100%;
  }

  .clara-embed-frame--chatgpt {
    flex: 1;
    height: 100%;
    min-height: 0;
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
  }

  .clara-draft__tone {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }

  .clara-draft__hint {
    color: var(--clara-muted);
    font-size: 12px;
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
    font-family: "Manrope", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
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

  .clara-field-label {
    color: var(--clara-muted);
    font-size: 12px;
    font-weight: 700;
  }

  .clara-panel button:focus-visible,
  .clara-panel textarea:focus-visible {
    outline: 2px solid var(--clara-accent);
    outline-offset: 2px;
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
    .clara-draft__actions,
    .clara-workspace-cta {
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

  @media (prefers-reduced-motion: reduce) {
    .clara-panel *,
    .clara-panel *::before,
    .clara-panel *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }

    .clara-panel button:hover {
      transform: none;
    }
  }
  .clara-actionbar {
    background: linear-gradient(180deg, rgba(35, 25, 16, 0.98), rgba(23, 17, 11, 0.98));
    border: 1px solid rgba(240, 203, 115, 0.22);
    border-radius: 16px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
    display: grid;
    gap: 10px;
    padding: 12px;
    position: sticky;
    top: 0;
    z-index: 5;
  }

  .clara-actionbar__status {
    color: #e5c98b;
    font-size: 13px;
    line-height: 1.45;
    margin: 0;
    overflow-wrap: anywhere;
  }

  .clara-actionbar__buttons {
    display: grid;
    gap: 8px;
  }

  .clara-draft__hint-text {
    color: var(--clara-muted);
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
  }

  .clara-confirm {
    background: rgba(66, 33, 21, 0.5);
    border: 1px solid rgba(225, 124, 84, 0.4);
    border-radius: 14px;
    display: grid;
    gap: 10px;
    padding: 12px;
  }

  .clara-confirm__text {
    color: #ffd2c2;
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
    overflow-wrap: anywhere;
  }

  .clara-linkbutton {
    appearance: none;
    background: none;
    border: none;
    color: var(--clara-muted);
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    min-height: 44px;
    padding: 0 4px;
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .clara-linkbutton:hover:not(:disabled) {
    color: #fff0c9;
  }

  .clara-linkbutton:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .clara-panel .clara-draft__actions--pair {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  }

  .clara-hero:not(:has(.clara-workspace-switcher)) {
    background: none;
    border: 0;
    box-shadow: none;
    padding: 0;
  }
`
