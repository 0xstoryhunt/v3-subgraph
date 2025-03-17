import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { Factory as FactoryContract } from '../types/Factory/Factory'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export const ZERO_BI = BigInt.fromI32(0)
export const ONE_BI = BigInt.fromI32(1)
export const ZERO_BD = BigDecimal.fromString('0')
export const ONE_BD = BigDecimal.fromString('1')
export const BI_18 = BigInt.fromI32(18)
export const SECONDS_PER_YEAR = BigDecimal.fromString('31536000') // 365 * 24 * 60 * 60

  export const V3_FACTORY_CONTRACT = '0xB0d76e6C7aA7a78A00Af1A1083B4732a488700b4'
  export const NFT_POSITION_MANAGER_ADDRESS = '0xa09B218862abfAFB67A5E356b6f507F0e0Ce061E'
  export const ALPHA_HUNTER_ADDRESS = '0x774a44C1CBC75FCBD4Dc81F7b78E7C2796D25834'
  export const STABLECOIN_WRAPPEDNATIVE_POOLADDRESS = '0x0ee923fa1c2e2f422f65bdc04cf381ba40221a2c' //@NOTE: ALWAYS LOWERCASE //WIP-USDC 0.3% pool //Recomended WIP-USDC 0.05% pool
  export const WIP_ADDRESS = '0x1514000000000000000000000000000000000000'
  export const STABLECOIN_ADDRESSES = ['0x8c7C52EabB0FCbcAeBCe2556D9A719d539EA02D8'] 
  export const WHITELIST_TOKEN_ADDRESSES = [
    '0x1514000000000000000000000000000000000000', //WIP
    '0x8c7C52EabB0FCbcAeBCe2556D9A719d539EA02D8', //USDC
  ]

export const factoryContract = FactoryContract.bind(Address.fromString(V3_FACTORY_CONTRACT))

//supported chains
// subgraph does not support string enums, hence these constants
export const STORY_TESTNET_NAME = 'story-aeneid'
export const STORY_MAINNET_NAME = 'story'
export const ODYSSEY_TESTNET_NAME = 'odyssey-testnet'