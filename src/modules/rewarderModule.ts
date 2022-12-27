import { BCS, TxnBuilderTypes } from 'aptos'
import BN from 'bn.js'
import { MathUtil, ZERO } from '../math/utils'
import { Pool } from './resourcesModule'
import { TickData } from '../types/clmmpool'
import { composeType } from '../utils/contracts'
import { getRewardInTickRange } from '../utils/tick'
import { AptosResourceType, CLMMRouterModule, ScriptsModule, TxPayloadCallFunction } from '../types/aptos'
import { SDK } from '../sdk'
import { IModule } from '../interfaces/IModule'

export type CollectRewarderParams = {
  coinTypeA: AptosResourceType
  coinTypeB: AptosResourceType
  coinTypeC: AptosResourceType
  pool_address: string
  index: number
  pos_index: number
}

export type CollectPoolRewarderParams = {
  coinTypeA: AptosResourceType
  coinTypeB: AptosResourceType
  coinTypeC: AptosResourceType
  coinTypeD: AptosResourceType
  coinTypeE: AptosResourceType
  pool_address: string
  pos_index: number
  rewarder_nums: number
}

export class RewarderModule implements IModule {
  protected _sdk: SDK

  private growthGlobal: BN[]

  constructor(sdk: SDK) {
    this._sdk = sdk
    this.growthGlobal = [ZERO, ZERO, ZERO]
  }

  get sdk() {
    return this._sdk
  }

  // `listRewarderInfosFromClmmpool` returns all rewarders from a clmmpool.
  async listRewarderInfosFromClmmpool(poolAddress: string) {
    const currentPool: any = await this.sdk.Resources.getPool(poolAddress)

    const rewarderInfos: any = []
    for (const rewarderInfo of currentPool.rewarder_infos) {
      rewarderInfos.push(rewarderInfo)
    }

    return rewarderInfos
  }

  // `emissionsEveryDay` returns the number of emissions every day.
  async emissionsEveryDay(poolAddress: string) {
    const rewarderInfos: any = await this.listRewarderInfosFromClmmpool(poolAddress)
    if (!rewarderInfos) {
      return null
    }

    const emissionsEveryDay = []
    for (const rewarderInfo of rewarderInfos) {
      const emissionSeconds = MathUtil.fromX64(new BN(rewarderInfo.emissions_per_second))
      emissionsEveryDay.push({
        emissions: Math.floor(emissionSeconds.toNumber() * 60 * 60 * 24),
        coin_address: rewarderInfo.coinAddress,
      })
    }

    return emissionsEveryDay
  }

  // listRewarderInfosFromPosition returns all rewarderInfos from a position.
  async collectRewarderAmount(pool: Pool, positionName: string) {
    const position = await this.sdk.Resources.getPositionInfo(pool, positionName)
    if (!position) {
      return null
    }

    const rewarderAmount = {
      reward_amount_owed_0: position.reward_amount_owed_0,
      reward_amount_owed_1: position.reward_amount_owed_1,
      reward_amount_owed_2: position.reward_amount_owed_2,
    }

    return rewarderAmount
  }

  async updatePoolRewarder(poolAddress: string, currentTime: BN): Promise<Pool> {
    // refresh pool rewarder
    const currentPool: Pool = await this.sdk.Resources.getPool(poolAddress)
    const last_time = currentPool.rewarder_last_updated_time
    currentPool.rewarder_last_updated_time = currentTime

    if (currentPool.liquidity === 0 || currentTime.eq(last_time)) {
      return currentPool
    }
    const timeDelta = currentTime.div(new BN(1000)).sub(new BN(last_time)).add(new BN(15))
    const rewarderInfos: any = currentPool.rewarder_infos

    for (let i = 0; i < rewarderInfos.length; i += 1) {
      const rewarderInfo = rewarderInfos[i]
      const rewarderGrowthDelta = MathUtil.checkMulDivFloor(
        timeDelta,
        new BN(rewarderInfo.emissions_per_second),
        new BN(currentPool.liquidity),
        128
      )
      this.growthGlobal[i] = new BN(rewarderInfo.growth_global).add(rewarderGrowthDelta)
    }

    return currentPool
  }

  async posRewardersAmount(poolAddress: string, positionName: string, tickLower: TickData, tickUpper: TickData) {
    const currentTime = Date.parse(new Date().toString())
    const pool: any = await this.updatePoolRewarder(poolAddress, new BN(currentTime))
    const position = await this.sdk.Resources.getPositionInfo(pool, positionName)
    const tick_lower_index = parseInt(position.tick_lower_index, 10)
    const tick_upper_index = parseInt(position.tick_upper_index, 10)
    const rewardersInside = getRewardInTickRange(pool, tickLower, tickUpper, tick_lower_index, tick_upper_index, this.growthGlobal)

    const growthInside = []
    const AmountOwed = []

    if (rewardersInside.length > 0) {
      const growthDelta_0 = rewardersInside[0].sub(new BN(position.reward_growth_inside_0))
      const amountOwed_0 = MathUtil.checkMulShiftRight(new BN(position.liquidity), growthDelta_0, 64, 256)
      growthInside.push(rewardersInside[0])
      AmountOwed.push({
        amount_owed: new BN(position.reward_amount_owed_0).add(amountOwed_0),
        coin_address: pool.rewarder_infos[0].coinAddress,
      })
    }

    if (rewardersInside.length > 1) {
      const growthDelta_1 = rewardersInside[1].sub(new BN(position.reward_growth_inside_1))
      const amountOwed_1 = MathUtil.checkMulShiftRight(new BN(position.liquidity), growthDelta_1, 64, 256)
      growthInside.push(rewardersInside[1])
      AmountOwed.push({
        amount_owed: new BN(position.reward_amount_owed_1).add(amountOwed_1),
        coin_address: pool.rewarder_infos[1].coinAddress,
      })
    }

    if (rewardersInside.length > 2) {
      const growthDelta_2 = rewardersInside[2].sub(new BN(position.reward_growth_inside_2))
      const amountOwed_2 = MathUtil.checkMulShiftRight(new BN(position.liquidity), growthDelta_2, 64, 256)
      growthInside.push(rewardersInside[2])
      AmountOwed.push({
        amount_owed: new BN(position.reward_amount_owed_2).add(amountOwed_2),
        coin_address: pool.rewarder_infos[2].coinAddress,
      })
    }
    return AmountOwed
  }

  async poolRewardersAmount(account: string, poolAddress: string, tickLowers: TickData[], tickUppers: TickData[]) {
    const currentTime = Date.parse(new Date().toString())
    const pool = await this.updatePoolRewarder(poolAddress, new BN(currentTime))
    const positions = await this.sdk.Resources.getPositionList(account, [pool])
    const rewarderAmount = [ZERO, ZERO, ZERO]

    for (let i = 0; i < positions.length; i += 1) {
      const posRewarderInfo: any = await this.posRewardersAmount(poolAddress, positions[i], tickLowers[i], tickUppers[i])
      for (let j = 0; j < 3; j += 1) {
        rewarderAmount[j] = rewarderAmount[j].add(posRewarderInfo[j].amount_owed)
      }
    }

    return rewarderAmount
  }

  collectPosRewarderTransactionPayload(
    params: CollectRewarderParams,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction {
    const { modules } = this.sdk.sdkOptions.networkOptions
    const moduleName = `${modules.LiquidswapDeployer}::${CLMMRouterModule}`
    const funcName = 'collect_rewarder'
    if (bcsPackage) {
      const typeArguments = [
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeA)),
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeB)),
        new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeC)),
      ]

      const args = [
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.pool_address)),
        BCS.bcsSerializeU8(params.index),
        BCS.bcsSerializeUint64(params.pos_index),
      ]

      return new TxnBuilderTypes.TransactionPayloadEntryFunction(
        TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
      )
    }
    const functionName = composeType(moduleName, funcName)
    const typeArguments = [params.coinTypeA, params.coinTypeB, params.coinTypeC]
    const args = [params.pool_address, params.index, params.pos_index]
    return {
      type: 'entry_function_payload',
      function: functionName,
      type_arguments: typeArguments,
      arguments: args,
    }
  }

  collectPoolRewarderTransactionPayload(
    params: CollectPoolRewarderParams,
    bcsPackage = false
  ): TxnBuilderTypes.TransactionPayloadEntryFunction | TxPayloadCallFunction | undefined {
    if (params.rewarder_nums === 1) {
      const param_one: CollectRewarderParams = {
        pool_address: params.pool_address,
        index: 0,
        pos_index: params.pos_index,
        coinTypeA: params.coinTypeA,
        coinTypeB: params.coinTypeB,
        coinTypeC: params.coinTypeC,
      }
      return this.collectPosRewarderTransactionPayload(param_one, bcsPackage)
    }

    const { modules } = this.sdk.sdkOptions.networkOptions
    const moduleName = `${modules.ClmmIntegrate}::${ScriptsModule}`

    if (params.rewarder_nums === 2) {
      const funcName = 'collect_rewarder_for_two'

      if (bcsPackage) {
        const typeArguments = [
          new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeA)),
          new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeB)),
          new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeC)),
          new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeD)),
        ]
        const args = [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.pool_address)), BCS.bcsSerializeUint64(params.pos_index)]
        return new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
        )
      }

      const functionName = composeType(moduleName, funcName)
      const typeArguments = [params.coinTypeA, params.coinTypeB, params.coinTypeC, params.coinTypeD]
      const args = [params.pool_address, params.pos_index]
      return {
        type: 'entry_function_payload',
        function: functionName,
        type_arguments: typeArguments,
        arguments: args,
      }
    }

    if (params.rewarder_nums === 3) {
      const funcName = 'collect_rewarder_for_three'

      if (bcsPackage) {
        const typeArguments = [
          new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeA)),
          new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeB)),
          new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeC)),
          new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeD)),
          new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(params.coinTypeE)),
        ]
        const args = [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.pool_address)), BCS.bcsSerializeUint64(params.pos_index)]
        return new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(moduleName, funcName, typeArguments, args)
        )
      }
      const functionName = composeType(moduleName, funcName)
      const typeArguments = [params.coinTypeA, params.coinTypeB, params.coinTypeC, params.coinTypeD, params.coinTypeE]
      const args = [params.pool_address, params.pos_index]
      return {
        type: 'entry_function_payload',
        function: functionName,
        type_arguments: typeArguments,
        arguments: args,
      }
    }

    return undefined
  }
}
