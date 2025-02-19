import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'

import {
  Bundle,
  Factory,
  Pool,
  PoolDayData,
  PoolHourData,
  Token,
  TokenDayData,
  TokenHourData,
  TokenMinuteData,
  StoryHuntDayData,
} from './../types/schema'
import { ONE_BI, ZERO_BD, ZERO_BI } from './constants'
import { exponentToBigDecimal, safeDiv } from '.'

/**
 * Tracks global aggregate data over daily windows
 * @param event
 */
export function updateStoryHuntDayData(event: ethereum.Event, factoryAddress: string): StoryHuntDayData {
  const storyhunt = Factory.load(factoryAddress)!
  const timestamp = event.block.timestamp.toI32()
  const dayID = timestamp / 86400 // rounded
  const dayStartTimestamp = dayID * 86400
  let storyhuntDayData = StoryHuntDayData.load(dayID.toString())
  if (storyhuntDayData === null) {
    storyhuntDayData = new StoryHuntDayData(dayID.toString())
    storyhuntDayData.date = dayStartTimestamp
    storyhuntDayData.volumeIP = ZERO_BD
    storyhuntDayData.volumeUSD = ZERO_BD
    storyhuntDayData.volumeUSDUntracked = ZERO_BD
    storyhuntDayData.feesUSD = ZERO_BD
  }
  storyhuntDayData.tvlUSD = storyhunt.totalValueLockedUSD
  storyhuntDayData.txCount = storyhunt.txCount
  storyhuntDayData.save()
  return storyhuntDayData as StoryHuntDayData
}

export function updatePoolDayData(event: ethereum.Event): PoolDayData {
  const timestamp = event.block.timestamp.toI32()
  const dayID = timestamp / 86400
  const dayStartTimestamp = dayID * 86400
  const dayPoolID = event.address.toHexString().concat('-').concat(dayID.toString())
  const pool = Pool.load(event.address.toHexString())!
  let poolDayData = PoolDayData.load(dayPoolID)
  if (poolDayData === null) {
    poolDayData = new PoolDayData(dayPoolID)
    poolDayData.date = dayStartTimestamp
    poolDayData.pool = pool.id
    // things that dont get initialized always
    poolDayData.volumeToken0 = ZERO_BD
    poolDayData.volumeToken1 = ZERO_BD
    poolDayData.volumeUSD = ZERO_BD
    poolDayData.feesUSD = ZERO_BD
    poolDayData.txCount = ZERO_BI
    poolDayData.open = pool.token0Price
    poolDayData.high = pool.token0Price
    poolDayData.low = pool.token0Price
    poolDayData.close = pool.token0Price
  }

  if (pool.token0Price.gt(poolDayData.high)) {
    poolDayData.high = pool.token0Price
  }
  if (pool.token0Price.lt(poolDayData.low)) {
    poolDayData.low = pool.token0Price
  }

  poolDayData.liquidity = pool.liquidity
  poolDayData.sqrtPrice = pool.sqrtPrice
  poolDayData.token0Price = pool.token0Price
  poolDayData.token1Price = pool.token1Price
  poolDayData.close = pool.token0Price
  poolDayData.tick = pool.tick
  poolDayData.tvlUSD = pool.totalValueLockedUSD
  poolDayData.txCount = poolDayData.txCount.plus(ONE_BI)
  poolDayData.save()

  return poolDayData as PoolDayData
}

export function updatePoolHourData(event: ethereum.Event): PoolHourData {
  const timestamp = event.block.timestamp.toI32()
  const hourIndex = timestamp / 3600 // get unique hour within unix history
  const hourStartUnix = hourIndex * 3600 // want the rounded effect
  const hourPoolID = event.address.toHexString().concat('-').concat(hourIndex.toString())
  const pool = Pool.load(event.address.toHexString())!
  let poolHourData = PoolHourData.load(hourPoolID)
  if (poolHourData === null) {
    poolHourData = new PoolHourData(hourPoolID)
    poolHourData.periodStartUnix = hourStartUnix
    poolHourData.pool = pool.id
    // things that dont get initialized always
    poolHourData.volumeToken0 = ZERO_BD
    poolHourData.volumeToken1 = ZERO_BD
    poolHourData.volumeUSD = ZERO_BD
    poolHourData.txCount = ZERO_BI
    poolHourData.feesUSD = ZERO_BD
    poolHourData.open = pool.token0Price
    poolHourData.high = pool.token0Price
    poolHourData.low = pool.token0Price
    poolHourData.close = pool.token0Price
  }

  if (pool.token0Price.gt(poolHourData.high)) {
    poolHourData.high = pool.token0Price
  }
  if (pool.token0Price.lt(poolHourData.low)) {
    poolHourData.low = pool.token0Price
  }

  poolHourData.liquidity = pool.liquidity
  poolHourData.sqrtPrice = pool.sqrtPrice
  poolHourData.token0Price = pool.token0Price
  poolHourData.token1Price = pool.token1Price
  poolHourData.close = pool.token0Price
  poolHourData.tick = pool.tick
  poolHourData.tvlUSD = pool.totalValueLockedUSD
  poolHourData.txCount = poolHourData.txCount.plus(ONE_BI)
  poolHourData.save()

  // test
  return poolHourData as PoolHourData
}

export function updateTokenDayData(token: Token, event: ethereum.Event): TokenDayData {
  const bundle = Bundle.load('1')!
  const timestamp = event.block.timestamp.toI32()
  const dayID = timestamp / 86400
  const dayStartTimestamp = dayID * 86400
  const tokenDayID = token.id.toString().concat('-').concat(dayID.toString())
  const tokenPrice = token.derivedIP.times(bundle.IPPriceUSD)

  let tokenDayData = TokenDayData.load(tokenDayID)
  if (tokenDayData === null) {
    tokenDayData = new TokenDayData(tokenDayID)
    tokenDayData.date = dayStartTimestamp
    tokenDayData.token = token.id
    tokenDayData.volume = ZERO_BD
    tokenDayData.volumeUSD = ZERO_BD
    tokenDayData.feesUSD = ZERO_BD
    tokenDayData.untrackedVolumeUSD = ZERO_BD
    tokenDayData.open = tokenPrice
    tokenDayData.high = tokenPrice
    tokenDayData.low = tokenPrice
    tokenDayData.close = tokenPrice
  }

  if (tokenPrice.gt(tokenDayData.high)) {
    tokenDayData.high = tokenPrice
  }

  if (tokenPrice.lt(tokenDayData.low)) {
    tokenDayData.low = tokenPrice
  }

  tokenDayData.close = tokenPrice
  tokenDayData.priceUSD = token.derivedIP.times(bundle.IPPriceUSD)
  tokenDayData.totalValueLocked = token.totalValueLocked
  tokenDayData.totalValueLockedUSD = token.totalValueLockedUSD
  tokenDayData.save()

  return tokenDayData as TokenDayData
}

export function updateTokenHourData(token: Token, event: ethereum.Event): TokenHourData {
  const bundle = Bundle.load('1')!
  const timestamp = event.block.timestamp.toI32()
  const hourIndex = timestamp / 3600 // get unique hour within unix history
  const hourStartUnix = hourIndex * 3600 // want the rounded effect
  const tokenHourID = token.id.toString().concat('-').concat(hourIndex.toString())
  let tokenHourData = TokenHourData.load(tokenHourID)
  const tokenPrice = token.derivedIP.times(bundle.IPPriceUSD)

  if (tokenHourData === null) {
    tokenHourData = new TokenHourData(tokenHourID)
    tokenHourData.periodStartUnix = hourStartUnix
    tokenHourData.token = token.id
    tokenHourData.volume = ZERO_BD
    tokenHourData.volumeUSD = ZERO_BD
    tokenHourData.untrackedVolumeUSD = ZERO_BD
    tokenHourData.feesUSD = ZERO_BD
    tokenHourData.open = tokenPrice
    tokenHourData.high = tokenPrice
    tokenHourData.low = tokenPrice
    tokenHourData.close = tokenPrice
  }

  if (tokenPrice.gt(tokenHourData.high)) {
    tokenHourData.high = tokenPrice
  }

  if (tokenPrice.lt(tokenHourData.low)) {
    tokenHourData.low = tokenPrice
  }

  tokenHourData.close = tokenPrice
  tokenHourData.priceUSD = tokenPrice
  tokenHourData.totalValueLocked = token.totalValueLocked
  tokenHourData.totalValueLockedUSD = token.totalValueLockedUSD
  tokenHourData.save()

  return tokenHourData as TokenHourData
}

export function updateTokenMinuteData(token: Token, event: ethereum.Event): TokenMinuteData {
  const bundle = Bundle.load('1')!
  const timestamp = event.block.timestamp.toI32()
  const hourIndex = timestamp / 60 // get unique minute within unix history
  const hourStartUnix = hourIndex * 60 // want the rounded effect
  const tokenHourID = token.id.toString().concat('-').concat(hourIndex.toString())
  let tokenMinuteData = TokenMinuteData.load(tokenHourID)
  const tokenPrice = token.derivedIP.times(bundle.IPPriceUSD)

  if (tokenMinuteData === null) {
    tokenMinuteData = new TokenMinuteData(tokenHourID)
    tokenMinuteData.periodStartUnix = hourStartUnix
    tokenMinuteData.token = token.id
    tokenMinuteData.volume = ZERO_BD
    tokenMinuteData.volumeUSD = ZERO_BD
    tokenMinuteData.untrackedVolumeUSD = ZERO_BD
    tokenMinuteData.feesUSD = ZERO_BD
    tokenMinuteData.open = tokenPrice
    tokenMinuteData.high = tokenPrice
    tokenMinuteData.low = tokenPrice
    tokenMinuteData.close = tokenPrice
  }

  if (tokenPrice.gt(tokenMinuteData.high)) {
    tokenMinuteData.high = tokenPrice
  }

  if (tokenPrice.lt(tokenMinuteData.low)) {
    tokenMinuteData.low = tokenPrice
  }

  tokenMinuteData.close = tokenPrice
  tokenMinuteData.priceUSD = tokenPrice
  tokenMinuteData.totalValueLocked = token.totalValueLocked
  tokenMinuteData.totalValueLockedUSD = token.totalValueLockedUSD
  tokenMinuteData.save()

  return tokenMinuteData as TokenMinuteData
}



export function updateTokenMarketCap(token: Token, whitelistTokens: string[], eventTimestamp: BigInt): void {
  // Only update totalSupply from chain if the token is whitelisted and if it hasn't been updated in the last 12 hours.
  // if (whitelistTokens.includes(token.id.toLowerCase())) {
  //   // If lastMarketCapUpdate is null, update immediately.
  //   if (token.lastMarketCapUpdate === null) {
  //     let newTotalSupply = fetchTokenTotalSupply(Address.fromString(token.id))
  //     // Only update if we got a non-zero total supply.
  //     if (newTotalSupply.gt(BigInt.zero())) {
  //       token.totalSupply = newTotalSupply
  //       token.lastMarketCapUpdate = eventTimestamp
  //     }
  //   } else {
  //     // Check if at least 12 hours (43200 seconds) have passed.
  //     if (eventTimestamp.minus(token.lastMarketCapUpdate!) >= BigInt.fromI32(43200)) {
  //       let newTotalSupply = fetchTokenTotalSupply(Address.fromString(token.id))
  //       if (newTotalSupply.gt(BigInt.zero())) {
  //         token.totalSupply = newTotalSupply
  //         token.lastMarketCapUpdate = eventTimestamp
  //       }
  //     }
  //   }
  // }

  // Convert totalSupply (BigInt) to BigDecimal in token units.
  let supply = token.totalSupply.toBigDecimal().div(exponentToBigDecimal(token.decimals));
  
  // Calculate ratio = totalValueLockedUSD / totalValueLocked using safeDiv.
  let ratio = safeDiv(token.totalValueLockedUSD, token.totalValueLocked);
  
  // New market cap formula: marketCapToken = supply * (totalValueLockedUSD / totalValueLocked)
  token.marketCap = supply.times(ratio);
  token.save();
}