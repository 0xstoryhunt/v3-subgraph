import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { Factory as FactoryContract } from '../types/Factory/Factory'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export const ZERO_BI = BigInt.fromI32(0)
export const ONE_BI = BigInt.fromI32(1)
export const ZERO_BD = BigDecimal.fromString('0')
export const ONE_BD = BigDecimal.fromString('1')
export const BI_18 = BigInt.fromI32(18)
export const SECONDS_PER_YEAR = BigDecimal.fromString('31536000') // 365 * 24 * 60 * 60

  export const V3_FACTORY_CONTRACT = '0x45B3fBfE020cEd4F7a3d1AD8B23e3e7FC500E5e7'
  export const NFT_POSITION_MANAGER_ADDRESS = '0xBE6da1986c159eA87d61f03D6b820C2581018FCA'
  export const ALPHA_HUNTER_ADDRESS = '0x7DC66165b101579148bfaD7f691C30d818bc5f39'
  export const STABLECOIN_WRAPPEDNATIVE_POOLADDRESS = '0x953C58c86418d05c4321Ebd220BC0283D89429Bf'
  export const WIP_ADDRESS = '0x1516000000000000000000000000000000000000'
  export const STABLECOIN_ADDRESSES = ['0xF1815bd50389c46847f0Bda824eC8da914045D14'] //USDC, USDT, DAI
  export const WHITELIST_TOKEN_ADDRESSES = [
    '0x1516000000000000000000000000000000000000', //WIP
    '0xF1815bd50389c46847f0Bda824eC8da914045D14' //USDC
  ]

export const factoryContract = FactoryContract.bind(Address.fromString(V3_FACTORY_CONTRACT))

