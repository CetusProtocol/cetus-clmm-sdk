import { TxnBuilderTypes, BCS } from 'aptos'
import BN from 'bn.js'
import { TickData, ClmmpoolData } from '../types/clmmpool'
import {
  TxPayloadCallFunction,
  AptosResourceType,
  AptosCoinInfoResource,
  AptosPoolResource,
  AptosResource,
  CoinInfoAddress,
  CLMMRouterModule,
} from '../types/aptos'
import { SDK } from '../sdk'
import { IModule } from '../interfaces/IModule'
import { composeType, extractAddressFromType } from '../utils/contracts'
import { BigNumber } from '../types'
import { CachedContent } from '../utils/cachedContent'
import { d } from '../utils/numbers'
import { SwapUtils } from '../math/swap'
import { computeSwap } from '../math/clmm'
import { TickMath } from '../math/tick'
import { Pool } from './resourcesModule'

export const AMM_SWAP_MODULE = 'amm_swap'
export const POOL_STRUCT = 'Pool'

export type createTestTransferTxPayloadParams = {
  account: string
  value: number
}

export type CalculateRatesParams = {
  decimalsA: number
  decimalsB: number
  a2b: boolean
  byAmountIn: boolean
  amount: BN
  swapTicks: Array<TickData>
  currentPool: Pool
}

export type CalculateRatesResult = {
  estimatedAmountIn: BN
  estimatedAmountOut: BN
  estimatedEndSqrtPrice: BN
  estimatedFeeAmount: BN
  isExceed: boolean
  extraComputeLimit: number
  aToB: boolean
  byAmountIn: boolean
  amount: BN
  priceImpactPct: number
}

export type CalculatePriceImpactParams = {
  fromToken: AptosResourceType
  toToken: AptosResourceType
  fromAmount: BigNumber
  toAmount: BigNumber
  interactiveToken: 'from' | 'to'
}

export type CreateTXPayloadParams = {
  pool_addr: string
  coinTypeA: AptosResourceType
  coinTypeB: AptosResourceType
  a_to_b: boolean
  by_amount_in: boolean
  amount: string
  amount_limit: string
  partner: string
}

const cacheTime5min = 5 * 60 * 1000
function getFutureTime(interval: number) {
  return Date.parse(new Date().toString()) + interval
}

export class SwapModule implements IModule {
  protected _sdk: SDK

  private readonly _cache: Record<string, CachedContent> = {}

  constructor(sdk: SDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  private async fetchAccountResource<T>(
    accountAddress: AptosResourceType,
    resourceType: AptosResourceType,
    overdueTime = 0
  ): Promise<AptosResource<T> | null> {
    let cacheData = this._cache[accountAddress + resourceType]
    if (cacheData?.getCacheData()) {
      return cacheData.value as AptosResource<T>
    }

    const data = await this.sdk.Resources.fetchAccountResource<T>(accountAddress, resourceType)
    cacheData = new CachedContent(data, overdueTime)
    this._cache[accountAddress + resourceType] = cacheData
    return data
  }

  /* eslint-disable class-methods-use-this */
  calculateRates(params: CalculateRatesParams): CalculateRatesResult {
    const { currentPool } = params
    const poolData: ClmmpoolData = {
      coinA: currentPool.coinTypeA, // string
      coinB: currentPool.coinTypeB, // string
      currentSqrtPrice: new BN(currentPool.current_sqrt_price), // BN
      currentTickIndex: currentPool.current_tick_index, // number
      feeGrowthGlobalA: new BN(currentPool.fee_growth_global_a), // BN
      feeGrowthGlobalB: new BN(currentPool.fee_growth_global_b), // BN
      feeProtocolCoinA: new BN(currentPool.fee_protocol_coin_a), // BN
      feeProtocolCoinB: new BN(currentPool.fee_protocol_coin_b), // BN
      feeRate: currentPool.fee_rate, // number
      liquidity: new BN(currentPool.liquidity), // BN
      tickIndexes: [], // number[]
      tickSpacing: Number(currentPool.tickSpacing), // number
      ticks: [], // Array<TickData>
      collection_name: currentPool.collectionName,
    }

    let ticks
    if (params.a2b) {
      ticks = params.swapTicks.sort((a, b) => {
        return b.index - a.index
      })
    } else {
      ticks = params.swapTicks.sort((a, b) => {
        return a.index - b.index
      })
    }

    const swapResult = computeSwap(params.a2b, params.byAmountIn, params.amount, poolData, ticks)

    let isExceed = false
    if (params.byAmountIn) {
      isExceed = swapResult.amountIn.lt(params.amount)
    } else {
      isExceed = swapResult.amountOut.lt(params.amount)
    }
    const sqrtPriceLimit = SwapUtils.getDefaultSqrtPriceLimit(params.a2b)
    if (params.a2b && swapResult.nextSqrtPrice.lt(sqrtPriceLimit)) {
      isExceed = true
    }

    if (!params.a2b && swapResult.nextSqrtPrice.gt(sqrtPriceLimit)) {
      isExceed = true
    }

    let extraComputeLimit = 0
    if (swapResult.crossTickNum > 6 && swapResult.crossTickNum < 40) {
      extraComputeLimit = 22000 * (swapResult.crossTickNum - 6)
    }

    if (swapResult.crossTickNum > 40) {
      isExceed = true
    }

    const prePrice = TickMath.sqrtPriceX64ToPrice(poolData.currentSqrtPrice, params.decimalsA, params.decimalsB).toNumber()
    const afterPrice = TickMath.sqrtPriceX64ToPrice(swapResult.nextSqrtPrice, params.decimalsA, params.decimalsB).toNumber()

    const priceImpactPct = (Math.abs(prePrice - afterPrice) / prePrice) * 100

    return {
      estimatedAmountIn: swapResult.amountIn,
      estimatedAmountOut: swapResult.amountOut,
      estimatedEndSqrtPrice: swapResult.nextSqrtPrice,
      estimatedFeeAmount: swapResult.feeAmount,
      isExceed,
      extraComputeLimit,
      amount: params.amount,
      aToB: params.a2b,
      byAmountIn: params.byAmountIn,
      priceImpactPct,
    }
  }

  createSwapTransactionPayload(
    params: CreateTXPayloadParams,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction {
    const { modules } = this.sdk.sdkOptions.networkOptions
    const moduleName = `${modules.LiquidswapDeployer}::${CLMMRouterModule}`
    const funcName = 'swap'
    const sqrtPriceLimit = SwapUtils.getDefaultSqrtPriceLimit(params.a_to_b)
    if (bcsPackage) {
      const typeArguments = [
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeA)),
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeB)),
      ]
      const args = [
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.pool_addr)),
        BCS.bcsSerializeBool(params.a_to_b),
        BCS.bcsSerializeBool(params.by_amount_in),
        BCS.bcsSerializeUint64(BigInt(params.amount)),
        BCS.bcsSerializeUint64(BigInt(params.amount_limit)),
        BCS.bcsSerializeU128(BigInt(sqrtPriceLimit.toString())),
        BCS.bcsSerializeStr(params.partner),
      ]

      return new TxnBuilderTypes.TransactionPayloadEntryFunction(
        TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
      )
    }
    const args = [
      params.pool_addr,
      params.a_to_b,
      params.by_amount_in,
      params.amount,
      params.amount_limit,
      sqrtPriceLimit.toString(),
      params.partner,
    ]

    const typeArguments = [params.coinTypeA, params.coinTypeB]
    return {
      type: 'entry_function_payload',
      function: composeType(moduleName, funcName),
      type_arguments: typeArguments,
      arguments: args,
    }
  }
}
