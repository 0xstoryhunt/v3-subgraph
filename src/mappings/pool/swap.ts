import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'

import { Bundle, Factory, Pool, PoolDayData, Swap, Token } from '../../types/schema'
import { Swap as SwapEvent } from '../../types/templates/Pool/Pool'
import { convertTokenToDecimal, loadTransaction, safeDiv } from '../../utils'
import { getSubgraphConfig, SubgraphConfig } from '../../utils/chains'
import { ONE_BI, SECONDS_PER_YEAR, ZERO_BD, ZERO_BI } from '../../utils/constants'
import {
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
  updateTokenHourData,
  updateStoryHuntDayData,
  updateTokenMinuteData,
  updateTokenMarketCap,
} from '../../utils/intervalUpdates'
import {
  findNativePerToken,
  getNativePriceInUSD,
  getTrackedAmountUSD,
  sqrtPriceX96ToTokenPrices,
} from '../../utils/pricing'

// Helper function to compute the absolute value of a BigDecimal
function bdAbs(x: BigDecimal): BigDecimal {
  return x.lt(ZERO_BD) ? x.times(BigDecimal.fromString("-1")) : x;
}

export function handleSwap(event: SwapEvent): void {
  handleSwapHelper(event)
}

export function handleSwapHelper(
  event: SwapEvent, 
  subgraphConfig: SubgraphConfig = getSubgraphConfig()
): void {
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

  // --- NEW: Cap the native USD price during the unstable period ---
  // Get the native price from the stablecoin pool.
  let newIPPriceUSD = getNativePriceInUSD(stablecoinWrappedNativePoolAddress, stablecoinIsToken0)
  let unstablePeriod = BigInt.fromI32(43200) // 12 hours in seconds
  let timeSinceCreation = event.block.timestamp.minus(pool.createdAtTimestamp)
  // If we are in the unstable period and the price is unusually high, cap it.
  if (timeSinceCreation.lt(unstablePeriod)) {
    if(newIPPriceUSD.gt(BigDecimal.fromString("20"))) {
      newIPPriceUSD = BigDecimal.fromString("1")
    }
  }
  bundle.IPPriceUSD = newIPPriceUSD
  bundle.save()
  // --- End native price capping ---

  const token0 = Token.load(pool.token0)
  const token1 = Token.load(pool.token1)

  if (token0 && token1) {
    // amounts - token deltas; can be positive or negative
    const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
    const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

    // get absolute values for volume
    let amount0Abs = amount0.lt(ZERO_BD)
      ? amount0.times(BigDecimal.fromString("-1"))
      : amount0
    let amount1Abs = amount1.lt(ZERO_BD)
      ? amount1.times(BigDecimal.fromString("-1"))
      : amount1

    const amount0IP = amount0Abs.times(token0.derivedIP)
    const amount1IP = amount1Abs.times(token1.derivedIP)
    // Recalculate USD amounts using the (possibly capped) bundle.IPPriceUSD
    const amount0USD = amount0IP.times(bundle.IPPriceUSD)
    const amount1USD = amount1IP.times(bundle.IPPriceUSD)

    // get tracked USD volume; divided by 2 because we don't count both input and output
    const amountTotalUSDTracked = getTrackedAmountUSD(
      amount0Abs,
      token0 as Token,
      amount1Abs,
      token1 as Token,
      whitelistTokens,
    ).div(BigDecimal.fromString("2"))
    const amountTotalIPTracked = safeDiv(amountTotalUSDTracked, bundle.IPPriceUSD)
    const amountTotalUSDUntracked = amount0USD.plus(amount1USD).div(BigDecimal.fromString("2"))

    // ---- BEGIN VOLUME VALIDATION (Unstable Period Filtering) ----
    // During the first 12 hours, we only accept swap volumes if the swap's price is within 5% of our baseline.
    let validatedAmountTotalUSDTracked: BigDecimal = amountTotalUSDTracked
    let validatedAmountTotalIPTracked: BigDecimal = amountTotalIPTracked

    // Set deviation threshold to 2000%
    let threshold = BigDecimal.fromString("20")

    if (timeSinceCreation.lt(unstablePeriod)) {
      // Compute current swap price (using token0 as reference)
      const currentSwapPrices = sqrtPriceX96ToTokenPrices(event.params.sqrtPriceX96, token0 as Token, token1 as Token)
      const currentSwapPrice = currentSwapPrices[0]

      if (pool.token0Price.equals(ZERO_BD)) {
        // Initialize baseline from pool's stored sqrtPrice (from pool creation)
        const initialPrices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0 as Token, token1 as Token)
        pool.token0Price = initialPrices[0]
        validatedAmountTotalUSDTracked = ZERO_BD
        validatedAmountTotalIPTracked = ZERO_BD
      } else {
        // Compute the relative difference from our baseline
        let diff = bdAbs(currentSwapPrice.minus(pool.token0Price)).div(pool.token0Price)
        if (diff.gt(threshold)) {
          // If deviation exceeds 5%, skip this swap's tracked volume
          validatedAmountTotalUSDTracked = ZERO_BD
          validatedAmountTotalIPTracked = ZERO_BD
        } else {
          // Accept this swap's volume and update baseline smoothly (average of previous baseline and current price)
          let newBaseline = pool.token0Price.plus(currentSwapPrice).div(BigDecimal.fromString("2"))
          pool.token0Price = newBaseline
        }
      }
    }
    // ---- END VOLUME VALIDATION ----

    // global updates
    factory.txCount = factory.txCount.plus(ONE_BI)
    factory.totalVolumeIP = factory.totalVolumeIP.plus(validatedAmountTotalIPTracked)
    factory.totalVolumeUSD = factory.totalVolumeUSD.plus(validatedAmountTotalUSDTracked)
    factory.untrackedVolumeUSD = factory.untrackedVolumeUSD.plus(amountTotalUSDUntracked)
    // Fees computed from validated volumes
    const feesIP = validatedAmountTotalIPTracked
      .times(pool.feeTier.toBigDecimal())
      .div(BigDecimal.fromString("1000000"))
    const feesUSD = validatedAmountTotalUSDTracked
      .times(pool.feeTier.toBigDecimal())
      .div(BigDecimal.fromString("1000000"))

    // reset aggregate TVL before updating pool TVL
    const currentPoolTvlIP = pool.totalValueLockedIP
    factory.totalValueLockedIP = factory.totalValueLockedIP.minus(currentPoolTvlIP)

    // update pool volume and fees
    pool.volumeToken0 = pool.volumeToken0.plus(amount0Abs)
    pool.volumeToken1 = pool.volumeToken1.plus(amount1Abs)
    pool.volumeUSD = pool.volumeUSD.plus(validatedAmountTotalUSDTracked)
    pool.untrackedVolumeUSD = pool.untrackedVolumeUSD.plus(amountTotalUSDUntracked)
    pool.feesIP = pool.feesIP.plus(feesIP)
    pool.feesUSD = pool.feesUSD.plus(feesUSD)
    pool.txCount = pool.txCount.plus(ONE_BI)

    // update pool state with new liquidity, price, and tick.
    pool.liquidity = event.params.liquidity
    pool.tick = BigInt.fromI32(event.params.tick)
    pool.sqrtPrice = event.params.sqrtPriceX96
    pool.totalValueLockedToken0 = pool.totalValueLockedToken0.plus(amount0)
    pool.totalValueLockedToken1 = pool.totalValueLockedToken1.plus(amount1)

    // update token0 data
    token0.volume = token0.volume.plus(amount0Abs)
    token0.totalValueLocked = token0.totalValueLocked.plus(amount0)
    token0.volumeUSD = token0.volumeUSD.plus(validatedAmountTotalUSDTracked)
    token0.untrackedVolumeUSD = token0.untrackedVolumeUSD.plus(amountTotalUSDUntracked)
    token0.feesUSD = token0.feesUSD.plus(feesUSD)
    token0.txCount = token0.txCount.plus(ONE_BI)

    // update token1 data
    token1.volume = token1.volume.plus(amount1Abs)
    token1.totalValueLocked = token1.totalValueLocked.plus(amount1)
    token1.volumeUSD = token1.volumeUSD.plus(validatedAmountTotalUSDTracked)
    token1.untrackedVolumeUSD = token1.untrackedVolumeUSD.plus(amountTotalUSDUntracked)
    token1.feesUSD = token1.feesUSD.plus(feesUSD)
    token1.txCount = token1.txCount.plus(ONE_BI)

    // updated pool rates (update token0Price based on new sqrtPrice)
    const prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0 as Token, token1 as Token)
    pool.token0Price = prices[0]
    pool.token1Price = prices[1]
    pool.save()

    // update USD pricing from stablecoin pool (already capped earlier)
    log.info('[SWAP]: Updating IPPriceUSD: {}', [bundle.IPPriceUSD.toString()])

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

    updateTokenMarketCap(token0,bundle)
    updateTokenMarketCap(token1,bundle)

    /**
     * Update TVL and USD TVL
     */
    pool.totalValueLockedIP = pool.totalValueLockedToken0
      .times(token0.derivedIP)
      .plus(pool.totalValueLockedToken1.times(token1.derivedIP))
    pool.totalValueLockedUSD = pool.totalValueLockedIP.times(bundle.IPPriceUSD)

    // Retrieve PoolDayData from the updatePoolDayData function
    const poolDayData = updatePoolDayData(event)

    // --- NEW: Updated Fee APR Calculation using the PancakeSwap formula ---
    // Fee APR = (TVL * feePercent * 365) / (dailyVolume) * 100
    calculateFeeAPR(pool, poolDayData)

    factory.totalValueLockedIP = factory.totalValueLockedIP.plus(pool.totalValueLockedIP)
    factory.totalValueLockedUSD = factory.totalValueLockedIP.times(bundle.IPPriceUSD)

    token0.totalValueLockedUSD = token0.totalValueLocked.times(token0.derivedIP).times(bundle.IPPriceUSD)
    token1.totalValueLockedUSD = token1.totalValueLocked.times(token1.derivedIP).times(bundle.IPPriceUSD)

    // create Swap event
    const transaction = loadTransaction(event, pool.id)
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
    swap.amountUSD = validatedAmountTotalUSDTracked
    swap.tick = BigInt.fromI32(event.params.tick)
    swap.sqrtPriceX96 = event.params.sqrtPriceX96
    swap.logIndex = event.logIndex

    // interval data updates
    const storyhuntDayData = updateStoryHuntDayData(event, factoryAddress)
    // const poolDayData = updatePoolDayData(event) // moved higher
    const poolHourData = updatePoolHourData(event)
    const token0DayData = updateTokenDayData(token0 as Token, event)
    const token1DayData = updateTokenDayData(token1 as Token, event)
    const token0HourData = updateTokenHourData(token0 as Token, event)
    const token1HourData = updateTokenHourData(token1 as Token, event)
    const token0MinuteData = updateTokenMinuteData(token0 as Token, event)
    const token1MinuteData = updateTokenMinuteData(token1 as Token, event)

    // update volume metrics using validated volume
    storyhuntDayData.volumeIP = storyhuntDayData.volumeIP.plus(validatedAmountTotalIPTracked)
    storyhuntDayData.volumeUSD = storyhuntDayData.volumeUSD.plus(validatedAmountTotalUSDTracked)
    storyhuntDayData.feesUSD = storyhuntDayData.feesUSD.plus(feesUSD)

    poolDayData.volumeUSD = poolDayData.volumeUSD.plus(validatedAmountTotalUSDTracked)
    poolDayData.volumeToken0 = poolDayData.volumeToken0.plus(amount0Abs)
    poolDayData.volumeToken1 = poolDayData.volumeToken1.plus(amount1Abs)
    poolDayData.feesUSD = poolDayData.feesUSD.plus(feesUSD)

    poolHourData.volumeUSD = poolHourData.volumeUSD.plus(validatedAmountTotalUSDTracked)
    poolHourData.volumeToken0 = poolHourData.volumeToken0.plus(amount0Abs)
    poolHourData.volumeToken1 = poolHourData.volumeToken1.plus(amount1Abs)
    poolHourData.feesUSD = poolHourData.feesUSD.plus(feesUSD)

    token0DayData.volume = token0DayData.volume.plus(amount0Abs)
    token0DayData.volumeUSD = token0DayData.volumeUSD.plus(validatedAmountTotalUSDTracked)
    token0DayData.untrackedVolumeUSD = token0DayData.untrackedVolumeUSD.plus(validatedAmountTotalUSDTracked)
    token0DayData.feesUSD = token0DayData.feesUSD.plus(feesUSD)

    token0HourData.volume = token0HourData.volume.plus(amount0Abs)
    token0HourData.volumeUSD = token0HourData.volumeUSD.plus(validatedAmountTotalUSDTracked)
    token0HourData.untrackedVolumeUSD = token0HourData.untrackedVolumeUSD.plus(validatedAmountTotalUSDTracked)
    token0HourData.feesUSD = token0HourData.feesUSD.plus(feesUSD)

    token0MinuteData.volume = token0MinuteData.volume.plus(amount0Abs)
    token0MinuteData.volumeUSD = token0MinuteData.volumeUSD.plus(validatedAmountTotalUSDTracked)
    token0MinuteData.untrackedVolumeUSD = token0MinuteData.untrackedVolumeUSD.plus(validatedAmountTotalUSDTracked)
    token0MinuteData.feesUSD = token0MinuteData.feesUSD.plus(feesUSD)

    token1DayData.volume = token1DayData.volume.plus(amount1Abs)
    token1DayData.volumeUSD = token1DayData.volumeUSD.plus(validatedAmountTotalUSDTracked)
    token1DayData.untrackedVolumeUSD = token1DayData.untrackedVolumeUSD.plus(validatedAmountTotalUSDTracked)
    token1DayData.feesUSD = token1DayData.feesUSD.plus(feesUSD)

    token1HourData.volume = token1HourData.volume.plus(amount1Abs)
    token1HourData.volumeUSD = token1HourData.volumeUSD.plus(validatedAmountTotalUSDTracked)
    token1HourData.untrackedVolumeUSD = token1HourData.untrackedVolumeUSD.plus(validatedAmountTotalUSDTracked)
    token1HourData.feesUSD = token1HourData.feesUSD.plus(feesUSD)

    token1MinuteData.volume = token1MinuteData.volume.plus(amount1Abs)
    token1MinuteData.volumeUSD = token1MinuteData.volumeUSD.plus(validatedAmountTotalUSDTracked)
    token1MinuteData.untrackedVolumeUSD = token1MinuteData.untrackedVolumeUSD.plus(validatedAmountTotalUSDTracked)
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

/**
 * Updated Fee APR Calculation using the PancakeSwap-style formula:
 *
 * Fee APR = ((TVL * feePercent * 365) / (Daily Volume)) * 100
 *
 * - TVL is taken from pool.totalValueLockedIP (or USD).
 * - feePercent is calculated from pool.feeTier / 1,000,000.
 * - Daily Volume is taken from poolDayData.volumeUSD.
 *
 * This function uses safe division to avoid division by zero.
 */
function calculateFeeAPR(
  pool: Pool,
  poolDayData: PoolDayData
): void {
  // Convert feeTier to a fee percentage (e.g., 3000 becomes 0.003)
  let feePercent: BigDecimal = pool.feeTier.toBigDecimal().div(BigDecimal.fromString("1000000"));
  
  if (poolDayData.volumeUSD.equals(ZERO_BD)) {
    pool.feeAPRIP = ZERO_BD;
    pool.feeAPRUSD = ZERO_BD;
  } else {
    pool.feeAPRIP = safeDiv(
      pool.totalValueLockedIP.times(feePercent).times(BigDecimal.fromString("365")),
      poolDayData.volumeUSD
    ).times(BigDecimal.fromString("100"));
    pool.feeAPRUSD = safeDiv(
      pool.totalValueLockedUSD.times(feePercent).times(BigDecimal.fromString("365")),
      poolDayData.volumeUSD
    ).times(BigDecimal.fromString("100"));
  }
  pool.save();
}