import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { beforeAll, describe, test } from 'matchstick-as'

import { handleBurnHelper } from '../src/mappings/pool/burn'
import { Bundle, Pool, Tick, Token } from '../src/types/schema'
import { Burn } from '../src/types/templates/Pool/Pool'
import { convertTokenToDecimal, fastExponentiation, safeDiv } from '../src/utils'
import { ONE_BD, ZERO_BI } from '../src/utils/constants'
import {
  assertObjectMatches,
  invokePoolCreatedWithMockedIPCalls,
  MOCK_EVENT,
  TEST_CONFIG,
  TEST_IP_PRICE_USD,
  TEST_USDC_DERIVED_IP,
  TEST_WIP_DERIVED_IP,
  USDC_MAINNET_FIXTURE,
  USDC_WIP_03_MAINNET_POOL,
  WIP_MAINNET_FIXTURE,
} from './constants'

class BurnFixture {
  owner: Address
  tickLower: i32
  tickUpper: i32
  amount: BigInt
  amount0: BigInt
  amount1: BigInt
}

const BURN_FIXTURE: BurnFixture = {
  owner: Address.fromString('0x8692f704a20d11be3b32de68656651b5291ed26c'),
  tickLower: 194280,
  tickUpper: 194520,
  amount: BigInt.fromString('107031367278175302'),
  amount0: BigInt.fromString('77186598043'),
  amount1: BigInt.fromString('0'),
}

const BURN_EVENT = new Burn(
  Address.fromString(USDC_WIP_03_MAINNET_POOL),
  MOCK_EVENT.logIndex,
  MOCK_EVENT.transactionLogIndex,
  MOCK_EVENT.logType,
  MOCK_EVENT.block,
  MOCK_EVENT.transaction,
  [
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(BURN_FIXTURE.owner)),
    new ethereum.EventParam('tickLower', ethereum.Value.fromI32(BURN_FIXTURE.tickLower)),
    new ethereum.EventParam('tickUpper', ethereum.Value.fromI32(BURN_FIXTURE.tickUpper)),
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BURN_FIXTURE.amount)),
    new ethereum.EventParam('amount0', ethereum.Value.fromUnsignedBigInt(BURN_FIXTURE.amount0)),
    new ethereum.EventParam('amount1', ethereum.Value.fromUnsignedBigInt(BURN_FIXTURE.amount1)),
  ],
  MOCK_EVENT.receipt,
)

describe('handleBurn', () => {
  beforeAll(() => {
    invokePoolCreatedWithMockedIPCalls(MOCK_EVENT, TEST_CONFIG)

    const bundle = new Bundle('1')
    bundle.IPPriceUSD = TEST_IP_PRICE_USD
    bundle.save()

    const usdcEntity = Token.load(USDC_MAINNET_FIXTURE.address)!
    usdcEntity.derivedIP = TEST_USDC_DERIVED_IP
    usdcEntity.save()

    const WIPEntity = Token.load(WIP_MAINNET_FIXTURE.address)!
    WIPEntity.derivedIP = TEST_WIP_DERIVED_IP
    WIPEntity.save()

    const tickLower = new Tick(USDC_WIP_03_MAINNET_POOL + '#' + BURN_FIXTURE.tickLower.toString())
    tickLower.tickIdx = BigInt.fromI32(BURN_FIXTURE.tickLower)
    tickLower.pool = USDC_WIP_03_MAINNET_POOL
    tickLower.poolAddress = USDC_WIP_03_MAINNET_POOL
    tickLower.createdAtTimestamp = MOCK_EVENT.block.timestamp
    tickLower.createdAtBlockNumber = MOCK_EVENT.block.number
    tickLower.liquidityGross = ZERO_BI
    tickLower.liquidityNet = ZERO_BI
    tickLower.price0 = fastExponentiation(BigDecimal.fromString('1.0001'), BURN_FIXTURE.tickLower)
    tickLower.price1 = safeDiv(ONE_BD, tickLower.price0)
    tickLower.save()

    const tickUpper = new Tick(USDC_WIP_03_MAINNET_POOL + '#' + BURN_FIXTURE.tickUpper.toString())
    tickUpper.tickIdx = BigInt.fromI32(BURN_FIXTURE.tickUpper)
    tickUpper.pool = USDC_WIP_03_MAINNET_POOL
    tickUpper.poolAddress = USDC_WIP_03_MAINNET_POOL
    tickUpper.createdAtTimestamp = MOCK_EVENT.block.timestamp
    tickUpper.createdAtBlockNumber = MOCK_EVENT.block.number
    tickUpper.liquidityGross = ZERO_BI
    tickUpper.liquidityNet = ZERO_BI
    tickUpper.price0 = fastExponentiation(BigDecimal.fromString('1.0001'), BURN_FIXTURE.tickUpper)
    tickUpper.price1 = safeDiv(ONE_BD, tickUpper.price0)
    tickUpper.save()
  })

  // note: all tvl should be zero in this test because burns don't remove TVL, only collects do
  test('success - burn event, pool tick is between tickUpper and tickLower', () => {
    // put the pools tick in range
    const pool = Pool.load(USDC_WIP_03_MAINNET_POOL)!
    pool.tick = BigInt.fromI32(BURN_FIXTURE.tickLower + BURN_FIXTURE.tickUpper).div(BigInt.fromI32(2))
    pool.save()

    handleBurnHelper(BURN_EVENT, TEST_CONFIG)

    const amountToken0 = convertTokenToDecimal(BURN_FIXTURE.amount0, BigInt.fromString(USDC_MAINNET_FIXTURE.decimals))
    const amountToken1 = convertTokenToDecimal(BURN_FIXTURE.amount1, BigInt.fromString(WIP_MAINNET_FIXTURE.decimals))
    const poolTotalValueLockedIP = amountToken0
      .times(TEST_USDC_DERIVED_IP)
      .plus(amountToken1.times(TEST_WIP_DERIVED_IP))
    const poolTotalValueLockedUSD = poolTotalValueLockedIP.times(TEST_IP_PRICE_USD)

    assertObjectMatches('Factory', TEST_CONFIG.factoryAddress, [
      ['txCount', '1'],
      ['totalValueLockedIP', '0'],
      ['totalValueLockedUSD', '0'],
    ])

    assertObjectMatches('Pool', USDC_WIP_03_MAINNET_POOL, [
      ['txCount', '1'],
      ['liquidity', BURN_FIXTURE.amount.neg().toString()],
      ['totalValueLockedToken0', '0'],
      ['totalValueLockedToken1', '0'],
      ['totalValueLockedIP', '0'],
      ['totalValueLockedUSD', '0'],
      ['totalValueLockedIP', '0'],
      ['totalValueLockedUSD', '0'],
    ])

    assertObjectMatches('Token', USDC_MAINNET_FIXTURE.address, [
      ['txCount', '1'],
      ['totalValueLocked', '0'],
      ['totalValueLockedUSD', '0'],
    ])

    assertObjectMatches('Token', WIP_MAINNET_FIXTURE.address, [
      ['txCount', '1'],
      ['totalValueLocked', '0'],
      ['totalValueLockedUSD', '0'],
    ])

    assertObjectMatches('Burn', MOCK_EVENT.transaction.hash.toHexString() + '-' + MOCK_EVENT.logIndex.toString(), [
      ['transaction', MOCK_EVENT.transaction.hash.toHexString()],
      ['timestamp', MOCK_EVENT.block.timestamp.toString()],
      ['pool', USDC_WIP_03_MAINNET_POOL],
      ['token0', USDC_MAINNET_FIXTURE.address],
      ['token1', WIP_MAINNET_FIXTURE.address],
      ['owner', BURN_FIXTURE.owner.toHexString()],
      ['origin', MOCK_EVENT.transaction.from.toHexString()],
      ['amount', BURN_FIXTURE.amount.toString()],
      ['amount0', amountToken0.toString()],
      ['amount1', amountToken1.toString()],
      ['amountUSD', poolTotalValueLockedUSD.toString()],
      ['tickUpper', BURN_FIXTURE.tickUpper.toString()],
      ['tickLower', BURN_FIXTURE.tickLower.toString()],
      ['logIndex', MOCK_EVENT.logIndex.toString()],
    ])

    assertObjectMatches('Tick', USDC_WIP_03_MAINNET_POOL + '#' + BURN_FIXTURE.tickLower.toString(), [
      ['liquidityGross', BURN_FIXTURE.amount.neg().toString()],
      ['liquidityNet', BURN_FIXTURE.amount.neg().toString()],
    ])

    assertObjectMatches('Tick', USDC_WIP_03_MAINNET_POOL + '#' + BURN_FIXTURE.tickUpper.toString(), [
      ['liquidityGross', BURN_FIXTURE.amount.neg().toString()],
      ['liquidityNet', BURN_FIXTURE.amount.toString()],
    ])
  })

  test('success - burn event, pool tick is not between tickUpper and tickLower', () => {
    // put the pools tick out of range
    const pool = Pool.load(USDC_WIP_03_MAINNET_POOL)!
    pool.tick = BigInt.fromI32(BURN_FIXTURE.tickLower - 1)
    const liquidityBeforeBurn = pool.liquidity
    pool.save()

    handleBurnHelper(BURN_EVENT, TEST_CONFIG)

    // liquidity should not be updated
    assertObjectMatches('Pool', USDC_WIP_03_MAINNET_POOL, [['liquidity', liquidityBeforeBurn.toString()]])
  })
})
