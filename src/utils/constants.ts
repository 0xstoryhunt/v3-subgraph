import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { Factory as FactoryContract } from '../types/Factory/Factory'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export const ZERO_BI = BigInt.fromI32(0)
export const ONE_BI = BigInt.fromI32(1)
export const ZERO_BD = BigDecimal.fromString('0')
export const ONE_BD = BigDecimal.fromString('1')
export const BI_18 = BigInt.fromI32(18)
export const SECONDS_PER_YEAR = BigDecimal.fromString('31536000') // 365 * 24 * 60 * 60

export const factoryContract = FactoryContract.bind(Address.fromString('0x6A76afC7417fd6A57fEAe35fB53Fd51eDc08C1ba'))
