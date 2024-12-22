import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { assert, beforeEach, clearStore, describe, test } from 'matchstick-as'

import { handleInitializeHelper } from '../src/mappings/pool/initialize'
import { Bundle, Pool, Token } from '../src/types/schema'
import { Initialize } from '../src/types/templates/Pool/Pool'
import { safeDiv } from '../src/utils'
import { ADDRESS_ZERO } from '../src/utils/constants'
import { findNativePerToken, getNativePriceInUSD } from '../src/utils/pricing'
import {
  assertObjectMatches,
  createAndStoreTestPool,
  createAndStoreTestToken,
  MOCK_EVENT,
  TEST_CONFIG,
  TEST_IP_PRICE_USD,
  USDC_MAINNET_FIXTURE,
  USDC_WIP_03_MAINNET_POOL,
  USDC_WIP_03_MAINNET_POOL_FIXTURE,
  WBTC_MAINNET_FIXTURE,
  WBTC_WIP_03_MAINNET_POOL,
  WBTC_WIP_03_MAINNET_POOL_FIXTURE,
  WIP_MAINNET_FIXTURE,
} from './constants'

class InitializeFixture {
  sqrtPriceX96: BigInt
  tick: i32
}

const INITIALIZE_FIXTURE: InitializeFixture = {
  sqrtPriceX96: BigInt.fromString('1111111111111111'),
  tick: 194280,
}

const INITIALIZE_EVENT = new Initialize(
  Address.fromString(USDC_WIP_03_MAINNET_POOL),
  MOCK_EVENT.logIndex,
  MOCK_EVENT.transactionLogIndex,
  MOCK_EVENT.logType,
  MOCK_EVENT.block,
  MOCK_EVENT.transaction,
  [
    new ethereum.EventParam('sqrtPriceX96', ethereum.Value.fromUnsignedBigInt(INITIALIZE_FIXTURE.sqrtPriceX96)),
    new ethereum.EventParam('tick', ethereum.Value.fromI32(INITIALIZE_FIXTURE.tick)),
  ],
  MOCK_EVENT.receipt,
)

describe('handleInitialize', () => {
  test('success', () => {
    createAndStoreTestPool(USDC_WIP_03_MAINNET_POOL_FIXTURE)

    const token0 = createAndStoreTestToken(USDC_MAINNET_FIXTURE)
    const token1 = createAndStoreTestToken(WIP_MAINNET_FIXTURE)

    const bundle = new Bundle('1')
    bundle.IPPriceUSD = TEST_IP_PRICE_USD
    bundle.save()

    handleInitializeHelper(INITIALIZE_EVENT, TEST_CONFIG)

    assertObjectMatches('Pool', USDC_WIP_03_MAINNET_POOL, [
      ['sqrtPrice', INITIALIZE_FIXTURE.sqrtPriceX96.toString()],
      ['tick', INITIALIZE_FIXTURE.tick.toString()],
    ])

    const expectedIPPrice = getNativePriceInUSD(USDC_WIP_03_MAINNET_POOL, true)
    assertObjectMatches('Bundle', '1', [['IPPriceUSD', expectedIPPrice.toString()]])

    const expectedToken0Price = findNativePerToken(
      token0 as Token,
      TEST_CONFIG.wrappedNativeAddress,
      TEST_CONFIG.stablecoinAddresses,
      TEST_CONFIG.minimumNativeLocked,
    )
    assertObjectMatches('Token', USDC_MAINNET_FIXTURE.address, [['derivedIP', expectedToken0Price.toString()]])

    const expectedToken1Price = findNativePerToken(
      token1 as Token,
      TEST_CONFIG.wrappedNativeAddress,
      TEST_CONFIG.stablecoinAddresses,
      TEST_CONFIG.minimumNativeLocked,
    )
    assertObjectMatches('Token', WIP_MAINNET_FIXTURE.address, [['derivedIP', expectedToken1Price.toString()]])
  })
})

describe('getIPPriceInUSD', () => {
  beforeEach(() => {
    clearStore()
    createAndStoreTestPool(USDC_WIP_03_MAINNET_POOL_FIXTURE)
  })

  test('success - stablecoin is token0', () => {
    const pool = Pool.load(USDC_WIP_03_MAINNET_POOL)!
    pool.token0Price = BigDecimal.fromString('1')
    pool.save()

    const IPPriceUSD = getNativePriceInUSD(USDC_WIP_03_MAINNET_POOL, true)

    assert.assertTrue(IPPriceUSD == BigDecimal.fromString('1'))
  })

  test('success - stablecoin is token1', () => {
    const pool = Pool.load(USDC_WIP_03_MAINNET_POOL)!
    pool.token1Price = BigDecimal.fromString('1')
    pool.save()

    const IPPriceUSD = getNativePriceInUSD(USDC_WIP_03_MAINNET_POOL, false)

    assert.assertTrue(IPPriceUSD == BigDecimal.fromString('1'))
  })

  test('failure - pool not found', () => {
    const pool = Pool.load(USDC_WIP_03_MAINNET_POOL)!
    pool.token0Price = BigDecimal.fromString('1')
    pool.token1Price = BigDecimal.fromString('1')
    pool.save()

    const IPPriceUSD = getNativePriceInUSD(ADDRESS_ZERO, true)
    assert.assertTrue(IPPriceUSD == BigDecimal.fromString('0'))
  })
})

describe('findNativePerToken', () => {
  beforeEach(() => {
    clearStore()

    const bundle = new Bundle('1')
    bundle.IPPriceUSD = TEST_IP_PRICE_USD
    bundle.save()
  })

  test('success - token is wrapped native', () => {
    const token = createAndStoreTestToken(WIP_MAINNET_FIXTURE)
    const IPPerToken = findNativePerToken(
      token as Token,
      TEST_CONFIG.wrappedNativeAddress,
      TEST_CONFIG.stablecoinAddresses,
      TEST_CONFIG.minimumNativeLocked,
    )
    assert.assertTrue(IPPerToken == BigDecimal.fromString('1'))
  })

  test('success - token is stablecoin', () => {
    const token = createAndStoreTestToken(USDC_MAINNET_FIXTURE)
    const IPPerToken = findNativePerToken(
      token as Token,
      TEST_CONFIG.wrappedNativeAddress,
      TEST_CONFIG.stablecoinAddresses,
      TEST_CONFIG.minimumNativeLocked,
    )
    const expectedStablecoinPrice = safeDiv(BigDecimal.fromString('1'), TEST_IP_PRICE_USD)
    assert.assertTrue(IPPerToken == expectedStablecoinPrice)
  })

  test('success - token is not wrapped native or stablecoin', () => {
    const pool = createAndStoreTestPool(WBTC_WIP_03_MAINNET_POOL_FIXTURE)

    const minimumIPLocked = BigDecimal.fromString('0')

    pool.liquidity = BigInt.fromString('100')
    pool.totalValueLockedToken1 = BigDecimal.fromString('100')
    pool.token1Price = BigDecimal.fromString('5')
    pool.save()

    const token0 = createAndStoreTestToken(WBTC_MAINNET_FIXTURE)
    token0.whitelistPools = [WBTC_WIP_03_MAINNET_POOL]
    token0.save()

    const token1 = createAndStoreTestToken(WIP_MAINNET_FIXTURE)
    token1.derivedIP = BigDecimal.fromString('10')
    token1.save()

    const IPPerToken = findNativePerToken(
      token0 as Token,
      WIP_MAINNET_FIXTURE.address,
      [USDC_MAINNET_FIXTURE.address],
      minimumIPLocked,
    )

    assert.assertTrue(IPPerToken == BigDecimal.fromString('50'))
  })

  test('success - token is not wrapped native or stablecoin, but has no pools', () => {
    const token0 = createAndStoreTestToken(WBTC_MAINNET_FIXTURE)
    const IPPerToken = findNativePerToken(
      token0 as Token,
      TEST_CONFIG.wrappedNativeAddress,
      TEST_CONFIG.stablecoinAddresses,
      TEST_CONFIG.minimumNativeLocked,
    )
    assert.assertTrue(IPPerToken == BigDecimal.fromString('0'))
  })

  test('success - token is not wrapped native or stablecoin, but has no pools with liquidity', () => {
    const token0 = createAndStoreTestToken(WBTC_MAINNET_FIXTURE)
    token0.whitelistPools = [WBTC_WIP_03_MAINNET_POOL]
    token0.save()

    const IPPerToken = findNativePerToken(
      token0 as Token,
      TEST_CONFIG.wrappedNativeAddress,
      TEST_CONFIG.stablecoinAddresses,
      TEST_CONFIG.minimumNativeLocked,
    )
    assert.assertTrue(IPPerToken == BigDecimal.fromString('0'))
  })
})
