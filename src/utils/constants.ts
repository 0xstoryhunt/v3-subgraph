import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { Factory as FactoryContract } from '../types/Factory/Factory'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export const ZERO_BI = BigInt.fromI32(0)
export const ONE_BI = BigInt.fromI32(1)
export const ZERO_BD = BigDecimal.fromString('0')
export const ONE_BD = BigDecimal.fromString('1')
export const BI_18 = BigInt.fromI32(18)
export const SECONDS_PER_YEAR = BigDecimal.fromString('31536000') // 365 * 24 * 60 * 60

  export const V3_FACTORY_CONTRACT = '0x57232FAb5a3269D3d77457bcE96aADD455f274cB'
  export const NFT_POSITION_MANAGER_ADDRESS = '0x8d5B4F1db0C023dd113EDE4d0632D57d2212efA5'
  export const ALPHA_HUNTER_ADDRESS = '0x31028C208C6d33bFD66605c2E3D593965fdceBDb'
  export const STABLECOIN_WRAPPEDNATIVE_POOLADDRESS = '0x9B386de62d16D08C768bB8337418813f7de93C62'
  export const WIP_ADDRESS = '0x1514000000000000000000000000000000000000'
  export const STABLECOIN_ADDRESSES = ['0x8c7C52EabB0FCbcAeBCe2556D9A719d539EA02D8'] //USDC, USDT, DAI
  export const WHITELIST_TOKEN_ADDRESSES = [
    '0x1514000000000000000000000000000000000000', //WIP
    '0x8c7C52EabB0FCbcAeBCe2556D9A719d539EA02D8' //USDC
  ]

export const factoryContract = FactoryContract.bind(Address.fromString(V3_FACTORY_CONTRACT))

//supported chains
// subgraph does not support string enums, hence these constants
export const STORY_TESTNET_NAME = 'story-aeneid'
export const STORY_MAINNET_NAME = 'story'
export const ODYSSEY_TESTNET_NAME = 'odyssey-testnet'