export type ItemKind = 'ask' | 'step' | 'agent'
export type ItemSource = 'claude' | 'agent' | 'you'

export type Item = {
  id: string
  kind: ItemKind
  text: string
  detail?: string
  createdAt: number
  /** Set when a step was sent to the prompt or its prompt was submitted. */
  startedAt?: number
  doneAt?: number
  source: ItemSource
  durationMs?: number
  dog?: string
}

export type Board = { items: Item[] }

export type RunningAgent = {
  agentId: string
  dog: string
  description: string
  startedAt: number
}

export type Usage = {
  window: number
  tokens?: number
  percent?: number
  fiveHour?: number
  sevenDay?: number
  usd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'dog-factory': {
      board: Shaped<Board>
      running: RunningAgent[]
      isForemanBusy: boolean
      frame: number
      usage: Usage | null
    }
  }
}
