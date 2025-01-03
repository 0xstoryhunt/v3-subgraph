import { BigInt } from '@graphprotocol/graph-ts'

import { Bundle, Collect, Factory, Pool, Token } from '../../types/schema'
import { Collect as CollectEvent } from '../../types/templates/Pool/Pool'
import { convertTokenToDecimal, loadTransaction } from '../../utils'
import { getSubgraphConfig, SubgraphConfig } from '../../utils/chains'
import { ONE_BI } from '../../utils/constants'
import {
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
  updateTokenHourData,
  updateStoryHuntDayData,
  updateTokenMinuteData,
} from '../../utils/intervalUpdates'
import { getTrackedAmountUSD } from '../../utils/pricing'

export function handleCollect(event: CollectEvent): void {
  handleCollectHelper(event)
}

export function handleCollectHelper(event: CollectEvent, subgraphConfig: SubgraphConfig = getSubgraphConfig()): void {
  const factoryAddress = subgraphConfig.factoryAddress
  const whitelistTokens = subgraphConfig.whitelistTokens

  const bundle = Bundle.load('1')!
  const pool = Pool.load(event.address.toHexString())
  if (pool == null) {
    return
  }
  const transaction = loadTransaction(event, pool.id)
  const factory = Factory.load(factoryAddress)!

  const token0 = Token.load(pool.token0)
  const token1 = Token.load(pool.token1)
  if (token0 == null || token1 == null) {
    return
  }

  // Get formatted amounts collected.
  const collectedAmountToken0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  const collectedAmountToken1 = convertTokenToDecimal(event.params.amount1, token1.decimals)
  const trackedCollectedAmountUSD = getTrackedAmountUSD(
    collectedAmountToken0,
    token0 as Token,
    collectedAmountToken1,
    token1 as Token,
    whitelistTokens,
  )

  // Reset tvl aggregates until new amounts calculated
  factory.totalValueLockedIP = factory.totalValueLockedIP.minus(pool.totalValueLockedIP)

  // Update globals
  factory.txCount = factory.txCount.plus(ONE_BI)

  // update token data
  token0.txCount = token0.txCount.plus(ONE_BI)
  token0.totalValueLocked = token0.totalValueLocked.minus(collectedAmountToken0)
  token0.totalValueLockedUSD = token0.totalValueLocked.times(token0.derivedIP.times(bundle.IPPriceUSD))

  token1.txCount = token1.txCount.plus(ONE_BI)
  token1.totalValueLocked = token1.totalValueLocked.minus(collectedAmountToken1)
  token1.totalValueLockedUSD = token1.totalValueLocked.times(token1.derivedIP.times(bundle.IPPriceUSD))

  // Adjust pool TVL based on amount collected.
  pool.txCount = pool.txCount.plus(ONE_BI)
  pool.totalValueLockedToken0 = pool.totalValueLockedToken0.minus(collectedAmountToken0)
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1.minus(collectedAmountToken1)
  pool.totalValueLockedIP = pool.totalValueLockedToken0
    .times(token0.derivedIP)
    .plus(pool.totalValueLockedToken1.times(token1.derivedIP))
  pool.totalValueLockedUSD = pool.totalValueLockedIP.times(bundle.IPPriceUSD)

  // Update aggregate fee collection values.
  pool.collectedFeesToken0 = pool.collectedFeesToken0.plus(collectedAmountToken0)
  pool.collectedFeesToken1 = pool.collectedFeesToken1.plus(collectedAmountToken1)
  pool.collectedFeesUSD = pool.collectedFeesUSD.plus(trackedCollectedAmountUSD)

  // reset aggregates with new amounts
  factory.totalValueLockedIP = factory.totalValueLockedIP.plus(pool.totalValueLockedIP)
  factory.totalValueLockedUSD = factory.totalValueLockedIP.times(bundle.IPPriceUSD)

  const collect = new Collect(transaction.id + '-' + event.logIndex.toString())
  collect.transaction = transaction.id
  collect.timestamp = event.block.timestamp
  collect.pool = pool.id
  collect.owner = event.params.owner
  collect.amount0 = collectedAmountToken0
  collect.amount1 = collectedAmountToken1
  collect.amountUSD = trackedCollectedAmountUSD
  collect.tickLower = BigInt.fromI32(event.params.tickLower)
  collect.tickUpper = BigInt.fromI32(event.params.tickUpper)
  collect.logIndex = event.logIndex
  collect.from = event.transaction.from.toHexString()

  updateStoryHuntDayData(event, factoryAddress)
  updatePoolDayData(event)
  updatePoolHourData(event)
  updateTokenDayData(token0 as Token, event)
  updateTokenDayData(token1 as Token, event)
  updateTokenHourData(token0 as Token, event)
  updateTokenHourData(token1 as Token, event)
  updateTokenMinuteData(token0 as Token, event)
  updateTokenMinuteData(token1 as Token, event)

  token0.save()
  token1.save()
  factory.save()
  pool.save()
  collect.save()

  return
}
