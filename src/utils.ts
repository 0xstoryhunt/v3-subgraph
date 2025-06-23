import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Factory as FactoryContract } from './types/StoryhuntLocker/Factory'

export const BI_ZERO = BigInt.fromI32(0);
export const BI_ONE = BigInt.fromI32(1);
export const BD_ZERO = BigDecimal.fromString('0')

export const ADDRESS_ZERO = Address.fromString("0x0000000000000000000000000000000000000000");
export const ACC_PRECISION = BigInt.fromString("1000000000000");

export const BOOST_PRECISION = BigInt.fromString("1000000000000");


export const V3_FACTORY_CONTRACT = '0xa111dDbE973094F949D78Ad755cd560F8737B7e2'
export const V3_NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0xb3823797B00ef062Aaa1c4B3c60149AFc6CCf7a3'
export const factoryContract = FactoryContract.bind(Address.fromString(V3_FACTORY_CONTRACT))