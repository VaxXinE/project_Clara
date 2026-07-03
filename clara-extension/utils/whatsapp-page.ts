import type {
  WhatsAppActionResponse,
  WhatsAppChatSnapshot,
  WhatsAppMessage,
  WhatsAppMessageDirection,
  WhatsAppReadResponse
} from "~/types/whatsapp"

const INSERT_LOCK_KEY = "__sgExtensionInsertLock__"

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

const SELF_AUTHOR_PATTERN = /^(you|anda|me|saya)$/i

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

const isLikelyMessageContainer = (node: HTMLElement) =>
  Boolean(
    node.querySelector("[data-pre-plain-text]") ||
      node.querySelector('[data-testid="msg-text"]') ||
      node.querySelector('[data-testid="selectable-text"]') ||
      node.matches("[data-testid='msg-container']")
  )

const compareMessageContainerOrder = (
  left: HTMLElement,
  right: HTMLElement
) => {
  if (left === right) {
    return 0
  }

  const leftRect = left.getBoundingClientRect()
  const rightRect = right.getBoundingClientRect()
  const topDelta = leftRect.top - rightRect.top

  if (Math.abs(topDelta) > 6) {
    return topDelta
  }

  const leftDelta = leftRect.left - rightRect.left

  if (Math.abs(leftDelta) > 6) {
    return leftDelta
  }

  const documentPosition = left.compareDocumentPosition(right)

  if (documentPosition & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1
  }

  if (documentPosition & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1
  }

  return 0
}

const queryUniqueMessageContainers = (root: ParentNode) => {
  const panelRoot =
    root.querySelector<HTMLElement>('[data-testid="conversation-panel-messages"]') ||
    root

  const directContainers = Array.from(
    panelRoot.querySelectorAll<HTMLElement>('[data-testid="msg-container"]')
  )
  const fallbackContainers = Array.from(
    panelRoot.querySelectorAll<HTMLElement>(
      '[data-pre-plain-text], [data-testid="msg-text"], [data-testid="selectable-text"]'
    )
  )
    .map(
      (node) =>
        node.closest<HTMLElement>('[data-testid="msg-container"]') ||
        node.closest<HTMLElement>('div[role="row"]') ||
        node.parentElement
    )
    .filter((node): node is HTMLElement => Boolean(node))
    .filter(isLikelyMessageContainer)

  return Array.from(new Set([...directContainers, ...fallbackContainers])).sort(
    compareMessageContainerOrder
  )
}

export const isWhatsAppSupportedPage = () =>
  window.location.hostname === "web.whatsapp.com"

export const readWhatsAppFromPage = (): WhatsAppReadResponse => {
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
      'header [title]',
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

  type ParsedReplyAwareMessage = {
    replyContextSenderName?: string
    replyContextSenderType?: "incoming" | "outgoing" | "unknown"
    replyContextText?: string
    text: string
  }

  const splitReplyAwareMessageText = (candidates: string[]) => {
    if (candidates.length === 0) {
      return {
        text: ""
      } satisfies ParsedReplyAwareMessage
    }

    if (candidates.length > 1) {
      return {
        replyContextText: candidates.slice(0, -1).join("\n"),
        text: candidates[candidates.length - 1]
      } satisfies ParsedReplyAwareMessage
    }

    return {
      text: candidates[0]
    } satisfies ParsedReplyAwareMessage
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
      const parsed = splitReplyAwareMessageText(candidates)

      if (parsed.replyContextText) {
        const direction = getMessageDirection(container)
        const replyContextSenderType =
          direction === "outgoing" ? "incoming" : "outgoing"

        return {
          replyContextSenderName: undefined,
          replyContextSenderType,
          replyContextText: parsed.replyContextText,
          text: parsed.text
        } satisfies ParsedReplyAwareMessage
      }

      return parsed
    }

    const mediaLabel = container
      .querySelector<HTMLElement>('[data-testid="media-caption"], [aria-label]')
      ?.innerText

    const normalizedMediaLabel = mediaLabel
      ? normalizeMessageBlockText(mediaLabel)
      : ""

    return {
      text: normalizedMediaLabel || ""
    } satisfies ParsedReplyAwareMessage
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

  const messageContainers = queryUniqueMessageContainers(chatRoot)

  const messages: WhatsAppMessage[] = messageContainers
    .map((container) => {
      const metaSource =
        container
          .querySelector<HTMLElement>("[data-pre-plain-text]")
          ?.getAttribute("data-pre-plain-text") || ""
      const parsedMeta = parsePrePlainText(metaSource)
      const parsedMessage = getMessageText(container)
      const text = parsedMessage.text

      if (!text) {
        return null
      }

      return {
        authorName:
          parsedMeta.author ||
          (getMessageDirection(container) === "outgoing" ? "Anda" : chatTitle),
        direction: getMessageDirection(container),
        parsedMessage,
        parsedMeta,
        text
      }
    })
    .map((entry, index) => {
      if (!entry) {
        return null
      }

      const { authorName, direction, parsedMessage, parsedMeta, text } = entry
      const replyContextSenderName = parsedMessage.replyContextText
        ? direction === "outgoing"
          ? chatTitle
          : "Anda"
        : undefined

      return {
        author: authorName,
        direction,
        id: `${parsedMeta.timestampLabel}-${index}`,
        replyContextSenderName:
          parsedMessage.replyContextSenderName || replyContextSenderName,
        replyContextSenderType: parsedMessage.replyContextSenderType,
        replyContextText: parsedMessage.replyContextText,
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
      debugInfo: {
        candidateCount: messageContainers.length,
        channel: "whatsapp",
        firstMessageText: messages[0]?.text || "",
        lastMessageText: messages[messages.length - 1]?.text || ""
      },
      messages
    },
    ok: true
  }
}

const getConversationTitle = (chatRoot: HTMLElement) => {
  const titleSelectors = [
    '[data-testid="conversation-info-header-chat-title"]',
    'header [title]',
    'header [dir="auto"]'
  ]

  for (const selector of titleSelectors) {
    const node = chatRoot.querySelector<HTMLElement>(selector)
    const title = node?.getAttribute("title")?.trim() || node?.textContent?.trim()

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
    const subtitle = node?.getAttribute("title")?.trim() || node?.textContent?.trim()

    if (subtitle) {
      return subtitle
    }
  }

  return ""
}

const getMessageDirection = (container: HTMLElement): WhatsAppMessageDirection => {
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
        container.parentElement?.closest<HTMLElement>(".message-out, .message-in") ||
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

type ParsedReplyAwareMessage = {
  replyContextSenderName?: string
  replyContextSenderType?: "incoming" | "outgoing" | "unknown"
  replyContextText?: string
  text: string
}

const splitReplyAwareMessageText = (candidates: string[]) => {
  if (candidates.length === 0) {
    return {
      text: ""
    } satisfies ParsedReplyAwareMessage
  }

  if (candidates.length > 1) {
    return {
      replyContextText: candidates.slice(0, -1).join("\n"),
      text: candidates[candidates.length - 1]
    } satisfies ParsedReplyAwareMessage
  }

  return {
    text: candidates[0]
  } satisfies ParsedReplyAwareMessage
}

const getMessageText = (container: HTMLElement) => {
  const primaryCandidates = getPreferredMessageTexts(
    Array.from(container.querySelectorAll<HTMLElement>('[data-testid="msg-text"]'))
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
    const parsed = splitReplyAwareMessageText(candidates)
    if (parsed.replyContextText) {
      const direction = getMessageDirection(container)
      const replyContextSenderType = direction === "outgoing" ? "incoming" : "outgoing"
      return {
        replyContextSenderName: undefined,
        replyContextSenderType,
        replyContextText: parsed.replyContextText,
        text: parsed.text
      } satisfies ParsedReplyAwareMessage
    }
    return parsed
  }

  const mediaLabel = container
    .querySelector<HTMLElement>('[data-testid="media-caption"], [aria-label]')
    ?.innerText

  const normalizedMediaLabel = mediaLabel
    ? normalizeMessageBlockText(mediaLabel)
    : ""

  return {
    text: normalizedMediaLabel || ""
  } satisfies ParsedReplyAwareMessage
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

const getComposeFooter = () => getComposeBox()?.closest("footer") || document

const getComposeText = (composeBox: HTMLElement) =>
  composeBox.innerText.replace(/\s+/g, " ").trim()

export const getWhatsAppComposeText = () => {
  const composeBox = getComposeBox()

  if (!composeBox) {
    return ""
  }

  return getComposeText(composeBox)
}

export const getWhatsAppConversationTitle = () => {
  const chatRoot = getChatRoot()

  if (!chatRoot) {
    return ""
  }

  return getConversationTitle(chatRoot)
}

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

export const insertReplyIntoComposeBox = (
  text: string
): WhatsAppActionResponse => {
  const chatRoot = getChatRoot()

  if (!chatRoot || !getConversationTitle(chatRoot)) {
    return {
      error: "Buka percakapan WhatsApp yang aktif dulu sebelum memasukkan balasan.",
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

  const activeLock = (window as typeof window & {
    [INSERT_LOCK_KEY]?: { text: string; timestamp: number }
  })[INSERT_LOCK_KEY]

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

  ;(window as typeof window & {
    [INSERT_LOCK_KEY]?: { text: string; timestamp: number }
  })[INSERT_LOCK_KEY] = {
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

  if (insertedWithNativeCommand && getComposeText(composeBox) === normalizedText) {
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

const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

const getSnapshotLastMessage = (snapshot: WhatsAppReadResponse | undefined) => {
  const messages = snapshot?.data?.messages || []
  return messages[messages.length - 1]
}

const snapshotSignature = (snapshot: WhatsAppReadResponse | undefined) => {
  const lastMessage = getSnapshotLastMessage(snapshot)

  return JSON.stringify({
    chatTitle: snapshot?.data?.chatTitle || "",
    candidateCount: snapshot?.data?.debugInfo?.candidateCount || 0,
    lastMessageId: lastMessage?.id || "",
    lastMessageText: lastMessage?.text || "",
    messageCount: snapshot?.data?.messages.length || 0
  })
}

const pickBetterSnapshot = (
  current: WhatsAppReadResponse,
  candidate: WhatsAppReadResponse
) => {
  if (!current.ok || !current.data) {
    return candidate
  }

  if (!candidate.ok || !candidate.data) {
    return current
  }

  if (candidate.data.messages.length !== current.data.messages.length) {
    return candidate.data.messages.length > current.data.messages.length
      ? candidate
      : current
  }

  if (
    (candidate.data.debugInfo?.candidateCount || 0) !==
    (current.data.debugInfo?.candidateCount || 0)
  ) {
    return (candidate.data.debugInfo?.candidateCount || 0) >
      (current.data.debugInfo?.candidateCount || 0)
      ? candidate
      : current
  }

  const currentLastMessage = getSnapshotLastMessage(current)?.text.trim() || ""
  const candidateLastMessage = getSnapshotLastMessage(candidate)?.text.trim() || ""

  if (candidateLastMessage.length !== currentLastMessage.length) {
    return candidateLastMessage.length > currentLastMessage.length
      ? candidate
      : current
  }

  return candidate
}

export const readOpenChat = async (): Promise<WhatsAppReadResponse> => {
  let bestSnapshot = readWhatsAppFromPage()
  let previousSignature = snapshotSignature(bestSnapshot)

  for (const delayMs of [180, 260]) {
    await wait(delayMs)

    const nextSnapshot = readWhatsAppFromPage()
    const nextSignature = snapshotSignature(nextSnapshot)
    bestSnapshot = pickBetterSnapshot(bestSnapshot, nextSnapshot)

    if (nextSignature === previousSignature) {
      break
    }

    previousSignature = nextSignature
  }

  return bestSnapshot
}

const normalizeMessageText = (value: string) =>
  value.replace(/\s+/g, " ").trim().toLowerCase()

const getMessageContainers = () => {
  const chatRoot = getChatRoot()

  if (!chatRoot) {
    return []
  }

  return Array.from(
    queryUniqueMessageContainers(chatRoot)
  )
}

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

    const composeBox = getComposeBox()
    const composeText = composeBox ? getComposeText(composeBox) : ""
    const afterSendSnapshot = getLatestOutgoingMessageSnapshot()
    const normalizedLatestOutgoing = normalizeMessageText(afterSendSnapshot.text)

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

export const sendReplyThroughComposeBox = async (
  text: string
): Promise<WhatsAppActionResponse> => {
  const insertResult = insertReplyIntoComposeBox(text)

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

  const composeBox = getComposeBox()

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
