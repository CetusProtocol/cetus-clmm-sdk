import BN from 'bn.js'

import { SwapDirection } from '../types/liquidity'
import { MathUtil } from './utils'
import type { Percentage } from './percentage'
import { getLowerSqrtPriceFromCoinA, getLowerSqrtPriceFromCoinB, getUpperSqrtPriceFromCoinA, getUpperSqrtPriceFromCoinB } from './swap'
import { CoinAmounts } from './clmm'

export enum AmountSpecified {
  Input = 'Specified input amount',
  Output = 'Specified output amount',
}

export enum PositionStatus {
  BelowRange,
  InRange,
  AboveRange,
}

/**
 * @category Position Util
 */
export class PositionUtil {
  static getPositionStatus(currentTickIndex: number, lowerTickIndex: number, upperTickIndex: number): PositionStatus {
    if (currentTickIndex < lowerTickIndex) {
      return PositionStatus.BelowRange
    }
    if (currentTickIndex < upperTickIndex) {
      return PositionStatus.InRange
    }
    return PositionStatus.AboveRange
  }
}

/**
 * Adjust the amount of token A or token B to swap for in a swap to account for slippage.
 *
 * @param n - The amount of token A or token B to swap for.
 * @param numerator - The numerator of the slippage percentage.
 * @param denominator - The denominator of the slippage percentage.
 * @param adjustUp - Adjust the amount up or down.
 * @returns The adjusted amount of token A or token B to swap for.
 */
export function adjustForSlippage(n: BN, { numerator, denominator }: Percentage, adjustUp: boolean): BN {
  if (adjustUp) {
    return n.mul(denominator.add(numerator)).div(denominator)
  }
  return n.mul(denominator).div(denominator.add(numerator))
}

export function adjustForCoinSlippage(tokenAmount: CoinAmounts, slippage: Percentage, adjustUp: boolean) {
  return {
    tokenMaxA: adjustForSlippage(tokenAmount.coinA, slippage, adjustUp),
    tokenMaxB: adjustForSlippage(tokenAmount.coinB, slippage, adjustUp),
  }
}

/**
 * Adjust the amount of token A or token B to swap for in a swap to account for slippage.
 *
 * @param amountIn - The amount of token A or token B to swap for.
 * @param amountOut - The amount of token A or token B to swap to.
 * @param numerator - The numerator of the slippage percentage.
 * @param denominator - The denominator of the slippage percentage.
 * @param amountSpecified - The amount specified in the swap.
 * @returns The adjusted amount of token A or token B to swap for.
 */
export function adjustAmountForSlippage(
  amountIn: BN,
  amountOut: BN,
  { numerator, denominator }: Percentage,
  amountSpecified: AmountSpecified
): BN {
  if (amountSpecified === AmountSpecified.Input) {
    return amountOut.mul(denominator).div(denominator.add(numerator))
  }
  return amountIn.mul(denominator.add(numerator)).div(denominator)
}

/**
 * Order sqrt price.
 * @param liquidity - liqudity.
 * @param sqrtPrice0X64 - Current sqrt price of coin 0.
 * @param sqrtPrice1X64 - Current sqrt price of coin 1.
 *
 * @returns
 */
function orderSqrtPrice(sqrtPrice0X64: BN, sqrtPrice1X64: BN): [BN, BN] {
  if (sqrtPrice0X64.lt(sqrtPrice1X64)) {
    return [sqrtPrice0X64, sqrtPrice1X64]
  }
  return [sqrtPrice1X64, sqrtPrice0X64]
}

/**
 * Get token A from liquidity.
 * @param liquidity - liquidity.
 * @param sqrtPrice0X64 - Current sqrt price of coin 0.
 * @param sqrtPrice1X64 - Current sqrt price of coin 1.
 * @param roundUp - If round up.
 *
 * @returns
 */
export function getCoinAFromLiquidity(liquidity: BN, sqrtPrice0X64: BN, sqrtPrice1X64: BN, roundUp: boolean) {
  const [sqrtPriceLowerX64, sqrtPriceUpperX64] = orderSqrtPrice(sqrtPrice0X64, sqrtPrice1X64)

  const numerator = liquidity.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64)).shln(64)
  const denominator = sqrtPriceUpperX64.mul(sqrtPriceLowerX64)
  if (roundUp) {
    return MathUtil.divRoundUp(numerator, denominator)
  }
  return numerator.div(denominator)
}

/**
 * Get token B from liquidity.
 * @param liquidity - liqudity.
 * @param sqrtPrice0X64 - Current sqrt price of token 0.
 * @param sqrtPrice1X64 - Current sqrt price of token 1.
 * @param roundUp - If round up.
 *
 * @returns
 */
export function getCoinBFromLiquidity(liquidity: BN, sqrtPrice0X64: BN, sqrtPrice1X64: BN, roundUp: boolean) {
  const [sqrtPriceLowerX64, sqrtPriceUpperX64] = orderSqrtPrice(sqrtPrice0X64, sqrtPrice1X64)

  const result = liquidity.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
  if (roundUp) {
    return MathUtil.shiftRightRoundUp(result)
  }
  return result.shrn(64)
}

/**
 * Get liquidity from token A.
 *
 * @param amount - The amount of token A.
 * @param sqrtPriceLowerX64 - The lower sqrt price.
 * @param sqrtPriceUpperX64 - The upper sqrt price.
 * @param roundUp - If round up.
 * @returns liquidity.
 */
export function getLiquidityFromCoinA(amount: BN, sqrtPriceLowerX64: BN, sqrtPriceUpperX64: BN, roundUp: boolean) {
  const result = amount.mul(sqrtPriceLowerX64).mul(sqrtPriceUpperX64).div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
  if (roundUp) {
    return MathUtil.shiftRightRoundUp(result)
  }
  return result.shrn(64)
}

/**
 * Get liquidity from token B.
 * @param amount - The amount of token B.
 * @param sqrtPriceLowerX64 - The lower sqrt price.
 * @param sqrtPriceUpperX64 - The upper sqrt price.
 * @param roundUp - If round up.
 *
 * @returns liquidity.
 */
export function getLiquidityFromCoinB(amount: BN, sqrtPriceLowerX64: BN, sqrtPriceUpperX64: BN, roundUp: boolean) {
  const numerator = amount.shln(64)
  const denominator = sqrtPriceUpperX64.sub(sqrtPriceLowerX64)
  if (roundUp) {
    return MathUtil.divRoundUp(numerator, denominator)
  }
  return numerator.div(denominator)
}

/**
 * Get amount of fixed delta.
 * @param currentSqrtPriceX64 - Current sqrt price.
 * @param targetSqrtPriceX64 - Target sqrt price.
 * @param liquidity - liqudity.
 * @param amountSpecified - The amount specified in the swap.
 * @param swapDirection - The swap direction.
 *
 * @returns
 */
export function getAmountFixedDelta(
  currentSqrtPriceX64: BN,
  targetSqrtPriceX64: BN,
  liquidity: BN,
  amountSpecified: AmountSpecified,
  swapDirection: SwapDirection
) {
  if ((amountSpecified === AmountSpecified.Input) === (swapDirection === SwapDirection.AtoB)) {
    return getCoinAFromLiquidity(liquidity, currentSqrtPriceX64, targetSqrtPriceX64, amountSpecified === AmountSpecified.Input)
  }
  return getCoinBFromLiquidity(liquidity, currentSqrtPriceX64, targetSqrtPriceX64, amountSpecified === AmountSpecified.Input)
}

/**
 * Get amount of unfixed delta.
 * @param currentSqrtPriceX64 - Current sqrt price.
 * @param targetSqrtPriceX64 - Target sqrt price.
 * @param liquidity - liqudity.
 * @param amountSpecified - The amount specified in the swap.
 * @param swapDirection - The swap direction.
 *
 * @returns
 */
export function getAmountUnfixedDelta(
  currentSqrtPriceX64: BN,
  targetSqrtPriceX64: BN,
  liquidity: BN,
  amountSpecified: AmountSpecified,
  swapDirection: SwapDirection
) {
  if ((amountSpecified === AmountSpecified.Input) === (swapDirection === SwapDirection.AtoB)) {
    return getCoinBFromLiquidity(liquidity, currentSqrtPriceX64, targetSqrtPriceX64, amountSpecified === AmountSpecified.Output)
  }
  return getCoinAFromLiquidity(liquidity, currentSqrtPriceX64, targetSqrtPriceX64, amountSpecified === AmountSpecified.Output)
}

/**
 * Get next sqrt price from swap.
 * @param sqrtPriceX64 - Current sqrt price.
 * @param liquidity - liquidity.
 * @param amount - Token amount.
 * @param amountSpecified - The amount specified in the swap.
 * @param swapDirection - The swap direction.
 *
 * @returns
 */
export function getNextSqrtPrice(
  sqrtPriceX64: BN,
  liquidity: BN,
  amount: BN,
  amountSpecified: AmountSpecified,
  swapDirection: SwapDirection
) {
  if (amountSpecified === AmountSpecified.Input && swapDirection === SwapDirection.AtoB) {
    return getLowerSqrtPriceFromCoinA(amount, liquidity, sqrtPriceX64)
  }
  if (amountSpecified === AmountSpecified.Output && swapDirection === SwapDirection.BtoA) {
    return getUpperSqrtPriceFromCoinA(amount, liquidity, sqrtPriceX64)
  }
  if (amountSpecified === AmountSpecified.Input && swapDirection === SwapDirection.BtoA) {
    return getUpperSqrtPriceFromCoinB(amount, liquidity, sqrtPriceX64)
  }
  return getLowerSqrtPriceFromCoinB(amount, liquidity, sqrtPriceX64)
}
