import { LaunchpadPool, FixedPricePoolState } from '../modules/launchpadModule'
import { TokenInfo } from '../modules/tokenModule'
import { CoinInfo, CoinStore, GlobalConfig, Pool, PoolState, Position } from '../modules/resourcesModule'
import Decimal from '../utils/decimal'

export type AptosResourceType = string
export type BigNumber = Decimal.Value | number | string

export const CoinInfoAddress = '0x1::coin::CoinInfo'
export const CoinStoreAddress = '0x1::coin::CoinStore'
export const TokenStoreAddress = '0x3::token::TokenStore'
export const TokenStoreDepositEvent = '0x3::token::DepositEvent'
export const TokenStoreWithdrawEvent = '0x3::token::WithdrawEvent'
export const PoolLiquidityCoinType = 'PoolLiquidityCoin'

export const CLMMRouterModule = 'clmm_router'
export const PoolsModule = 'factory'
export const PoolsStruct = 'Pools'
export const PoolLpModule = 'pool'
export const PoolLpStruct = 'Pool'
export const ScriptsModule = 'scripts'

export const LaunchpadPoolLpModule = 'pool'
export const LaunchpadPoolLpStruct = 'CrowdsalePool'
export const LaunchpadRouterModule = 'router'
export const LaunchpadPoolLiquidityCoinType = 'cscoin'

export type AptosCacheResource =
  | AptosResource
  | CoinInfo[]
  | CoinStore[]
  | Pool[]
  | PoolState
  | LaunchpadPool[]
  | FixedPricePoolState
  | Position
  | Position[]
  | number
  | GlobalConfig
  | TokenInfo[]

export type AptosResource<T = unknown> = {
  data: T
  type: string
}

export type AptosCoinInfoResource = {
  decimals: string
  name: string
  supply: {
    vec: [string]
  }
  symbol: string
}

export type AptosCoinStoreResource = {
  coin: {
    value: string
  }

  frozen: boolean
}

// not sure yet
export type AptosPoolResource = {
  coin_a: { value: string }
  coin_b: { value: string }
  protocol_fee_to: string
  locked_liquidity: {
    value: string
  }
  burn_capability: {
    dummy_field: boolean
  }
  mint_capability: {
    dummy_field: boolean
  }
}

export type TxPayloadCallFunction = {
  type: string
  function: string
  arguments: any[]
  type_arguments: any[]
}

export type TxPayloadInstallModule = {
  type: 'module_bundle_payload'
  modules: { bytecode: string }[]
}

export type AptosTxPayload = TxPayloadCallFunction | TxPayloadInstallModule

export type AptosCreateTx = {
  sender: string
  maxGasAmount: string
  gasUnitPrice: string
  gasCurrencyCode: string
  expiration: string
  payload: AptosTxPayload
}

/**
 * The default factory enabled fee amounts, denominated in hundredths of bips.
 */
// eslint-disable-next-line no-shadow
export enum FeeAmount {
  LOWEST = 100,
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

/**
 * The default factory tick spacings by fee amount.
 */
export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOWEST]: 1,
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
}

// 0xa32a1a12fa8d5d7be589783daf37ffb4d69edaa5::amm_swap::Pool<0x86db822b5448a4e77380baf4db280b7b8919b0f1::faucet::USDT, 0x86db822b5448a4e77380baf4db280b7b8919b0f1::faucet::USDC>
export type AptosStructTag = {
  full_address: AptosResourceType // 0xa32a1a12fa8d5d7be589783daf37ffb4d69edaa5::amm_swap::Pool
  address: AptosResourceType // 0xa32a1a12fa8d5d7be589783daf37ffb4d69edaa5
  module: string // amm_swap
  name: string // Pool
  type_arguments: AptosResourceType[] // [0x86db822b5448a4e77380baf4db280b7b8919b0f1::faucet::USDT, 0x86db822b5448a4e77380baf4db280b7b8919b0f1::faucet::USDC]
}
