import { AptosAccount, AptosClient, BCS, TxnBuilderTypes, Types } from 'aptos'
import { hexToString } from '../utils/hex'
import { simulatePayloadTx, SimulationKeys } from '../utils/txSender'
import { CachedContent } from '../utils/cachedContent'
import { composeType } from '../utils/contracts'
import { AptosCacheResource, AptosResourceType, TxPayloadCallFunction } from '../types/aptos'
import { SDK } from '../sdk'
import { IModule } from '../interfaces/IModule'

export const cacheTime5min = 5 * 60 * 1000
export const cacheTime24h = 24 * 60 * 60 * 1000
function getFutureTime(interval: number) {
  return Date.parse(new Date().toString()) + interval
}

export type TokenInfo = {
  coingecko_id: string
  decimals: number
  logo_url: string
  name: string
  official_symbol: string
  project_url: string
  symbol: string
  extensions: TokenExtensions
  address: string
}
type TokenExtensions = {
  data: []
}
type TokenWarpInfo = {
  coin_info_list: any
}

export type TokenInfoParams = {
  name: string
  symbol: string
  coingecko_id: string
  logo_url: string
  project_url: string
  is_update: boolean
  coinType: AptosResourceType
}

export class TokenModule implements IModule {
  protected _sdk: SDK

  private readonly _cache: Record<string, CachedContent> = {}

  constructor(sdk: SDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  addToListPayload(
    list: string,
    coinType: string,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction {
    const { modules } = this.sdk.sdkOptions.networkOptions
    const moduleName = `${modules.TokenDeployer}::coin_list`
    const funcName = 'add_to_list'

    if (bcsPackage) {
      const args = [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(list))]
      return new TxnBuilderTypes.TransactionPayloadEntryFunction(
        TxnBuilderTypes.EntryFunction.natural(
          moduleName,
          funcName,
          [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(coinType))],
          args
        )
      )
    }
    return {
      type: 'entry_function_payload',
      function: composeType(moduleName, funcName),
      type_arguments: [coinType],
      arguments: [list],
    }
  }

  addApproverToRegistryPayload(
    approver: string,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction {
    const { modules } = this.sdk.sdkOptions.networkOptions
    const moduleName = `${modules.TokenDeployer}::coin_list`
    const funcName = 'add_approver_to_registry'

    if (bcsPackage) {
      const args = [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(approver))]
      return new TxnBuilderTypes.TransactionPayloadEntryFunction(TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, [], args))
    }
    const args = [approver]
    return {
      type: 'entry_function_payload',
      function: composeType(moduleName, funcName),
      type_arguments: [],
      arguments: args,
    }
  }

  addToRegistryByApprovePayload(
    params: TokenInfoParams,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction {
    const { modules } = this.sdk.sdkOptions.networkOptions
    const moduleName = `${modules.TokenDeployer}::coin_list`
    const funcName = 'add_to_registry_by_approver'

    if (bcsPackage) {
      const typeArguments = [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinType))]
      const args = [
        BCS.bcsSerializeStr(params.name),
        BCS.bcsSerializeStr(params.symbol),
        BCS.bcsSerializeStr(params.coingecko_id),
        BCS.bcsSerializeStr(params.logo_url),
        BCS.bcsSerializeStr(params.project_url),
        BCS.bcsSerializeBool(params.is_update),
      ]
      return new TxnBuilderTypes.TransactionPayloadEntryFunction(
        TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
      )
    }
    // eslint-disable-next-line no-new
    const args = [params.name, params.symbol, params.coingecko_id, params.logo_url, params.project_url, params.is_update]
    const typeArguments = [params.coinType]
    return {
      type: 'entry_function_payload',
      function: composeType(moduleName, funcName),
      type_arguments: typeArguments,
      arguments: args,
    }
  }

  async getOwnerTokenList(simulationKey: SimulationKeys, listOwnerAddr: string, forceRefresh = false): Promise<TokenInfo[]> {
    const cacheKey = `${listOwnerAddr}_getOwnerTokenList`
    if (!forceRefresh) {
      const cacheData = this.getCacheData(cacheKey)
      if (cacheData !== null) {
        return cacheData as TokenInfo[]
      }
    }
    const { modules } = this._sdk.sdkOptions.networkOptions
    const moduleName = `${modules.TokenDeployer}::coin_list`
    const funcName = 'fetch_full_list'

    const payload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        moduleName,
        funcName,
        [],
        [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(listOwnerAddr))]
      )
    )
    const res = await simulatePayloadTx(this._sdk.client, simulationKey, payload)

    const tokenList = this.transformTokenData(res.changes as Types.WriteSetChange_WriteResource[])

    this.updateCache(cacheKey, tokenList, cacheTime24h)
    return tokenList
  }

  async getAllRegisteredTokenList(simulationKey: SimulationKeys, forceRefresh = false): Promise<TokenInfo[]> {
    const cacheKey = `getAllRegisteredTokenList`
    if (!forceRefresh) {
      const cacheData = this.getCacheData(cacheKey)
      if (cacheData !== null) {
        return cacheData as TokenInfo[]
      }
    }
    const { modules } = this._sdk.sdkOptions.networkOptions
    const moduleName = `${modules.TokenDeployer}::coin_list`
    const funcName = 'fetch_all_registered_coin_info'
    const client = new AptosClient(this.sdk.sdkOptions.rpcUrl)

    const payload = new TxnBuilderTypes.TransactionPayloadEntryFunction(TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, [], []))
    const res = await simulatePayloadTx(client, simulationKey, payload)
    const tokenList = this.transformTokenData(res.changes as Types.WriteSetChange_WriteResource[])

    this.updateCache(cacheKey, tokenList, cacheTime24h)

    return tokenList
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private transformTokenData(changes: Types.WriteSetChange_WriteResource[]): TokenInfo[] {
    const tokenList: TokenInfo[] = []
    const { modules } = this._sdk.sdkOptions.networkOptions
    const valueData = changes.filter((change) => {
      if (change.type !== 'write_resource') {
        return false
      }
      const wr = change as Types.WriteSetChange_WriteResource
      return wr.data.type === `${modules.TokenDeployer}::coin_list::FullList`
    })
    if (valueData.length === 0) {
      return tokenList
    }
    const wr = valueData[0] as Types.WriteSetChange_WriteResource
    const tokenWarpInfo = wr.data.data as unknown as TokenWarpInfo

    tokenWarpInfo.coin_info_list.forEach((item: any) => {
      tokenList.push({
        ...item,
      })
    })
    return tokenList
  }

  private updateCache(key: string, data: AptosCacheResource, time = cacheTime5min) {
    let cacheData = this._cache[key]
    if (cacheData) {
      cacheData.overdueTime = getFutureTime(time)
      cacheData.value = data
    } else {
      cacheData = new CachedContent(data, getFutureTime(time))
    }
    this._cache[key] = cacheData
  }

  private getCacheData(cacheKey: string): AptosCacheResource | null {
    const cacheData = this._cache[cacheKey]
    if (cacheData !== undefined && cacheData.getCacheData()) {
      return cacheData.value
    }
    return null
  }
}
