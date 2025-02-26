import { Address, BigInt, dataSource, log } from '@graphprotocol/graph-ts'
import {
  AddPool,
  SetPool,
  Deposit,
  Withdraw,
  Harvest,           // new Harvest event type (without token)
  UpdateLiquidity,
  NewUpkeepPeriod,   // new NewUpkeepPeriod event type (without token)
  UpdateUpkeepPeriod, // new UpdateUpkeepPeriod event type (without token)
  NewPeriodDuration,
} from '../../types/AlphaHunterV3/AlphaHunter'  // Ensure these types are generated from the new ABI
import { LMPool, LMTransaction, Pool, Position, AlphaHunter, RewardPeriod, RewardToken, PositionReward, Token } from '../../types/schema'
import { ZERO_BD, WIP_ADDRESS, ZERO_BI, ADDRESS_ZERO } from '../../utils/constants'
import { getPosition } from '../position-manager'
/**
 * Helper function to get or create AlphaHunter entity.
 * Here, we do not attempt to derive the reward token from the contract;
 * we simply rely on WIP_ADDRESS in event handlers.
 */
function getOrCreateAlphaHunter(): AlphaHunter {
  let alphaHunter = AlphaHunter.load(dataSource.address().toHexString())
  if (!alphaHunter) {
    alphaHunter = new AlphaHunter(dataSource.address().toHexString())
    alphaHunter.totalAllocPoint = ZERO_BI
    alphaHunter.timestamp = ZERO_BI
    alphaHunter.block = ZERO_BI
    // No rewardToken initialization here; we will use WIP_ADDRESS as fallback.
  }
  return alphaHunter
}

/**
 * Handles the AddPool event.
 */
export function handleAddPool(event: AddPool): void {
  let lmPool = new LMPool(event.params.pid.toString())
  let v3Pool = Pool.load(event.params.v3Pool.toHexString())

  lmPool.id = event.params.pid.toString()
  lmPool.pool = v3Pool ? v3Pool.id : event.params.v3Pool.toHexString()
  lmPool.allocPoint = event.params.allocPoint
  lmPool.stakedLiquidity = ZERO_BD
  lmPool.stakedLiquidityUSD = ZERO_BD
  lmPool.tvl = ZERO_BD
  lmPool.tvlUSD = ZERO_BD
  lmPool.volume = ZERO_BD
  lmPool.volumeUSD = ZERO_BD

  if (v3Pool) {
    v3Pool.lmPool = lmPool.id
    v3Pool.save()
  }

  let alphaHunter = getOrCreateAlphaHunter()
  alphaHunter.totalAllocPoint = alphaHunter.totalAllocPoint.plus(event.params.allocPoint)
  alphaHunter.save()

  lmPool.alphaHunter = alphaHunter.id
  lmPool.save()
}

/**
 * Handles the SetPool event.
 */
export function handleSetPool(event: SetPool): void {
  let lmPool = LMPool.load(event.params.pid.toString())
  if (!lmPool) return

  let alphaHunter = getOrCreateAlphaHunter()
  alphaHunter.totalAllocPoint = alphaHunter.totalAllocPoint.minus(lmPool.allocPoint).plus(event.params.allocPoint)

  lmPool.allocPoint = event.params.allocPoint
  lmPool.save()
  alphaHunter.save()
}

/**
 * Handles the Deposit event.
 */
export function handleDeposit(event: Deposit): void {
  let lmPool = LMPool.load(event.params.pid.toString())
  
  let position = getPosition(event, event.params.tokenId)
  if (!lmPool || !position) return

  let transaction = new LMTransaction(event.transaction.hash.toHex())
  transaction.type = 'Stake'
  transaction.user = event.params.from
  transaction.pool = lmPool.id
  transaction.amount = event.params.liquidity.toBigDecimal()
  transaction.reward = ZERO_BD
  transaction.timestamp = event.block.timestamp

  // Update pool stats
  lmPool.stakedLiquidity = lmPool.stakedLiquidity.plus(transaction.amount)
  lmPool.tvl = lmPool.stakedLiquidity

  // Update position
  position.staker = event.params.from
  position.tickLowerInt = BigInt.fromI32(event.params.tickLower)
  position.tickUpperInt = BigInt.fromI32(event.params.tickUpper)
  position.isStaked = true
  position.lmPool = lmPool.id

  // Save entities
  position.save()
  lmPool.save()
  transaction.save()
}

/**
 * Handles the Withdraw event.
 */
export function handleWithdraw(event: Withdraw): void {
  let lmPool = LMPool.load(event.params.pid.toString())
  let position = getPosition(event, event.params.tokenId)
  if (!lmPool || !position) return

  let transaction = new LMTransaction(event.transaction.hash.toHex())
  transaction.type = 'Unstake'
  transaction.user = event.params.from
  transaction.pool = lmPool.id
  transaction.amount = position.liquidity.toBigDecimal() // If needed, calculate actual liquidity removed
  transaction.reward = ZERO_BD
  transaction.timestamp = event.block.timestamp

  // Update pool stats
  lmPool.stakedLiquidity = lmPool.stakedLiquidity.minus(transaction.amount)
  if (lmPool.stakedLiquidity.lt(ZERO_BD)) {
    lmPool.stakedLiquidity = ZERO_BD
  }
  lmPool.tvl = lmPool.stakedLiquidity

  // Update position
  position.staker = Address.fromString(ADDRESS_ZERO)
  position.isStaked = false
  position.lmPool = lmPool.id

  // Save entities
  lmPool.save()
  transaction.save()
  position.save()
}

/**
 * Handles the Harvest event.
 * New signature: Harvest(indexed address sender, address to, indexed uint256 tokenId, indexed uint256 pid, uint256 reward)
 * Since no token parameter is provided, we set the reward token to WIP_ADDRESS.
 */
export function handleHarvest(event: Harvest): void {
  let positionId = event.params.tokenId.toString()
  let rewardId = `${positionId}-${WIP_ADDRESS}`

  let reward = PositionReward.load(rewardId)
  if (!reward) {
    reward = new PositionReward(rewardId)
    reward.position = positionId
    reward.token = WIP_ADDRESS
    reward.earned = ZERO_BD
  }

  reward.earned = reward.earned.plus(event.params.reward.toBigDecimal())
  reward.save()

  let transaction = new LMTransaction(event.transaction.hash.toHex())
  transaction.type = "Harvest"
  transaction.user = event.params.sender
  transaction.pool = event.params.pid.toString()
  transaction.amount = ZERO_BD
  transaction.reward = event.params.reward.toBigDecimal()
  transaction.timestamp = event.block.timestamp
  transaction.save()
}

/**
 * Handles the UpdateLiquidity event.
 */
export function handleUpdateLiquidity(event: UpdateLiquidity): void {
  let lmPool = LMPool.load(event.params.pid.toString())
  let position = getPosition(event, event.params.tokenId)


  let liquidityDelta = event.params.liquidity
  lmPool.stakedLiquidity = lmPool.stakedLiquidity.plus(liquidityDelta.toBigDecimal())
  
  lmPool.tvl = lmPool.stakedLiquidity
  lmPool.save()
  
  //position.liquidity = position.liquidity.plus(liquidityDelta)
  position.tickLowerInt = BigInt.fromI32(event.params.tickLower)
  position.tickUpperInt = BigInt.fromI32(event.params.tickUpper)
  position.lmPool = lmPool.id

  position.save()
}

/**
 * Handles the NewUpkeepPeriod event.
 */
export function handleNewUpkeepPeriod(event: NewUpkeepPeriod): void {
  let alphaHunter = getOrCreateAlphaHunter()
  let periodId = event.params.periodNumber.toString()
  let rewardPeriod = new RewardPeriod(periodId)
  
  rewardPeriod.alphaHunter = alphaHunter.id
  rewardPeriod.id = periodId
  rewardPeriod.periodNumber = event.params.periodNumber
  rewardPeriod.save()
  
  let rewardTokenId = `${WIP_ADDRESS}-${periodId}`
  let rewardToken = new RewardToken(rewardTokenId)
  rewardToken.rewardPeriod = rewardPeriod.id
  rewardToken.token = WIP_ADDRESS
  rewardToken.rewardRate = event.params.rewardPerSecond.toBigDecimal()
  rewardToken.startTime = event.params.startTime
  rewardToken.endTime = event.params.endTime
  rewardToken.save()
}

/**
 * Handles the UpdateUpkeepPeriod event.
 */
export function handleUpdateUpkeepPeriod(event: UpdateUpkeepPeriod): void {
  let periodId = event.params.periodNumber.toString()
  let rewardTokenId = `${WIP_ADDRESS}-${periodId}`
  let rewardToken = RewardToken.load(rewardTokenId)
  
  if (!rewardToken) {
    log.error("Failed to load reward token for period {}", [periodId])
    return
  }

  rewardToken.endTime = event.params.newEndTime
  rewardToken.save()
}

/**
 * Handles the NewPeriodDuration event.
 */
export function handleNewPeriodDuration(event: NewPeriodDuration): void {
  // Implementation if needed
}
