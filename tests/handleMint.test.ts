import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { beforeAll, describe, test } from 'matchstick-as'

import { handleMintHelper } from '../src/mappings/pool/mint'
import { Bundle, Pool, Token } from '../src/types/schema'
import { Mint } from '../src/types/templates/Pool/Pool'
import { convertTokenToDecimal, fastExponentiation, safeDiv } from '../src/utils'
import { ONE_BD } from '../src/utils/constants'
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

class MintFixture {
  sender: Address
  owner: Address
  tickLower: i32
  tickUpper: i32
  amount: BigInt
  amount0: BigInt
  amount1: BigInt
}

const MINT_FIXTURE: MintFixture = {
  sender: Address.fromString('0xc36442b4a4522e871399cd717abdd847ab11fe88'),
  owner: Address.fromString('0xc36442b4a4522e871399cd717abdd847ab11fe88'),
  tickLower: 195600,
  tickUpper: 196740,
  amount: BigInt.fromString('386405747494368'),
  amount0: BigInt.fromString('1000000000'),
  amount1: BigInt.fromString('66726312884609397'),
}

const MINT_EVENT = new Mint(
  Address.fromString(USDC_WIP_03_MAINNET_POOL),
  MOCK_EVENT.logIndex,
  MOCK_EVENT.transactionLogIndex,
  MOCK_EVENT.logType,
  MOCK_EVENT.block,
  MOCK_EVENT.transaction,
  [
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(MINT_FIXTURE.sender)),
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(MINT_FIXTURE.owner)),
    new ethereum.EventParam('tickLower', ethereum.Value.fromI32(MINT_FIXTURE.tickLower)),
    new ethereum.EventParam('tickUpper', ethereum.Value.fromI32(MINT_FIXTURE.tickUpper)),
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(MINT_FIXTURE.amount)),
    new ethereum.EventParam('amount0', ethereum.Value.fromUnsignedBigInt(MINT_FIXTURE.amount0)),
    new ethereum.EventParam('amount1', ethereum.Value.fromUnsignedBigInt(MINT_FIXTURE.amount1)),
  ],
  MOCK_EVENT.receipt,
)

describe('handleMint', () => {
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
  })

  test('success - mint event, pool tick is between tickUpper and tickLower', () => {
    // put the pools tick in range
    const pool = Pool.load(USDC_WIP_03_MAINNET_POOL)!
    pool.tick = BigInt.fromI32(MINT_FIXTURE.tickLower + MINT_FIXTURE.tickUpper).div(BigInt.fromI32(2))
    pool.save()

    handleMintHelper(MINT_EVENT, TEST_CONFIG)

    const amountToken0 = convertTokenToDecimal(MINT_FIXTURE.amount0, BigInt.fromString(USDC_MAINNET_FIXTURE.decimals))
    const amountToken1 = convertTokenToDecimal(MINT_FIXTURE.amount1, BigInt.fromString(WIP_MAINNET_FIXTURE.decimals))
    const poolTotalValueLockedIP = amountToken0
      .times(TEST_USDC_DERIVED_IP)
      .plus(amountToken1.times(TEST_WIP_DERIVED_IP))
    const poolTotalValueLockedUSD = poolTotalValueLockedIP.times(TEST_IP_PRICE_USD)

    assertObjectMatches('Factory', TEST_CONFIG.factoryAddress, [
      ['txCount', '1'],
      ['totalValueLockedIP', poolTotalValueLockedIP.toString()],
      ['totalValueLockedUSD', poolTotalValueLockedUSD.toString()],
    ])

    assertObjectMatches('Pool', USDC_WIP_03_MAINNET_POOL, [
      ['txCount', '1'],
      ['liquidity', MINT_FIXTURE.amount.toString()],
      ['totalValueLockedToken0', amountToken0.toString()],
      ['totalValueLockedToken1', amountToken1.toString()],
      ['totalValueLockedIP', poolTotalValueLockedIP.toString()],
      ['totalValueLockedUSD', poolTotalValueLockedUSD.toString()],
    ])

    assertObjectMatches('Token', USDC_MAINNET_FIXTURE.address, [
      ['txCount', '1'],
      ['totalValueLocked', amountToken0.toString()],
      ['totalValueLockedUSD', amountToken0.times(TEST_USDC_DERIVED_IP.times(TEST_IP_PRICE_USD)).toString()],
    ])

    assertObjectMatches('Token', WIP_MAINNET_FIXTURE.address, [
      ['txCount', '1'],
      ['totalValueLocked', amountToken1.toString()],
      ['totalValueLockedUSD', amountToken1.times(TEST_WIP_DERIVED_IP.times(TEST_IP_PRICE_USD)).toString()],
    ])

    assertObjectMatches('Mint', MOCK_EVENT.transaction.hash.toHexString() + '-' + MOCK_EVENT.logIndex.toString(), [
      ['transaction', MOCK_EVENT.transaction.hash.toHexString()],
      ['timestamp', MOCK_EVENT.block.timestamp.toString()],
      ['pool', USDC_WIP_03_MAINNET_POOL],
      ['token0', USDC_MAINNET_FIXTURE.address],
      ['token1', WIP_MAINNET_FIXTURE.address],
      ['owner', MINT_FIXTURE.owner.toHexString()],
      ['sender', MINT_FIXTURE.sender.toHexString()],
      ['origin', MOCK_EVENT.transaction.from.toHexString()],
      ['amount', MINT_FIXTURE.amount.toString()],
      ['amount0', amountToken0.toString()],
      ['amount1', amountToken1.toString()],
      ['amountUSD', poolTotalValueLockedUSD.toString()],
      ['tickUpper', MINT_FIXTURE.tickUpper.toString()],
      ['tickLower', MINT_FIXTURE.tickLower.toString()],
      ['logIndex', MOCK_EVENT.logIndex.toString()],
    ])

    const lowerTickPrice = fastExponentiation(BigDecimal.fromString('1.0001'), MINT_FIXTURE.tickLower)
    assertObjectMatches('Tick', USDC_WIP_03_MAINNET_POOL + '#' + MINT_FIXTURE.tickLower.toString(), [
      ['tickIdx', MINT_FIXTURE.tickLower.toString()],
      ['pool', USDC_WIP_03_MAINNET_POOL],
      ['poolAddress', USDC_WIP_03_MAINNET_POOL],
      ['createdAtTimestamp', MOCK_EVENT.block.timestamp.toString()],
      ['createdAtBlockNumber', MOCK_EVENT.block.number.toString()],
      ['liquidityGross', MINT_FIXTURE.amount.toString()],
      ['liquidityNet', MINT_FIXTURE.amount.toString()],
      ['price0', lowerTickPrice.toString()],
      ['price1', safeDiv(ONE_BD, lowerTickPrice).toString()],
    ])

    const upperTickPrice = fastExponentiation(BigDecimal.fromString('1.0001'), MINT_FIXTURE.tickUpper)
    assertObjectMatches('Tick', USDC_WIP_03_MAINNET_POOL + '#' + MINT_FIXTURE.tickUpper.toString(), [
      ['tickIdx', MINT_FIXTURE.tickUpper.toString()],
      ['pool', USDC_WIP_03_MAINNET_POOL],
      ['poolAddress', USDC_WIP_03_MAINNET_POOL],
      ['createdAtTimestamp', MOCK_EVENT.block.timestamp.toString()],
      ['createdAtBlockNumber', MOCK_EVENT.block.number.toString()],
      ['liquidityGross', MINT_FIXTURE.amount.toString()],
      ['liquidityNet', MINT_FIXTURE.amount.neg().toString()],
      ['price0', upperTickPrice.toString()],
      ['price1', safeDiv(ONE_BD, upperTickPrice).toString()],
    ])
  })

  test('success - mint event, pool tick is not between tickUpper and tickLower', () => {
    // put the pools tick out of range
    const pool = Pool.load(USDC_WIP_03_MAINNET_POOL)!
    pool.tick = BigInt.fromI32(MINT_FIXTURE.tickLower - 1)
    const liquidityBeforeMint = pool.liquidity
    pool.save()

    handleMintHelper(MINT_EVENT, TEST_CONFIG)

    // liquidity should not be updated
    assertObjectMatches('Pool', USDC_WIP_03_MAINNET_POOL, [['liquidity', liquidityBeforeMint.toString()]])
  })
})
