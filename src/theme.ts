// The light, dark or system theme, kept in the app's settings and mirrored in this browser so the first paint is right.

import { local_theme_storage, theme_choice, type Theme, type ThemeStorage } from '@x-tech-laboratories/x-libs/web/theme'
import { getSettings, saveSettings } from './db/index'

const local_copy = local_theme_storage('x-stream-theme')

const settings_storage: ThemeStorage = {
  read: () => local_copy.read(),
  write: (theme: Theme) => {
    local_copy.write(theme)
    saveSettings({ theme }).catch(() => {})
  },
}

export const theme = theme_choice(settings_storage)

// Takes the theme from the settings, which win over this browser's copy.
export async function load_saved_theme(): Promise<void> {
  try {
    const settings = await getSettings()
    local_copy.write(settings.theme)
    theme.apply()
  } catch {
    theme.apply()
  }
}
