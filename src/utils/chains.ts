import { Address, BigDecimal, BigInt, dataSource } from '@graphprotocol/graph-ts'
import { STABLECOIN_ADDRESSES, STABLECOIN_WRAPPEDNATIVE_POOLADDRESS, V3_FACTORY_CONTRACT, WHITELIST_TOKEN_ADDRESSES, WIP_ADDRESS } from './constants'
import { StaticTokenDefinition } from './staticTokenDefinition'

export enum ChainId {
  STORY_TESTNET = 1513,
  STORY_ODYSSEY = 1516,
}

// subgraph does not support string enums, hence these constants
const STORY_TESTNET_NAME = 'story-testnet'
const ODYSSEY_TESTNET_NAME = 'odyssey-testnet'
// Note: All token and pool addresses should be lowercased!
export class SubgraphConfig {
  // deployment address
  factoryAddress: string

  // the address of a pool where one token is a stablecoin and the other is a
  // token that tracks the price of the native token use this to calculate the
  // price of the native token, so prefer a pool with highest liquidity
  stablecoinWrappedNativePoolAddress: string

  // true is stablecoin is token0, false if stablecoin is token1
  stablecoinIsToken0: boolean

  // the address of a token that tracks the price of the native token, most of
  // the time, this is a wrapped asset but could also be the native token itself
  // for some chains
  wrappedNativeAddress: string

  // the mimimum liquidity in a pool needed for it to be used to help calculate
  // token prices. for new chains, this should be initialized to ~4000 USD
  minimumNativeLocked: BigDecimal

  // list of stablecoin addresses
  stablecoinAddresses: string[]

  // a token must be in a pool with one of these tokens in order to derive a
  // price (in addition to passing the minimumIPLocked check). This is also
  // used to determine whether volume is tracked or not.
  whitelistTokens: string[]

  // token overrides are used to override RPC calls for the symbol, name, and
  // decimals for tokens. for new chains this is typically empty.
  tokenOverrides: StaticTokenDefinition[]

  // skip the creation of these pools in handlePoolCreated. for new chains this is typically empty.
  poolsToSkip: string[]

  // initialize this list of pools and token addresses on factory creation. for new chains this is typically empty.
  poolMappings: Array<Address[]>
}

export function getSubgraphConfig(): SubgraphConfig {
  // Update this value to the corresponding chain you want to deploy
  const selectedNetwork = dataSource.network()

  // subgraph does not support case switch with strings, hence this if else block
  if (selectedNetwork == STORY_TESTNET_NAME) {
    return {
      factoryAddress: '0x...',
      stablecoinWrappedNativePoolAddress: '0x...', // WIP-USDbC 0.05% pool
      stablecoinIsToken0: false,
      wrappedNativeAddress: '0x...', // WIP
      minimumNativeLocked: BigDecimal.fromString('1'),
      stablecoinAddresses: [
        '0x...', // USDC
        '0x...', // USDT
      ],
      whitelistTokens: [
        '0x...', // USDC
        '0x...', // WIP
        '0x...', // WIP
        '0x...', // WBTC
        '0x...', // FATE
      ],
      tokenOverrides: [],
      poolsToSkip: [],
      poolMappings: [],
    }
  } else if (selectedNetwork == ODYSSEY_TESTNET_NAME) {
    return {
      factoryAddress: V3_FACTORY_CONTRACT,
      stablecoinWrappedNativePoolAddress: STABLECOIN_WRAPPEDNATIVE_POOLADDRESS, // WIP-USDC 0.05% pool
      stablecoinIsToken0: false,
      wrappedNativeAddress: WIP_ADDRESS, // WIP
      minimumNativeLocked: BigDecimal.fromString('1'),
      stablecoinAddresses: STABLECOIN_ADDRESSES,
      whitelistTokens: WHITELIST_TOKEN_ADDRESSES,
      tokenOverrides: [],
      poolsToSkip: [],
      poolMappings: [],
    }
  } else {
    throw new Error('Unsupported Network')
  }
}
