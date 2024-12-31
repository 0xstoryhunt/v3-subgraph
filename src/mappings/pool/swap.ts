import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { Bundle, Factory, Pool, Swap, Token } from '../../types/schema'
import { Swap as SwapEvent } from '../../types/templates/Pool/Pool'
import { convertTokenToDecimal, loadTransaction, safeDiv } from '../../utils'
import { getSubgraphConfig, SubgraphConfig } from '../../utils/chains'
import { ONE_BI, ZERO_BD } from '../../utils/constants'
import {
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
  updateTokenHourData,
  updateStoryHuntDayData,
  updateTokenMinuteData,
} from '../../utils/intervalUpdates'
import {
  findNativePerToken,
  getNativePriceInUSD,
  getTrackedAmountUSD,
  sqrtPriceX96ToTokenPrices,
} from '../../utils/pricing'

export function handleSwap(event: SwapEvent): void {
  handleSwapHelper(event)
}

export function handleSwapHelper(event: SwapEvent, subgraphConfig: SubgraphConfig = getSubgraphConfig()): void {
  const factoryAddress = subgraphConfig.factoryAddress
  const stablecoinWrappedNativePoolAddress = subgraphConfig.stablecoinWrappedNativePoolAddress
  const stablecoinIsToken0 = subgraphConfig.stablecoinIsToken0
  const wrappedNativeAddress = subgraphConfig.wrappedNativeAddress
  const stablecoinAddresses = subgraphConfig.stablecoinAddresses
  const minimumNativeLocked = subgraphConfig.minimumNativeLocked
  const whitelistTokens = subgraphConfig.whitelistTokens

  const bundle = Bundle.load('1')!
  const factory = Factory.load(factoryAddress)!
  const pool = Pool.load(event.address.toHexString())!

  const token0 = Token.load(pool.token0)
  const token1 = Token.load(pool.token1)

  if (token0 && token1) {
    // amounts - 0/1 are token deltas: can be positive or negative
    const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
    const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

    // need absolute amounts for volume
    let amount0Abs = amount0
    if (amount0.lt(ZERO_BD)) {
      amount0Abs = amount0.times(BigDecimal.fromString('-1'))
    }
    let amount1Abs = amount1
    if (amount1.lt(ZERO_BD)) {
      amount1Abs = amount1.times(BigDecimal.fromString('-1'))
    }

    const amount0IP = amount0Abs.times(token0.derivedIP)
    const amount1IP = amount1Abs.times(token1.derivedIP)
    const amount0USD = amount0IP.times(bundle.IPPriceUSD)
    const amount1USD = amount1IP.times(bundle.IPPriceUSD)

    // get amount that should be tracked only - div 2 because cant count both input and output as volume
    const amountTotalUSDTracked = getTrackedAmountUSD(
      amount0Abs,
      token0 as Token,
      amount1Abs,
      token1 as Token,
      whitelistTokens,
    ).div(BigDecimal.fromString('2'))
    const amountTotalIPTracked = safeDiv(amountTotalUSDTracked, bundle.IPPriceUSD)
    const amountTotalUSDUntracked = amount0USD.plus(amount1USD).div(BigDecimal.fromString('2'))

    const feesIP = amountTotalIPTracked.times(pool.feeTier.toBigDecimal()).div(BigDecimal.fromString('1000000'))
    const feesUSD = amountTotalUSDTracked.times(pool.feeTier.toBigDecimal()).div(BigDecimal.fromString('1000000'))

    // global updates
    factory.txCount = factory.txCount.plus(ONE_BI)
    factory.totalVolumeIP = factory.totalVolumeIP.plus(amountTotalIPTracked)
    factory.totalVolumeUSD = factory.totalVolumeUSD.plus(amountTotalUSDTracked)
    factory.untrackedVolumeUSD = factory.untrackedVolumeUSD.plus(amountTotalUSDUntracked)
    factory.totalFeesIP = factory.totalFeesIP.plus(feesIP)
    factory.totalFeesUSD = factory.totalFeesUSD.plus(feesUSD)

    // reset aggregate tvl before individual pool tvl updates
    const currentPoolTvlIP = pool.totalValueLockedIP
    factory.totalValueLockedIP = factory.totalValueLockedIP.minus(currentPoolTvlIP)

    // pool volume
    pool.volumeToken0 = pool.volumeToken0.plus(amount0Abs)
    pool.volumeToken1 = pool.volumeToken1.plus(amount1Abs)
    pool.volumeUSD = pool.volumeUSD.plus(amountTotalUSDTracked)
    pool.untrackedVolumeUSD = pool.untrackedVolumeUSD.plus(amountTotalUSDUntracked)
    pool.feesUSD = pool.feesUSD.plus(feesUSD)
    pool.txCount = pool.txCount.plus(ONE_BI)

    // Update the pool with the new active liquidity, price, and tick.
    pool.liquidity = event.params.liquidity
    pool.tick = BigInt.fromI32(event.params.tick)
    pool.sqrtPrice = event.params.sqrtPriceX96
    pool.totalValueLockedToken0 = pool.totalValueLockedToken0.plus(amount0)
    pool.totalValueLockedToken1 = pool.totalValueLockedToken1.plus(amount1)

    // update token0 data
    token0.volume = token0.volume.plus(amount0Abs)
    token0.totalValueLocked = token0.totalValueLocked.plus(amount0)
    token0.volumeUSD = token0.volumeUSD.plus(amountTotalUSDTracked)
    token0.untrackedVolumeUSD = token0.untrackedVolumeUSD.plus(amountTotalUSDUntracked)
    token0.feesUSD = token0.feesUSD.plus(feesUSD)
    token0.txCount = token0.txCount.plus(ONE_BI)

    // update token1 data
    token1.volume = token1.volume.plus(amount1Abs)
    token1.totalValueLocked = token1.totalValueLocked.plus(amount1)
    token1.volumeUSD = token1.volumeUSD.plus(amountTotalUSDTracked)
    token1.untrackedVolumeUSD = token1.untrackedVolumeUSD.plus(amountTotalUSDUntracked)
    token1.feesUSD = token1.feesUSD.plus(feesUSD)
    token1.txCount = token1.txCount.plus(ONE_BI)

    // updated pool ratess
    const prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0 as Token, token1 as Token)
    pool.token0Price = prices[0]
    pool.token1Price = prices[1]
    pool.save()

    // update USD pricing
    bundle.IPPriceUSD = getNativePriceInUSD(stablecoinWrappedNativePoolAddress, stablecoinIsToken0)
    bundle.save()
    token0.derivedIP = findNativePerToken(
      token0 as Token,
      wrappedNativeAddress,
      stablecoinAddresses,
      minimumNativeLocked,
    )
    token1.derivedIP = findNativePerToken(
      token1 as Token,
      wrappedNativeAddress,
      stablecoinAddresses,
      minimumNativeLocked,
    )

    /**
     * Things afffected by new USD rates
     */
    pool.totalValueLockedIP = pool.totalValueLockedToken0
      .times(token0.derivedIP)
      .plus(pool.totalValueLockedToken1.times(token1.derivedIP))
    pool.totalValueLockedUSD = pool.totalValueLockedIP.times(bundle.IPPriceUSD)

    factory.totalValueLockedIP = factory.totalValueLockedIP.plus(pool.totalValueLockedIP)
    factory.totalValueLockedUSD = factory.totalValueLockedIP.times(bundle.IPPriceUSD)

    token0.totalValueLockedUSD = token0.totalValueLocked.times(token0.derivedIP).times(bundle.IPPriceUSD)
    token1.totalValueLockedUSD = token1.totalValueLocked.times(token1.derivedIP).times(bundle.IPPriceUSD)

    // create Swap event
    const transaction = loadTransaction(event, pool)
    const swap = new Swap(transaction.id + '-' + event.logIndex.toString())
    swap.transaction = transaction.id
    swap.timestamp = transaction.timestamp
    swap.pool = pool.id
    swap.token0 = pool.token0
    swap.token1 = pool.token1
    swap.sender = event.params.sender
    swap.origin = event.transaction.from
    swap.recipient = event.params.recipient
    swap.amount0 = amount0
    swap.amount1 = amount1
    swap.amountUSD = amountTotalUSDTracked
    swap.tick = BigInt.fromI32(event.params.tick)
    swap.sqrtPriceX96 = event.params.sqrtPriceX96
    swap.logIndex = event.logIndex

    // interval data
    const storyhuntDayData = updateStoryHuntDayData(event, factoryAddress)
    const poolDayData = updatePoolDayData(event)
    const poolHourData = updatePoolHourData(event)
    const token0DayData = updateTokenDayData(token0 as Token, event)
    const token1DayData = updateTokenDayData(token1 as Token, event)
    const token0HourData = updateTokenHourData(token0 as Token, event)
    const token1HourData = updateTokenHourData(token1 as Token, event)
    const token0MinuteData = updateTokenMinuteData(token0 as Token, event)
    const token1MinuteData = updateTokenMinuteData(token1 as Token, event)

    // update volume metrics
    storyhuntDayData.volumeIP = storyhuntDayData.volumeIP.plus(amountTotalIPTracked)
    storyhuntDayData.volumeUSD = storyhuntDayData.volumeUSD.plus(amountTotalUSDTracked)
    storyhuntDayData.feesUSD = storyhuntDayData.feesUSD.plus(feesUSD)

    poolDayData.volumeUSD = poolDayData.volumeUSD.plus(amountTotalUSDTracked)
    poolDayData.volumeToken0 = poolDayData.volumeToken0.plus(amount0Abs)
    poolDayData.volumeToken1 = poolDayData.volumeToken1.plus(amount1Abs)
    poolDayData.feesUSD = poolDayData.feesUSD.plus(feesUSD)

    poolHourData.volumeUSD = poolHourData.volumeUSD.plus(amountTotalUSDTracked)
    poolHourData.volumeToken0 = poolHourData.volumeToken0.plus(amount0Abs)
    poolHourData.volumeToken1 = poolHourData.volumeToken1.plus(amount1Abs)
    poolHourData.feesUSD = poolHourData.feesUSD.plus(feesUSD)

    token0DayData.volume = token0DayData.volume.plus(amount0Abs)
    token0DayData.volumeUSD = token0DayData.volumeUSD.plus(amountTotalUSDTracked)
    token0DayData.untrackedVolumeUSD = token0DayData.untrackedVolumeUSD.plus(amountTotalUSDTracked)
    token0DayData.feesUSD = token0DayData.feesUSD.plus(feesUSD)

    token0HourData.volume = token0HourData.volume.plus(amount0Abs)
    token0HourData.volumeUSD = token0HourData.volumeUSD.plus(amountTotalUSDTracked)
    token0HourData.untrackedVolumeUSD = token0HourData.untrackedVolumeUSD.plus(amountTotalUSDTracked)
    token0HourData.feesUSD = token0HourData.feesUSD.plus(feesUSD)

    token0MinuteData.volume = token0MinuteData.volume.plus(amount0Abs)
    token0MinuteData.volumeUSD = token0MinuteData.volumeUSD.plus(amountTotalUSDTracked)
    token0MinuteData.untrackedVolumeUSD = token0MinuteData.untrackedVolumeUSD.plus(amountTotalUSDTracked)
    token0MinuteData.feesUSD = token0MinuteData.feesUSD.plus(feesUSD)

    token1DayData.volume = token1DayData.volume.plus(amount1Abs)
    token1DayData.volumeUSD = token1DayData.volumeUSD.plus(amountTotalUSDTracked)
    token1DayData.untrackedVolumeUSD = token1DayData.untrackedVolumeUSD.plus(amountTotalUSDTracked)
    token1DayData.feesUSD = token1DayData.feesUSD.plus(feesUSD)

    token1HourData.volume = token1HourData.volume.plus(amount1Abs)
    token1HourData.volumeUSD = token1HourData.volumeUSD.plus(amountTotalUSDTracked)
    token1HourData.untrackedVolumeUSD = token1HourData.untrackedVolumeUSD.plus(amountTotalUSDTracked)
    token1HourData.feesUSD = token1HourData.feesUSD.plus(feesUSD)

    token1MinuteData.volume = token1MinuteData.volume.plus(amount1Abs)
    token1MinuteData.volumeUSD = token1MinuteData.volumeUSD.plus(amountTotalUSDTracked)
    token1MinuteData.untrackedVolumeUSD = token1MinuteData.untrackedVolumeUSD.plus(amountTotalUSDTracked)
    token1MinuteData.feesUSD = token1MinuteData.feesUSD.plus(feesUSD)

    swap.save()
    token0DayData.save()
    token1DayData.save()
    storyhuntDayData.save()
    poolDayData.save()
    poolHourData.save()
    token0HourData.save()
    token1HourData.save()
    token0MinuteData.save()
    token1MinuteData.save()
    poolHourData.save()
    factory.save()
    pool.save()
    token0.save()
    token1.save()
  }
}
