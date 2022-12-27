import { AptosClient, BCS, TxnBuilderTypes, Types, getAddressFromAccountOrAddress } from 'aptos'
import { CachedContent } from '../utils/cachedContent'
import { SDK } from '../sdk'
import { IModule } from '../interfaces/IModule'
import { Tick } from '../types/clmmpool'

export type FetchTickParams = {
  accountAddress: string
  accountPublicKey: string
  pool: string
  coinTypeA: string
  coinTypeB: string
}

export type GetTickParams = {
  index: number
  offset: number
  limit: number
} & FetchTickParams

export class FetcherModule implements IModule {
  protected _sdk: SDK

  constructor(sdk: SDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  // eslint-disable-next-line class-methods-use-this
  async getTicks(params: GetTickParams) {
    const { modules } = this.sdk.sdkOptions.networkOptions
    const client = new AptosClient(this.sdk.sdkOptions.rpcUrl)
    const moduleName = `${modules.FetcherDeployer}::tick_fetcher`
    const funcName = 'fetches'
    const typeArguments = [
      new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeA)),
      new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeB)),
    ]

    const args = [
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.pool)),
      BCS.bcsSerializeUint64(params.index),
      BCS.bcsSerializeUint64(params.offset),
      BCS.bcsSerializeUint64(params.limit),
    ]

    const payload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
    )

    const myAccount = getAddressFromAccountOrAddress(params.accountAddress)
    const rawTxn = await client.generateRawTransaction(myAccount, payload)
    const pubkey = getAddressFromAccountOrAddress(params.accountPublicKey)
    const account2 = new TxnBuilderTypes.Ed25519PublicKey(pubkey.toUint8Array())
    const res: any = await client.simulateTransaction(account2, rawTxn)
    const events = res[0].events[0]
    const { ticks } = events.data
    return ticks
  }

  async fetchTicks(params: FetchTickParams) {
    let ticks: Tick[] = []
    let index = 0
    let offset = 0
    const limit = 512
    while (true) {
      const data = await this.getTicks({
        accountAddress: params.accountAddress,
        accountPublicKey: params.accountPublicKey,
        pool: params.pool,
        coinTypeA: params.coinTypeA,
        coinTypeB: params.coinTypeB,
        index,
        offset,
        limit,
      })
      ticks = [...ticks, ...data]
      if (data.length < limit) {
        break
      }
      if (offset < 999) {
        offset += 1
      } else {
        index += 1
      }
    }
    return ticks
  }
}
