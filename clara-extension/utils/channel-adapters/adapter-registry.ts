import type { Channel } from "~/types/channel"

import type { ChannelAdapter } from "./base"
import { instagramAdapter } from "./instagram-adapter"
import { tiktokAdapter } from "./tiktok-adapter"
import { whatsappAdapter } from "./whatsapp-adapter"

const REGISTERED_ADAPTERS: ChannelAdapter[] = [
  whatsappAdapter,
  instagramAdapter,
  tiktokAdapter
]

export const getRegisteredAdapters = (): ChannelAdapter[] => [...REGISTERED_ADAPTERS]

export const getAdapterByChannel = (
  channel: Channel
): ChannelAdapter | null =>
  REGISTERED_ADAPTERS.find((adapter) => adapter.channel === channel) || null

export const getActiveAdapter = (): ChannelAdapter | null =>
  REGISTERED_ADAPTERS.find((adapter) => adapter.isSupportedPage()) || null
