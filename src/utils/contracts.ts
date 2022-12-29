import { HexString, TxnBuilderTypes } from 'aptos'
import { AptosResourceType, AptosStructTag, CoinStoreAddress } from '../types/aptos'
import { checkAddress } from './hex'

const EQUAL = 0
const LESS_THAN = 1
const GREATER_THAN = 2

const COIN_STORE_TYPE_ARG_REGEX = /^0x1::coin::CoinStore<(.+)>$/

function cmp(a: number, b: number) {
  if (a === b) {
    return EQUAL
  }
  if (a < b) {
    return LESS_THAN
  }
  return GREATER_THAN
}

function compare(symbolX: string, symbolY: string) {
  let iX = symbolX.length
  let iY = symbolY.length

  const lenCmp = cmp(iX, iY)
  while (iX > 0 && iY > 0) {
    iX -= 1
    iY -= 1

    const elemCmp = cmp(symbolX.charCodeAt(iX), symbolY.charCodeAt(iY))
    if (elemCmp !== 0) {
      return elemCmp
    }
  }

  return lenCmp
}

export function isSortedSymbols(symbolX: string, symbolY: string) {
  return compare(symbolX, symbolY) === LESS_THAN
}

export function composeType(address: string, generics: AptosResourceType[]): AptosResourceType
export function composeType(address: string, struct: string, generics?: AptosResourceType[]): AptosResourceType
export function composeType(address: string, module: string, struct: string, generics?: AptosResourceType[]): AptosResourceType
export function composeType(address: string, ...args: unknown[]): AptosResourceType {
  const generics: string[] = Array.isArray(args[args.length - 1]) ? (args.pop() as string[]) : []
  const chains = [address, ...args].filter(Boolean)

  let result: string = chains.join('::')

  if (generics && generics.length) {
    result += `<${generics.join(', ')}>`
  }

  return result
}

export function composeTypeByTypeTagStruct(tagStruct: TxnBuilderTypes.TypeTagStruct): AptosResourceType {
  return composeType(
    HexString.fromUint8Array(tagStruct.value.address.address).hex(),
    tagStruct.value.module_name.value,
    tagStruct.value.name.value,
    []
  )
}

export function composePoolLiquidityCoin(type: TxnBuilderTypes.TypeTagStruct) {
  const structA = type.value.type_args[0] as TxnBuilderTypes.TypeTagStruct
  const structB = type.value.type_args[1] as TxnBuilderTypes.TypeTagStruct
  const coinA = composeTypeByTypeTagStruct(structA)
  const coinB = composeTypeByTypeTagStruct(structB)
  const lpAddress = composeType(
    HexString.fromUint8Array(type.value.address.address).hex(),
    type.value.module_name.value,
    type.value.name.value,
    [coinA, coinB]
  )
  return {
    coinA,
    coinB,
    lpAddress,
  }
}

export function extractAddressFromType(type: string) {
  return type.split('::')[0]
}

export function extractStructTagFromType(type: string): AptosStructTag {
  let _type = type.replace(/\s/g, '')

  const genericsString = _type.match(/(<.+>)$/)
  const generics = genericsString?.[0]?.match(/(\w+::\w+::\w+)(?:<.*?>(?!>))?/g)
  if (generics) {
    _type = _type.slice(0, _type.indexOf('<'))
    const tag = extractStructTagFromType(_type)
    const structTag: AptosStructTag = {
      ...tag,
      type_arguments: [...generics],
    }
    return structTag
  }
  const parts = _type.split('::')
  const structTag: AptosStructTag = {
    full_address: _type,
    address: parts[0],
    module: parts[1],
    name: parts[2],
    type_arguments: [],
  }
  return structTag
}

export function getCoinTypeArg(type: string) {
  const res = type.match(COIN_STORE_TYPE_ARG_REGEX)
  return res ? res[1] : ''
}

export function getCoinTypeFromArg(coinTypeArg: string) {
  return `${CoinStoreAddress}<${coinTypeArg}>`
}

export function checkAptosType(type: any, options: { leadingZero: boolean } = { leadingZero: true }): boolean {
  if (typeof type !== 'string') {
    return false
  }

  let _type = type.replace(/\s/g, '')

  const openBracketsCount = _type.match(/</g)?.length ?? 0
  const closeBracketsCount = _type.match(/>/g)?.length ?? 0

  if (openBracketsCount !== closeBracketsCount) {
    return false
  }

  const genericsString = _type.match(/(<.+>)$/)
  const generics = genericsString?.[1]?.match(/(\w+::\w+::\w+)(?:<.*?>(?!>))?/g)

  if (generics) {
    _type = _type.slice(0, _type.indexOf('<'))
    const validGenerics = generics.every((g) => {
      const gOpenCount = g.match(/</g)?.length ?? 0
      const gCloseCount = g.match(/>/g)?.length ?? 0
      let t = g
      if (gOpenCount !== gCloseCount) {
        t = t.slice(0, -(gCloseCount - gOpenCount))
      }

      return checkAptosType(t, options)
    })

    if (!validGenerics) {
      return false
    }
  }

  const parts = _type.split('::')
  if (parts.length !== 3) {
    return false
  }

  return checkAddress(parts[0], options) && parts[1].length >= 1 && parts[2].length >= 1
}
