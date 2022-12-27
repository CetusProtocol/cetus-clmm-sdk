/* eslint-disable import/no-unresolved */
import { TxnBuilderTypes, BCS } from 'aptos'
import invariant from 'tiny-invariant'
import BN from 'bn.js'
import { AptosResourceType, CLMMRouterModule, TxPayloadCallFunction } from '../types/aptos'
import { SDK } from '../sdk'
import { IModule } from '../interfaces/IModule'
import { composeType } from '../utils/contracts'

export type AddLiquidityFixTokenParams = {
  amount_a: number | string
  amount_b: number | string
  fix_amount_a: boolean
} & AddLiquidityCommonParams

export type AddLiquidityParams = {
  delta_liquidity: BN
  max_amount_a: number | string
  max_amount_b: number | string
} & AddLiquidityCommonParams

export type AddLiquidityCommonParams = {
  pool: string
  coinTypeA: AptosResourceType
  coinTypeB: AptosResourceType
  tick_lower: number
  tick_upper: number
  is_open: boolean // control whether or not to create a new position or add liquidity on existed position.
  index: number // index: position index. if `is_open` is true, index is no use.
}

export type RemoveLiquidityParams = {
  pool: string
  coinTypeA: AptosResourceType
  coinTypeB: AptosResourceType
  delta_liquidity: BN
  min_amount_a: number
  min_amount_b: number
  pos_index: number
  is_close: boolean
}
export type ClosePositionParams = {
  pool_address: string
  coinTypeA: AptosResourceType
  coinTypeB: AptosResourceType
  pos_index: number
}
export type CollectFeeParams = {
  pool: string
  coinTypeA: AptosResourceType
  coinTypeB: AptosResourceType
  pos_index: number
}

export class PositionModule implements IModule {
  protected _sdk: SDK

  constructor(sdk: SDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  /// Create add liquidity transaction payload.
  createAddLiquidityTransactionPayload(
    params: AddLiquidityParams | AddLiquidityFixTokenParams,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction {
    const { modules } = this.sdk.sdkOptions.networkOptions

    const isFixToken = !('delta_liquidity' in params)

    const moduleName = `${modules.LiquidswapDeployer}::${CLMMRouterModule}`
    const funcName = isFixToken ? 'add_liquidity_fix_token' : 'add_liquidity'

    if (bcsPackage) {
      const typeArguments = [
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeA)),
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeB)),
      ]

      const args = isFixToken
        ? [
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.pool)),
            BCS.bcsSerializeUint64(Number(params.amount_a)),
            BCS.bcsSerializeUint64(Number(params.amount_b)),
            BCS.bcsSerializeBool(params.fix_amount_a),
            BCS.bcsSerializeUint64(BigInt.asUintN(64, BigInt(params.tick_lower))),
            BCS.bcsSerializeUint64(BigInt.asUintN(64, BigInt(params.tick_upper))),
            BCS.bcsSerializeBool(params.is_open),
            BCS.bcsSerializeUint64(params.index),
          ]
        : [
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.pool)),
            BCS.bcsSerializeU128(params.delta_liquidity.toNumber()),
            BCS.bcsSerializeUint64(Number(params.max_amount_a)),
            BCS.bcsSerializeUint64(Number(params.max_amount_b)),
            BCS.bcsSerializeUint64(BigInt.asUintN(64, BigInt(params.tick_lower))),
            BCS.bcsSerializeUint64(BigInt.asUintN(64, BigInt(params.tick_upper))),
            BCS.bcsSerializeBool(params.is_open),
            BCS.bcsSerializeUint64(params.index),
          ]

      return new TxnBuilderTypes.TransactionPayloadEntryFunction(
        TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
      )
    }

    const tickLower = BigInt.asUintN(64, BigInt(params.tick_lower)).toString()
    const tickUpper = BigInt.asUintN(64, BigInt(params.tick_upper)).toString()
    const args = isFixToken
      ? [params.pool, params.amount_a, params.amount_b, params.fix_amount_a, tickLower, tickUpper, params.is_open, params.index]
      : [
          params.pool,
          params.delta_liquidity.toString(),
          String(params.max_amount_a),
          String(params.max_amount_b),
          tickLower,
          tickUpper,
          params.is_open,
          params.index,
        ]
    const typeArguments = [params.coinTypeA, params.coinTypeB]
    return {
      type: 'entry_function_payload',
      function: composeType(moduleName, funcName),
      type_arguments: typeArguments,
      arguments: args,
    }
  }

  /// Create  remove_liquidity transaction payload.
  removeLiquidityTransactionPayload(
    params: RemoveLiquidityParams,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction {
    invariant(params.delta_liquidity.gtn(0), 'ZERO_LIQUIDITY')

    // slippage-adjusted underlying amounts
    // const { amount0: amount0Min, amount1: amount1Min } = partialPosition.burnAmountsWithSlippage(params.slippage)

    const { modules } = this.sdk.sdkOptions.networkOptions
    const moduleName = `${modules.LiquidswapDeployer}::${CLMMRouterModule}`
    const funcName = 'remove_liquidity'
    if (bcsPackage) {
      const typeArguments = [
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeA)),
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeB)),
      ]

      const args = [
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.pool)),
        BCS.bcsSerializeU128(params.delta_liquidity.toNumber()),
        BCS.bcsSerializeUint64(params.min_amount_a),
        BCS.bcsSerializeUint64(params.min_amount_b),
        BCS.bcsSerializeUint64(params.pos_index),
        BCS.bcsSerializeBool(params.is_close),
      ]

      return new TxnBuilderTypes.TransactionPayloadEntryFunction(
        TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
      )
    }
    const functionName = composeType(moduleName, funcName)
    const typeArguments = [params.coinTypeA, params.coinTypeB]
    const args = [
      params.pool,
      params.delta_liquidity.toNumber(),
      params.min_amount_a,
      params.min_amount_b,
      params.pos_index,
      params.is_close,
    ]
    return {
      type: 'entry_function_payload',
      function: functionName,
      type_arguments: typeArguments,
      arguments: args,
    }
  }

  closePositionTransactionPayload(
    params: ClosePositionParams,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction {
    const { modules } = this.sdk.sdkOptions.networkOptions

    const moduleName = `${modules.LiquidswapDeployer}::${CLMMRouterModule}`
    const funcName = 'close_position'

    if (bcsPackage) {
      const typeArguments = [
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeA)),
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeB)),
      ]

      const args = [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.pool_address)), BCS.bcsSerializeUint64(params.pos_index)]

      return new TxnBuilderTypes.TransactionPayloadEntryFunction(
        TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
      )
    }
    const functionName = composeType(moduleName, funcName)
    const typeArguments = [params.coinTypeA, params.coinTypeB]
    const args = [params.pool_address, params.pos_index]
    return {
      type: 'entry_function_payload',
      function: functionName,
      type_arguments: typeArguments,
      arguments: args,
    }
  }

  collectFeeTransactionPayload(
    params: CollectFeeParams,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction {
    const { modules } = this.sdk.sdkOptions.networkOptions
    const moduleName = `${modules.LiquidswapDeployer}::${CLMMRouterModule}`
    const funcName = 'collect_fee'
    if (bcsPackage) {
      const typeArguments = [
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeA)),
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeB)),
      ]

      const args = [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.pool)), BCS.bcsSerializeUint64(params.pos_index)]

      return new TxnBuilderTypes.TransactionPayloadEntryFunction(
        TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
      )
    }
    const functionName = composeType(moduleName, funcName)
    const typeArguments = [params.coinTypeA, params.coinTypeB]
    const args = [params.pool, params.pos_index]
    return {
      type: 'entry_function_payload',
      function: functionName,
      type_arguments: typeArguments,
      arguments: args,
    }
  }
}
