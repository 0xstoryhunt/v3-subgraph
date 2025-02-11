import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { Factory as FactoryContract } from '../types/Factory/Factory'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export const ZERO_BI = BigInt.fromI32(0)
export const ONE_BI = BigInt.fromI32(1)
export const ZERO_BD = BigDecimal.fromString('0')
export const ONE_BD = BigDecimal.fromString('1')
export const BI_18 = BigInt.fromI32(18)
export const SECONDS_PER_YEAR = BigDecimal.fromString('31536000') // 365 * 24 * 60 * 60

  export const V3_FACTORY_CONTRACT = '0x305936Fb6EBE41e9b6815067ca357cAEf397c1e8'
  export const NFT_POSITION_MANAGER_ADDRESS = '0xc4965a978a909Ec458559f38e64BC7b1E060407d'
  export const ALPHA_HUNTER_ADDRESS = '0x7504511BEf32BFF98d3cf296fe04e24c1fFCf0f4'
  export const STABLECOIN_WRAPPEDNATIVE_POOLADDRESS = '0xb59dBfEBE236b6ee1cFF0B681998c92D3BC75c7d'
  export const WIP_ADDRESS = '0x1514000000000000000000000000000000000000'
  export const STABLECOIN_ADDRESSES = ['0xF1815bd50389c46847f0Bda824eC8da914045D14','0x674843C06FF83502ddb4D37c2E09C01cdA38cbc8'] //USDC, USDT, DAI
  export const WHITELIST_TOKEN_ADDRESSES = [
    '0x1514000000000000000000000000000000000000', //WIP
    '0xF1815bd50389c46847f0Bda824eC8da914045D14', //USDC
    '0x674843C06FF83502ddb4D37c2E09C01cdA38cbc8', //USDT
    '0x5267F7eE069CEB3D8F1c760c215569b79d0685aD', //vIP
  ]

export const factoryContract = FactoryContract.bind(Address.fromString(V3_FACTORY_CONTRACT))

//supported chains
// subgraph does not support string enums, hence these constants
export const STORY_TESTNET_NAME = 'story-aeneid'
export const STORY_MAINNET_NAME = 'story'
export const ODYSSEY_TESTNET_NAME = 'odyssey-testnet'