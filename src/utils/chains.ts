import { Address, BigDecimal, BigInt, dataSource } from '@graphprotocol/graph-ts'

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
      factoryAddress: '0x2344C1448E528dD0e4094c92966A7f68f45aa4e4',
      stablecoinWrappedNativePoolAddress: '0x...', // IP-USDbC 0.05% pool
      stablecoinIsToken0: false,
      wrappedNativeAddress: '0x1516000000000000000000000000000000000000', // WIP
      minimumNativeLocked: BigDecimal.fromString('1'),
      stablecoinAddresses: [
        '0xF1815bd50389c46847f0Bda824eC8da914045D14', // USDC
      ],
      whitelistTokens: [
        '0x1516000000000000000000000000000000000000', //WIP
        '0xF1815bd50389c46847f0Bda824eC8da914045D14', //USDC
        '0x181c610790F508F281b48Ca29ddc1DFfff9B0D80', //FATE
      ],
      tokenOverrides: [],
      poolsToSkip: [],
      poolMappings: [],
    }
  } else {
    throw new Error('Unsupported Network')
  }
}
