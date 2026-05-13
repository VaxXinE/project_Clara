import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://web.whatsapp.com/*"]
}

export const getShadowHostId = () => "clara-extension-sidepanel-disabled"

const DisabledFloatingSidebar = () => null

export default DisabledFloatingSidebar
