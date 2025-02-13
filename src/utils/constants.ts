import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { Factory as FactoryContract } from '../types/Factory/Factory'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export const ZERO_BI = BigInt.fromI32(0)
export const ONE_BI = BigInt.fromI32(1)
export const ZERO_BD = BigDecimal.fromString('0')
export const ONE_BD = BigDecimal.fromString('1')
export const BI_18 = BigInt.fromI32(18)
export const SECONDS_PER_YEAR = BigDecimal.fromString('31536000') // 365 * 24 * 60 * 60

  export const V3_FACTORY_CONTRACT = '0xa111dDbE973094F949D78Ad755cd560F8737B7e2'
  export const NFT_POSITION_MANAGER_ADDRESS = '0xb3823797B00ef062Aaa1c4B3c60149AFc6CCf7a3'
  export const ALPHA_HUNTER_ADDRESS = '0xa31A12D2736d3371273e462f6E272db998aE8b28'
  export const STABLECOIN_WRAPPEDNATIVE_POOLADDRESS = '0xc56c1bE28a22CED0270A4D2F45753d2b6300c1Ae'
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