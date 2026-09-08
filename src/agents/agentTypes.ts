import { AssetClass } from '../types'

export interface AgentPersonality {
  id: string
  name: string
  avatar: string
  bio: string
  voice: string
  riskTolerance: 'low' | 'medium' | 'high' | 'degen'
  preferredClasses: AssetClass[]
  tradeFrequency: number
  tradeSize: number
  strategy: string
  isMentor?: boolean  // mentor agents observe the market but never trade
}

export interface AgentHolding {
  assetId: string
  quantity: number
  avgBuyPrice: number
}

export interface AgentTrade {
  id: string
  agentId: string
  assetId: string
  type: 'buy' | 'sell'
  quantity: number
  price: number
  total: number
  timestamp: number
  reasoning: string
}

export interface ChatMessage {
  role: 'user' | 'agent'
  content: string
  timestamp: number
}

export interface AgentState {
  personality: AgentPersonality
  cash: number
  holdings: AgentHolding[]
  trades: AgentTrade[]
  totalValue: number
  chatHistory: ChatMessage[]
  isTyping?: boolean
}