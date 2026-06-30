# Clara Dashboard Instructions for Codex

## Scope

This folder contains **Clara Dashboard**.

For the **Social DM Extension Reader** feature, dashboard changes must be minimal and must fit the existing Clara dashboard flow.

The feature adds channel awareness for conversations coming from:

* WhatsApp Web
* Instagram DM Web
* TikTok DM Web

Do not redesign the whole dashboard for this feature.

Do not create a separate Instagram Inbox or TikTok Inbox page for MVP unless explicitly requested by the developer.

---

## Required Documents

Before editing dashboard code, always read these documents:

```txt
../docs/features/social-dm-extension-reader/01-feature-prd.md
../docs/features/social-dm-extension-reader/02-technical-design.md
../docs/features/social-dm-extension-reader/04-api-spec.md
../docs/features/social-dm-extension-reader/05-database-migration-spec.md
../docs/features/social-dm-extension-reader/06-ux-flow-ui-spec.md
../docs/features/social-dm-extension-reader/07-security-privacy-checklist.md
```

If the documents do not exist yet, ask the developer to add them before making major dashboard changes.

---

## Dashboard Feature Goal

The dashboard must clearly show which channel a conversation comes from.

Supported channels:

```txt
whatsapp
instagram
tiktok
```

Supported providers:

```txt
extension
official_api
manual
```

For this feature, the default provider is:

```txt
extension
```

The dashboard should display these as user-friendly labels:

```txt
whatsapp   -> WhatsApp
instagram  -> Instagram DM
tiktok     -> TikTok DM

extension    -> Extension Reader
official_api -> Official API
manual       -> Manual
```

---

## Main Dashboard Areas Affected

The Social DM Extension Reader feature may affect these dashboard areas:

```txt
Queue
Conversation Detail
CRM / Lead Detail
Customer Detail
Chat Review / Coaching
Manager Insights
Admin / Control Panel
```

For MVP, focus on:

```txt
Queue
Conversation Detail
CRM / Lead Detail
Chat Review / Coaching
```

Admin and Manager Insights can be improved later if the existing dashboard structure already supports it.

---

## MVP UI Requirements

### Queue

The Queue should show the source channel of each conversation.

Required:

```txt
- Show channel badge on each conversation row/card.
- Add channel filter if the Queue already has a filter system.
- Do not make the row/card too crowded.
```

Example:

```txt
[Instagram DM] john.doe
Halo kak, produk ini masih ada?
Intent: Product Availability
Priority: High
Last synced: 2 min ago
```

Channel filter options:

```txt
All Channels
WhatsApp
Instagram DM
TikTok DM
```

---

### Conversation Detail

Conversation Detail should show channel and provider/source metadata.

Required header metadata:

```txt
Channel: Instagram DM
Provider: Extension Reader
Source: instagram_extension
```

Example:

```txt
john.doe
[Instagram DM] [Extension Reader]

Last sync: 2026-06-26 10:00
```

Do not change the entire conversation layout unless required.

---

### CRM / Lead Detail

CRM or Lead Detail should show source channel if available.

Example:

```txt
Source Channel: Instagram DM
Source Provider: Extension Reader
```

If a customer has multiple known channels, display them clearly:

```txt
Known Channels:
- WhatsApp
- Instagram DM
- TikTok DM
```

For MVP, if identity matching is not available yet, only display the channel on the related conversation.

---

### Customer Detail

Customer Detail should support multi-channel context.

Example:

```txt
Customer: John Doe

Channels:
[WhatsApp] +62xxx
[Instagram DM] john.doe
[TikTok DM] @buyer123
```

If the current data model does not support unified customer identity yet, do not force it. Show channel information only where available.

---

### Chat Review / Coaching

Review screens should show the source channel so managers know where the conversation happened.

Example:

```txt
[Instagram DM] john.doe
Sales: Arya
Issue: Reply quality review
Status: Needs review
```

Inside review detail:

```txt
Channel: Instagram DM
Provider: Extension Reader
Source: instagram_extension
```

---

### Manager Insights

If the current dashboard already supports filters, add channel filtering.

Options:

```txt
All Channels
WhatsApp
Instagram DM
TikTok DM
```

Do not build complex analytics for MVP unless explicitly requested.

Possible future metrics:

```txt
Reply suggestion usage by channel
Response time by channel
Stale conversation by channel
Conversion by channel
```

---

### Admin / Control Panel

For MVP, admin channel control can remain environment-based.

Feature flags:

```txt
ENABLE_WHATSAPP_EXTENSION_READER=true
ENABLE_INSTAGRAM_EXTENSION_READER=true
ENABLE_TIKTOK_EXTENSION_READER=true
```

Only add Admin UI if the existing dashboard already has a clear settings/control panel pattern.

Possible future Admin UI:

```txt
Extension Channels:
- WhatsApp: Enabled
- Instagram DM: Enabled / Experimental
- TikTok DM: Enabled / Experimental
```

---

## Required Components

Create or reuse components based on the existing dashboard component structure.

Recommended components:

```txt
ChannelLabel
ProviderLabel
ChannelFilter
ConversationSourceMeta
```

Do not create duplicate components if equivalent components already exist.

---

## ChannelLabel Component

Purpose:

```txt
Display the source channel of a conversation.
```

Suggested props:

```ts
type Channel = "whatsapp" | "instagram" | "tiktok"

type ChannelLabelProps = {
  channel: Channel
}
```

Text mapping:

```txt
whatsapp  -> WhatsApp
instagram -> Instagram DM
tiktok    -> TikTok DM
```

Usage examples:

```tsx
<ChannelLabel channel="instagram" />
<ChannelLabel channel="tiktok" />
<ChannelLabel channel="whatsapp" />
```

---

## ProviderLabel Component

Purpose:

```txt
Display where the conversation data came from.
```

Suggested props:

```ts
type Provider = "extension" | "official_api" | "manual"

type ProviderLabelProps = {
  provider: Provider
}
```

Text mapping:

```txt
extension    -> Extension Reader
official_api -> Official API
manual       -> Manual
```

Usage examples:

```tsx
<ProviderLabel provider="extension" />
<ProviderLabel provider="official_api" />
```

---

## ChannelFilter Component

Purpose:

```txt
Allow users to filter conversations by channel.
```

Options:

```txt
All Channels
WhatsApp
Instagram DM
TikTok DM
```

Suggested value:

```ts
type ChannelFilterValue = "all" | "whatsapp" | "instagram" | "tiktok"
```

Rules:

```txt
- Preserve existing filter behavior.
- Do not reset unrelated filters unless necessary.
- Keep filter state consistent with existing dashboard patterns.
```

---

## ConversationSourceMeta Component

Purpose:

```txt
Show channel/provider/source metadata in Conversation Detail.
```

Suggested props:

```ts
type ConversationSourceMetaProps = {
  channel: "whatsapp" | "instagram" | "tiktok"
  provider?: "extension" | "official_api" | "manual"
  source?: string
  lastSyncedAt?: string
}
```

Example output:

```txt
Channel: Instagram DM
Provider: Extension Reader
Source: instagram_extension
Last sync: 2026-06-26 10:00
```

---

## Security Rules

Customer messages are untrusted input.

Never render customer message text using:

```tsx
dangerouslySetInnerHTML
```

Do not render raw HTML from messages.

XSS payloads like this:

```html
<img src=x onerror=alert(1)>
```

must appear as plain text and must not execute.

Required:

```txt
- Render message text as escaped plain text.
- Do not inject message text into raw HTML.
- Do not use message text as unsafe attribute values.
- Do not expose stack traces in UI.
- Do not display data from another tenant.
```

---

## Privacy Rules

Dashboard must not expose unnecessary private data.

Required:

```txt
- Show only data the current user is authorized to see.
- Respect tenant isolation.
- Do not show full raw payload from extension.
- Do not show cookies, tokens, or platform session data.
- Do not show internal environment variables.
- Avoid displaying excessive debug metadata to normal users.
```

---

## Dashboard UX Rules

Follow these UX rules:

```txt
- Keep existing dashboard layout.
- Add channel labels without redesigning major screens.
- Make Instagram/TikTok clearly visible as social DM channels.
- If provider is extension, label it as Extension Reader.
- Do not imply official API integration if provider is extension.
- Do not create separate Instagram/TikTok inboxes for MVP.
```

Correct copy:

```txt
Instagram DM · Extension Reader
TikTok DM · Extension Reader
```

Avoid misleading copy:

```txt
Instagram Official API
TikTok Official API
```

unless provider is actually `official_api`.

---

## Error / Empty State Copy

If the user filters by Instagram and there is no data:

```txt
Belum ada conversation dari Instagram DM.
Gunakan Clara Extension di halaman Instagram DM untuk mulai sync.
```

If the user filters by TikTok and there is no data:

```txt
Belum ada conversation dari TikTok DM.
Gunakan Clara Extension di halaman TikTok Messages untuk mulai sync.
```

If channel metadata is missing:

```txt
Channel belum tersedia.
```

Do not crash the UI if `channel`, `provider`, or `source` is missing.

---

## Data Handling Rules

Expected conversation fields:

```txt
channel
provider
source
external_thread_id
normalized_chat_title
```

Expected message fields:

```txt
channel
provider
external_message_id
fingerprint
```

Dashboard should handle missing fields gracefully because older WhatsApp data may not have all new metadata yet.

Fallback behavior:

```txt
If channel is missing, show "Unknown Channel" or fallback to WhatsApp only if backend explicitly guarantees old data is WhatsApp.
If provider is missing, show "Unknown Source" or hide provider label.
```

---

## Testing Requirements

After dashboard changes, test:

```txt
[ ] Queue still loads.
[ ] Queue shows WhatsApp channel label.
[ ] Queue shows Instagram DM channel label.
[ ] Queue shows TikTok DM channel label.
[ ] Channel filter works if implemented.
[ ] Conversation Detail shows channel/provider/source.
[ ] CRM/Lead Detail does not break.
[ ] Chat Review screen shows channel if available.
[ ] Old WhatsApp conversations still render.
[ ] Missing channel/provider does not crash UI.
[ ] XSS payload is rendered as plain text.
```

XSS test message:

```html
<img src=x onerror=alert(1)>
```

Expected:

```txt
Text appears literally.
No alert is triggered.
No script executes.
```

---

## Do Not Do

Do not:

```txt
- Redesign the whole dashboard.
- Create a new social inbox page for MVP.
- Add fake official API labels.
- Use dangerouslySetInnerHTML for chat messages.
- Display raw extension payload.
- Display cookies/tokens/session data.
- Break existing WhatsApp conversation UI.
- Mix tenant data.
- Hardcode channel labels in many places.
```

Use shared mapping utilities/components where possible.

---

## Recommended Implementation Order

```txt
1. Add channel/provider type definitions if not already present.
2. Add ChannelLabel component.
3. Add ProviderLabel component.
4. Add ConversationSourceMeta component.
5. Add channel badge to Queue.
6. Add channel/provider/source metadata to Conversation Detail.
7. Add ChannelFilter only if existing filter architecture supports it.
8. Add XSS safety regression check.
9. Test old WhatsApp conversations.
```

---

## Definition of Done

Dashboard work is done only if:

```txt
- Existing dashboard still works.
- WhatsApp conversations still render correctly.
- Instagram/TikTok conversations show correct channel labels.
- Conversation Detail shows source metadata.
- Missing metadata does not crash the UI.
- Customer messages are rendered safely as plain text.
- No raw HTML or private payload is exposed.
- No new large dashboard redesign was introduced.
```
