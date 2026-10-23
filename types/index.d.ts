export type Repo = { current: string; branches: string[] }

declare module 'claude-code' {
  interface PluginState {
    'branch-picker': { repo: Repo | null }
  }
}
