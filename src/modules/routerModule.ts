import Decimal from 'decimal.js'
import createGraph, { Graph } from 'ngraph.graph'
import ngraph from 'ngraph.path'
import invariant from 'tiny-invariant'
import { SDK } from '../sdk'
import { IModule } from '../interfaces/IModule'

export interface CoinNode {
  address: string
  symbol: string
  decimals: number
}

export interface PriceLink {
  quote: string
  base: string
  price: Decimal
}

export interface PriceProvider {
  prices: PriceLink[]
}

export interface CoinProvider {
  tokens: CoinNode[]
}

function _pairSymbol(
  base: string,
  quote: string
): {
  pair: string
  reversePair: string
} {
  return {
    pair: `${base.toUpperCase()}-${quote.toUpperCase()}`,
    reversePair: `${quote.toUpperCase()}-${base.toUpperCase()}`,
  }
}

export class RouterModule implements IModule {
  readonly priceProviders: PriceProvider[]

  readonly coinProviders: CoinProvider[]

  readonly graph: Graph

  private _rates: Map<string, Decimal>

  private _coinSymbolMapping: Map<string, CoinNode>

  private _coinAddressMapping: Map<string, CoinNode>

  protected _sdk: SDK

  constructor(sdk: SDK) {
    this.priceProviders = []
    this.coinProviders = []
    this.graph = createGraph()
    this._rates = new Map()
    this._coinSymbolMapping = new Map()
    this._coinAddressMapping = new Map()
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  async loadGraph(): Promise<RouterModule> {
    for (const provider of this.coinProviders) {
      const { tokens } = provider
      tokens.forEach((v) => {
        this._coinSymbolMapping.set(v.symbol, v)
        this._coinAddressMapping.set(v.address, v)
      })
    }

    for (const provider of this.priceProviders) {
      const { prices } = provider
      for (const p of prices) {
        const { base, quote } = p
        this.graph.addNode(base)
        this.graph.addNode(quote)
        this.graph.addLink(base, quote, p.price)
        const { pair } = _pairSymbol(base, quote)
        this._rates.set(pair, p.price)
      }
    }

    return this
  }

  addPriceProvider(provider: PriceProvider): RouterModule {
    this.priceProviders.push(provider)
    return this
  }

  addCoinProvider(provider: CoinProvider): RouterModule {
    this.coinProviders.push(provider)
    return this
  }

  tokenInfo(key: string): CoinNode | undefined {
    if (this._coinAddressMapping.has(key)) {
      return this._coinAddressMapping.get(key)
    }
    return this._coinSymbolMapping.get(key)
  }

  price(base: string, quote: string): Decimal | undefined {
    const baseCoin = this.tokenInfo(base)
    const quoteCoin = this.tokenInfo(quote)
    if (baseCoin === undefined || quoteCoin === undefined) {
      return undefined
    }

    return this._price(baseCoin.symbol, quoteCoin.symbol)
  }

  private _price(base: string, quote: string): Decimal | undefined {
    let price = this._directPrice(base, quote)
    if (price === undefined) {
      price = this._pathPrice(base, quote)
    }
    return price
  }

  private _directPrice(base: string, quote: string): Decimal | undefined {
    const { pair, reversePair } = _pairSymbol(base, quote)
    if (this._rates.has(pair)) {
      return this._rates.get(pair)
    }
    if (this._rates.has(reversePair)) {
      const price = this._rates.get(reversePair)
      invariant(price !== undefined)
      return new Decimal(1).div(price)
    }
    return undefined
  }

  private _pathPrice(base: string, quote: string): Decimal | undefined {
    if (!this.graph.hasNode(base) || !this.graph.hasNode(quote)) {
      return undefined
    }
    const path = ngraph.nba(this.graph).find(quote, base)
    if (path.length <= 1) {
      return undefined
    }
    let price = new Decimal(1)
    for (let i = 0; i < path.length - 1; i += 1) {
      const base = path[i]?.id.toString()
      const quote = path[i + 1]?.id.toString()
      invariant(base !== undefined && quote !== undefined, 'base of quote is undefined')
      const tempPrice = this._directPrice(base, quote)
      invariant(tempPrice !== undefined, `[${base}-${quote}] temp price is undefined`)
      price = price.mul(tempPrice)
    }
    return price
  }

  swap(base: string, quote: string, amount: Decimal): Decimal | undefined {
    const baseCoin = this.tokenInfo(base)
    const quoteCoin = this.tokenInfo(quote)
    if (baseCoin === undefined || quoteCoin === undefined) {
      return undefined
    }
    if (baseCoin.symbol === quoteCoin.symbol) {
      return amount
    }

    const price = this.price(baseCoin.symbol, quoteCoin.symbol)
    if (price === undefined) {
      return undefined
    }
    return amount.mul(price)
  }

  lamportsSwap(base: string, quote: string, lamports: Decimal): Decimal | undefined {
    const baseToken = this.tokenInfo(base)
    const quoteToken = this.tokenInfo(quote)
    if (quoteToken === undefined || baseToken === undefined) {
      return undefined
    }

    if (baseToken.symbol === quoteToken.symbol) {
      return lamports
    }

    const input = lamports.div(new Decimal(10).pow(baseToken.decimals))
    return this.swap(baseToken.symbol, quoteToken.symbol, input)?.mul(new Decimal(10).pow(quoteToken.decimals))
  }

  toLamports(token: string, amount: Decimal): Decimal | undefined {
    const tokenInfo = this.tokenInfo(token)
    if (tokenInfo === undefined) {
      return undefined
    }
    return amount.mul(new Decimal(10).pow(tokenInfo.decimals)).toDecimalPlaces(0)
  }

  toAmount(token: string, amount: Decimal): Decimal | undefined {
    const tokenInfo = this.tokenInfo(token)
    if (tokenInfo === undefined) {
      return undefined
    }
    return amount.div(new Decimal(10).pow(tokenInfo.decimals)).toDecimalPlaces(tokenInfo.decimals)
  }
}
