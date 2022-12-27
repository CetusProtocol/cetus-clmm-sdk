/* eslint-disable class-methods-use-this */
import BN from 'bn.js'
import { BCS, TxnBuilderTypes } from 'aptos'
import { composeType } from '../utils/contracts'
import { SDK } from '../sdk'
import { IModule } from '../interfaces/IModule'
import { TxPayloadCallFunction, AptosResourceType, CLMMRouterModule } from '../types/aptos'

export type CreatePoolParams = {
  coinTypeA: AptosResourceType
  coinTypeB: AptosResourceType
  tick_spacing: number
  initialize_sqrt_price: BN
  uri: string
}

export type UpdateFeeRateParams = {
  pool_addr: string
  new_fee_rate: number
  coinTypeA: AptosResourceType
  coinTypeB: AptosResourceType
}

export class PoolModule implements IModule {
  protected _sdk: SDK

  constructor(sdk: SDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  creatPoolTransactionPayload(
    params: CreatePoolParams,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction {
    const { modules } = this.sdk.sdkOptions.networkOptions

    const moduleName = `${modules.LiquidswapDeployer}::${CLMMRouterModule}`
    const funcName = 'create_pool'

    if (bcsPackage) {
      const typeArguments = [
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeA)),
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeB)),
      ]

      const args = [
        BCS.bcsSerializeUint64(params.tick_spacing),
        BCS.bcsSerializeU128(Number(params.initialize_sqrt_price)),
        BCS.bcsSerializeStr(params.uri),
      ]

      return new TxnBuilderTypes.TransactionPayloadEntryFunction(
        TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
      )
    }
    const functionName = composeType(moduleName, funcName)
    const typeArguments = [params.coinTypeA, params.coinTypeB]
    const args = [params.tick_spacing.toString(), params.initialize_sqrt_price.toString(), params.uri.toString()]
    return {
      type: 'entry_function_payload',
      function: functionName,
      type_arguments: typeArguments,
      arguments: args,
    }
  }
}
