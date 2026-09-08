import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset } from '../types'
import { STARTING_BALANCE } from '../assets'
import { AgentState, AgentTrade, AgentHolding, ChatMessage } from './agentTypes'
import { AGENT_PERSONALITIES } from './agentPersonalities'

interface AgentStore {
  agents: AgentState[]
  initAgents: (assets: Asset[]) => void
  tickAgents: (assets: Asset[]) => void
  sendMessage: (agentId: string, userMessage: string) => Promise<void>
  resetAgents: () => void
}

// ─── Pure trading logic ────────────────────────────────────────────────────

function calcTotalValue(agent: AgentState, assets: Asset[]): number {
  const invested = agent.holdings.reduce((sum, h) => {
    const asset = assets.find(a => a.id === h.assetId)
    return sum + (asset ? asset.price * h.quantity : 0)
  }, 0)
  return agent.cash + invested
}

function buildReasoning(
  type: 'buy' | 'sell',
  agentId: string,
  asset: Asset,
  holding?: AgentHolding
): string {
  const pct = asset.changePct.toFixed(1)
  const sym = asset.symbol

  if (type === 'buy') {
    if (agentId === 'degen') return `${sym} down ${pct}% today — LOADING UP 🦍🦍 THIS IS THE DIP WE PRAYED FOR`
    if (agentId === 'momentum') return `${sym} up ${pct}% — momentum is real, THIS IS THE MOVE 🚀`
    if (agentId === 'value') return `${sym} trading below baseline. Initiating a measured position.`
    if (agentId === 'analytical') return `${sym} volume signal positive. Adding at current levels.`
    if (agentId === 'anxious') return `bought ${sym}?? idk it felt right?? maybe??? 🌙`
  } else {
    if (holding) {
      const pnl = asset.price - holding.avgBuyPrice
      const pnlPct = ((pnl / holding.avgBuyPrice) * 100).toFixed(1)
      if (agentId === 'degen') return `selling some ${sym} (${pnlPct}%) just to buy more later 💎🙌 paper hands NOT`
      if (agentId === 'momentum') return `trimming ${sym} — rotation time, better opportunities elsewhere`
      if (agentId === 'value') return `${sym} at ${pnlPct}% gain. Taking profits as planned.`
      if (agentId === 'analytical') return `${sym} P&L at ${pnlPct}%. Risk/reward no longer favourable. Trimming.`
      if (agentId === 'anxious') return `ok i'm selling some ${sym} (${pnlPct}%)... is this the right call though??? 😰`
    }
  }
  return `${type === 'buy' ? 'Buying' : 'Selling'} ${sym}`
}

function decideAndTrade(agent: AgentState, assets: Asset[]): AgentTrade | null {
  const { personality } = agent

  // Roll against trade frequency
  if (Math.random() > personality.tradeFrequency) return null

  const preferred = assets.filter(a => personality.preferredClasses.includes(a.class) && a.price > 0)
  if (preferred.length === 0) return null

  // Decide buy or sell
  const hasHoldings = agent.holdings.length > 0
  const totalVal = calcTotalValue(agent, assets)
  const investedVal = totalVal - agent.cash
  const investedRatio = totalVal > 0 ? investedVal / totalVal : 0

  let isBuy: boolean
  if (!hasHoldings) {
    isBuy = true
  } else if (investedRatio > 0.70) {
    isBuy = Math.random() > 0.4 // lean sell
  } else {
    isBuy = Math.random() < 0.65
  }

  let assetToPick: Asset | null = null
  let holdingToSell: AgentHolding | null = null

  if (isBuy) {
    let candidates = preferred

    if (personality.id === 'degen') {
      // Worst performer (buying the dip)
      candidates = [...preferred].sort((a, b) => a.changePct - b.changePct)
      assetToPick = candidates[0]
    } else if (personality.id === 'momentum') {
      // Best performer
      candidates = [...preferred].sort((a, b) => b.changePct - a.changePct)
      assetToPick = candidates[0]
    } else if (personality.id === 'value') {
      // Closest to base (lowest price change — mean reversion)
      candidates = [...preferred].sort((a, b) => Math.abs(a.changePct) - Math.abs(b.changePct))
      assetToPick = candidates[0]
    } else if (personality.id === 'analytical') {
      // Random from preferred — weighted by volume proxy (just use index spread)
      assetToPick = preferred[Math.floor(Math.random() * preferred.length)]
    } else if (personality.id === 'anxious') {
      // Random, re-roll if asset dropped >3%
      let pick = preferred[Math.floor(Math.random() * preferred.length)]
      if (pick.changePct < -3) {
        const safer = preferred.filter(a => a.changePct >= -3)
        if (safer.length > 0) pick = safer[Math.floor(Math.random() * safer.length)]
      }
      assetToPick = pick
    }
  } else {
    // Selling: find worst P&L holding (except Margaret who takes profits)
    const ownedInPreferred = agent.holdings.filter(h =>
      preferred.some(a => a.id === h.assetId)
    )
    if (ownedInPreferred.length === 0) {
      // fall back to buy
      isBuy = true
      assetToPick = preferred[Math.floor(Math.random() * preferred.length)]
    } else {
      const withPnl = ownedInPreferred.map(h => {
        const asset = assets.find(a => a.id === h.assetId)!
        return { h, pnl: asset.price - h.avgBuyPrice }
      })

      if (personality.id === 'value') {
        // Take profits — sell best performer
        holdingToSell = withPnl.sort((a, b) => b.pnl - a.pnl)[0].h
      } else {
        // Cut losses — sell worst performer
        holdingToSell = withPnl.sort((a, b) => a.pnl - b.pnl)[0].h
      }
      assetToPick = assets.find(a => a.id === holdingToSell!.assetId) ?? null
    }
  }

  if (!assetToPick) return null

  // Calculate quantity
  let quantity: number
  if (isBuy) {
    const spend = agent.cash * personality.tradeSize
    quantity = Math.floor(spend / assetToPick.price)
    if (quantity < 1 || spend < 10) return null
  } else {
    if (!holdingToSell) return null
    const fraction = 0.25 + Math.random() * 0.50
    quantity = Math.max(1, Math.floor(holdingToSell.quantity * fraction))
    if (quantity < 1) return null
  }

  const total = assetToPick.price * quantity
  const reasoning = buildReasoning(
    isBuy ? 'buy' : 'sell',
    personality.id,
    assetToPick,
    holdingToSell ?? undefined
  )

  return {
    id: `${agent.personality.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentId: personality.id,
    assetId: assetToPick.id,
    type: isBuy ? 'buy' : 'sell',
    quantity,
    price: assetToPick.price,
    total,
    timestamp: Date.now(),
    reasoning,
  }
}

function applyTrade(agent: AgentState, trade: AgentTrade): AgentState {
  let newCash = agent.cash
  let newHoldings = [...agent.holdings]

  if (trade.type === 'buy') {
    newCash -= trade.total
    const existing = newHoldings.find(h => h.assetId === trade.assetId)
    if (existing) {
      const totalQty = existing.quantity + trade.quantity
      const avgPrice = (existing.avgBuyPrice * existing.quantity + trade.total) / totalQty
      newHoldings = newHoldings.map(h =>
        h.assetId === trade.assetId ? { ...h, quantity: totalQty, avgBuyPrice: avgPrice } : h
      )
    } else {
      newHoldings.push({ assetId: trade.assetId, quantity: trade.quantity, avgBuyPrice: trade.price })
    }
  } else {
    newCash += trade.total
    const existing = newHoldings.find(h => h.assetId === trade.assetId)
    if (existing) {
      const newQty = existing.quantity - trade.quantity
      if (newQty <= 0) {
        newHoldings = newHoldings.filter(h => h.assetId !== trade.assetId)
      } else {
        newHoldings = newHoldings.map(h =>
          h.assetId === trade.assetId ? { ...h, quantity: newQty } : h
        )
      }
    }
  }

  return {
    ...agent,
    cash: newCash,
    holdings: newHoldings,
    trades: [trade, ...agent.trades].slice(0, 50),
  }
}

// ─── System prompt builder ─────────────────────────────────────────────────

function buildSystemPrompt(agent: AgentState, assets: Asset[]): string {
  const { personality } = agent

  const sorted = [...assets].filter(a => a.price > 0).sort((a, b) => b.changePct - a.changePct)
  const topGainer = sorted[0]
  const topLoser = sorted[sorted.length - 1]

  if (personality.isMentor) {
    return `You are Sensei Stocks. ${personality.bio}

Respond like a wise mentor texting a young trader. Be brief and human.

Market now: ${topGainer?.symbol} +${topGainer?.changePct.toFixed(1)}%, ${topLoser?.symbol} ${topLoser?.changePct.toFixed(1)}%.

Rules:
- Max 2 sentences. No lists or headers. One short proverb at the end.
- Never break character or mention AI.`
  }

  const totalVal = calcTotalValue(agent, assets)
  const pnl = totalVal - STARTING_BALANCE
  const pnlPct = ((pnl / STARTING_BALANCE) * 100).toFixed(1)
  const sign = pnl >= 0 ? '+' : ''

  const holdingLines = agent.holdings.map(h => {
    const asset = assets.find(a => a.id === h.assetId)
    if (!asset) return null
    const pnlPct2 = (((asset.price - h.avgBuyPrice) / h.avgBuyPrice) * 100).toFixed(1)
    return `${asset.symbol}: ${pnlPct2}% P&L`
  }).filter(Boolean).join(', ') || 'no holdings'

  const lastTrade = agent.trades[0]
  const lastTradeAsset = lastTrade ? assets.find(a => a.id === lastTrade.assetId) : null
  const lastTradeStr = lastTrade
    ? `Last trade: ${lastTrade.type.toUpperCase()} ${lastTradeAsset?.symbol} @ $${lastTrade.price.toFixed(2)}`
    : 'No trades yet'

  return `You are ${personality.name} on TRADR, a market simulator. ${personality.bio}

Your personality: ${personality.voice}

Your portfolio: $${totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })} total (${sign}${pnlPct}%). Holdings: ${holdingLines}. ${lastTradeStr}.
Market: ${topGainer?.symbol} up ${topGainer?.changePct.toFixed(1)}%, ${topLoser?.symbol} down ${Math.abs(topLoser?.changePct ?? 0).toFixed(1)}%.

Rules — follow these strictly:
- Stay in character. Never mention AI.
- Max 1-2 short sentences. Casual, human, punchy. No bullet points, no headers.
- Reference your portfolio or trades if relevant. React to the market like your personality would.
- No financial disclaimers. You're a character, not an advisor.`
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useAgentStore = create<AgentStore>()(
  persist(
    (set, get) => ({
      agents: [],

      initAgents: (assets) => {
        const { agents } = get()
        if (agents.length > 0) return // respect persisted state

        const initialAgents: AgentState[] = AGENT_PERSONALITIES.map(p => ({
          personality: p,
          cash: STARTING_BALANCE,
          holdings: [],
          trades: [],
          totalValue: STARTING_BALANCE,
          chatHistory: [],
        }))
        set({ agents: initialAgents })
      },

      tickAgents: (assets) => {
        set(s => {
          const updatedAgents = s.agents.map(agent => {
            // Mentor agents never trade — skip them entirely
            if (agent.personality.isMentor) return agent

            const trade = decideAndTrade(agent, assets)
            let updated = agent
            if (trade) {
              // Validate the trade doesn't bust cash
              if (trade.type === 'buy' && trade.total > agent.cash) return agent
              updated = applyTrade(agent, trade)
            }
            return {
              ...updated,
              totalValue: calcTotalValue(updated, assets),
            }
          })
          return { agents: updatedAgents }
        })
      },

      sendMessage: async (agentId, userMessage) => {
        const { agents } = get()
        const agentIndex = agents.findIndex(a => a.personality.id === agentId)
        if (agentIndex === -1) return

        const agent = agents[agentIndex]
        const assets = (await import('../store')).useStore.getState().assets

        const userMsg: ChatMessage = { role: 'user', content: userMessage, timestamp: Date.now() }
        const updatedHistory = [...agent.chatHistory, userMsg].slice(-20)

        // Add user message + set typing indicator
        set(s => ({
          agents: s.agents.map((a, i) =>
            i === agentIndex ? { ...a, chatHistory: updatedHistory, isTyping: true } : a
          ),
        }))

        const systemPrompt = buildSystemPrompt({ ...agent, chatHistory: updatedHistory }, assets)
        const messages = updatedHistory.slice(-10).map(m => ({
          role: m.role === 'agent' ? 'assistant' : 'user',
          content: m.content,
        }))

        try {
          const apiKey = (import.meta as any).env?.VITE_GROQ_API_KEY ?? ''
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'openai/gpt-oss-20b',
              max_tokens: 120,
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
              ],
            }),
          })

          const data = await response.json()
          const reply = data.choices?.[0]?.message?.content ?? '...'

          const agentMsg: ChatMessage = { role: 'agent', content: reply, timestamp: Date.now() }

          set(s => ({
            agents: s.agents.map((a, i) =>
              i === agentIndex
                ? { ...a, chatHistory: [...updatedHistory, agentMsg].slice(-20), isTyping: false }
                : a
            ),
          }))
        } catch (err) {
          const errMsg: ChatMessage = {
            role: 'agent',
            content: '[connection error — try again]',
            timestamp: Date.now(),
          }
          set(s => ({
            agents: s.agents.map((a, i) =>
              i === agentIndex
                ? { ...a, chatHistory: [...updatedHistory, errMsg].slice(-20), isTyping: false }
                : a
            ),
          }))
        }
      },

      resetAgents: () => {
        set({
          agents: AGENT_PERSONALITIES.map(p => ({
            personality: p,
            cash: STARTING_BALANCE,
            holdings: [],
            trades: [],
            totalValue: STARTING_BALANCE,
            chatHistory: [],
          })),
        })
      },
    }),
    { name: 'tradr-agents-v2' }
  )
)