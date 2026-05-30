import { Asset } from './types'

export const ASSETS: Asset[] = [
  // ── Crypto ──────────────────────────────────────────────────────────────
  { id: 'btc',  symbol: 'NEXCOIN', name: 'NexCoin',      class: 'crypto', price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'bitcoin' },
  { id: 'eth',  symbol: 'ETHERX',  name: 'EtherX',       class: 'crypto', price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'ethereum' },
  { id: 'bnb',  symbol: 'CHAINX',  name: 'ChainX',       class: 'crypto', price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'binancecoin' },
  { id: 'sol',  symbol: 'SOLUX',   name: 'Solux',        class: 'crypto', price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'solana' },
  { id: 'xrp',  symbol: 'RIPEX',   name: 'RipeX',        class: 'crypto', price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'ripple' },
  { id: 'ada',  symbol: 'CARDAX',  name: 'CardaX',       class: 'crypto', price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'cardano' },
  { id: 'doge', symbol: 'DOGEX',   name: 'DogeX',        class: 'crypto', price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'dogecoin' },
  { id: 'avax', symbol: 'AVAXON',  name: 'Avaxon',       class: 'crypto', price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'avalanche-2' },
  { id: 'link', symbol: 'LINKEX',  name: 'LinkEx',       class: 'crypto', price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'chainlink' },
  // ── Stocks ──────────────────────────────────────────────────────────────
  { id: 'aapl', symbol: 'APLEX',   name: 'Aplex Corp',   class: 'stock',  price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'AAPL' },
  { id: 'msft', symbol: 'NEXOFT',  name: 'Nexoft Inc',   class: 'stock',  price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'MSFT' },
  { id: 'nvda', symbol: 'NVIDEX',  name: 'NVidEx',       class: 'stock',  price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'NVDA' },
  { id: 'tsla', symbol: 'VOLTEX',  name: 'VoltEx Motors',class: 'stock',  price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'TSLA' },
  { id: 'amzn', symbol: 'AMAXCO',  name: 'AmaxCo',       class: 'stock',  price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'AMZN' },
  { id: 'goog', symbol: 'ALPHEX',  name: 'AlpheX',       class: 'stock',  price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'GOOGL' },
  { id: 'meta', symbol: 'METAVX',  name: 'MetaVX',       class: 'stock',  price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'META' },
  { id: 'nflx', symbol: 'NETFLUX', name: 'Netflux',      class: 'stock',  price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'NFLX' },
  { id: 'jpm',  symbol: 'JPMORX',  name: 'JPMorX',       class: 'stock',  price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'JPM' },
  // ── ETFs ────────────────────────────────────────────────────────────────
  { id: 'spy',  symbol: 'MKTVAULT',name: 'MktVault 500', class: 'etf',    price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'SPY' },
  { id: 'qqq',  symbol: 'TECHFUND', name: 'TechFund Index',class: 'etf',  price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'QQQ' },
  { id: 'gld',  symbol: 'GOLDFUND', name: 'GoldFund',    class: 'etf',    price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'GLD' },
  { id: 'uso',  symbol: 'OILFUND',  name: 'OilFund',     class: 'etf',    price: 0, change24h: 0, changePct: 0, volume: '—', marketCap: '—', realSymbol: 'USO' },
  // ── Bonds ───────────────────────────────────────────────────────────────
  { id: 'us10y', symbol: 'USGOV10', name: 'US Sovereign 10Y', class: 'bond', price: 98.5,  change24h: 0.1,  changePct: 0.1,  volume: '—', marketCap: '—' },
  { id: 'us2y',  symbol: 'USGOV2',  name: 'US Sovereign 2Y',  class: 'bond', price: 99.2,  change24h: 0.05, changePct: 0.05, volume: '—', marketCap: '—' },
  { id: 'us30y', symbol: 'USGOV30', name: 'US Sovereign 30Y', class: 'bond', price: 95.8,  change24h: 0.08, changePct: 0.08, volume: '—', marketCap: '—' },
]

export const CLASS_COLORS: Record<string, string> = {
  crypto: '#7c3aed',
  stock:  '#00ff88',
  bond:   '#f5c842',
  etf:    '#3b82f6',
}

export const CLASS_LABELS: Record<string, string> = {
  crypto: 'Crypto',
  stock:  'Stock',
  bond:   'Bond',
  etf:    'ETF',
}

export const STARTING_BALANCE = 100_000