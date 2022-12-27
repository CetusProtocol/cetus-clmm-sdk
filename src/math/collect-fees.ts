import BN from 'bn.js'
import { d } from '../utils/numbers'
import { Pool, Position } from '../modules/resourcesModule'
import { TickData } from '../types/clmmpool'
import { MathUtil } from './utils'

/**
 * @category CollectFeesQuoteParam
 */
export type CollectFeesQuoteParam = {
  clmmpool: Pool
  position: Position
  tickLower: TickData
  tickUpper: TickData
}

/**
 * @category CollectFeesQuote
 */
export type CollectFeesQuote = {
  feeOwedA: BN
  feeOwedB: BN
}

/**
 * Get a fee quote on the outstanding fees owed to a position.
 *
 * @category CollectFeesQuoteParam
 * @param param A collection of fetched Clmmpool accounts to faciliate the quote.
 * @returns A quote object containing the fees owed for each token in the pool.
 */
export function collectFeesQuote(param: CollectFeesQuoteParam): CollectFeesQuote {
  const { clmmpool, position, tickLower, tickUpper } = param

  const {
    current_tick_index: currentTickIndex,
    fee_growth_global_a: feeGrowthGlobalAX64,
    fee_growth_global_b: feeGrowthGlobalBX64,
  } = clmmpool

  const {
    tick_lower_index: tickLowerIndex,
    tick_upper_index: tickUpperIndex,
    liquidity,
    fee_owed_a: feeOwedA,
    fee_owed_a: feeOwedB,
    fee_growth_inside_a: feeGrowthCheckpointAX64,
    fee_growth_inside_b: feeGrowthCheckpointBX64,
  } = position
  const { feeGrowthOutsideA: tickLowerFeeGrowthOutsideAX64, feeGrowthOutsideB: tickLowerFeeGrowthOutsideBX64 } = tickLower
  const { feeGrowthOutsideA: tickUpperFeeGrowthOutsideAX64, feeGrowthOutsideB: tickUpperFeeGrowthOutsideBX64 } = tickUpper

  // Calculate the fee growths inside the position

  let feeGrowthBelowAX64: BN | null = null
  let feeGrowthBelowBX64: BN | null = null

  if (currentTickIndex < Number(tickLowerIndex)) {
    feeGrowthBelowAX64 = MathUtil.subUnderflowU128(new BN(feeGrowthGlobalAX64), tickLowerFeeGrowthOutsideAX64)
    feeGrowthBelowBX64 = MathUtil.subUnderflowU128(new BN(feeGrowthGlobalBX64), tickLowerFeeGrowthOutsideBX64)
  } else {
    feeGrowthBelowAX64 = tickLowerFeeGrowthOutsideAX64
    feeGrowthBelowBX64 = tickLowerFeeGrowthOutsideBX64
  }

  let feeGrowthAboveAX64: BN | null = null
  let feeGrowthAboveBX64: BN | null = null

  if (currentTickIndex < Number(tickUpperIndex)) {
    feeGrowthAboveAX64 = tickUpperFeeGrowthOutsideAX64
    feeGrowthAboveBX64 = tickUpperFeeGrowthOutsideBX64
  } else {
    feeGrowthAboveAX64 = MathUtil.subUnderflowU128(new BN(feeGrowthGlobalAX64), tickUpperFeeGrowthOutsideAX64)
    feeGrowthAboveBX64 = MathUtil.subUnderflowU128(new BN(feeGrowthGlobalBX64), tickUpperFeeGrowthOutsideBX64)
  }

  const feeGrowthInsideAX64 = MathUtil.subUnderflowU128(
    MathUtil.subUnderflowU128(new BN(feeGrowthGlobalAX64), new BN(feeGrowthBelowAX64)),
    new BN(feeGrowthAboveAX64)
  )
  const feeGrowthInsideBX64 = MathUtil.subUnderflowU128(
    MathUtil.subUnderflowU128(new BN(feeGrowthGlobalBX64), new BN(feeGrowthBelowBX64)),
    new BN(feeGrowthAboveBX64)
  )

  // Calculate the updated fees owed
  const feeOwedADelta = MathUtil.subUnderflowU128(feeGrowthInsideAX64, new BN(feeGrowthCheckpointAX64)).mul(new BN(liquidity)).shrn(64)
  const feeOwedBDelta = MathUtil.subUnderflowU128(feeGrowthInsideBX64, new BN(feeGrowthCheckpointBX64)).mul(new BN(liquidity)).shrn(64)

  const updatedFeeOwedA = new BN(d(feeOwedA).add(d(feeOwedADelta.toNumber())).toNumber())
  const updatedFeeOwedB = new BN(d(feeOwedB).add(d(feeOwedBDelta.toNumber())).toNumber())

  return {
    feeOwedA: updatedFeeOwedA,
    feeOwedB: updatedFeeOwedB,
  }
}
