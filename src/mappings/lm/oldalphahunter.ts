import { Address, BigInt, dataSource } from '@graphprotocol/graph-ts'
import {
  AddPool,
  SetPool,
  Deposit,
  Withdraw,
  Harvest,
  UpdateLiquidity,
  NewUpkeepPeriod,
  UpdateUpkeepPeriod,
  NewPeriodDuration,
} from '../../types/OldAlphaHunterV3/OldAlphaHunterV3'
import { LMPool, LMTransaction, Pool, Position, AlphaHunter, RewardPeriod, RewardToken, PositionReward, Token } from '../../types/schema'
import { ZERO_BD, ADDRESS_ZERO, ZERO_BI } from '../../utils/constants'
import { populateToken } from '../../backfill'
import { getSubgraphConfig, SubgraphConfig } from '../../utils/chains'

/**
 * Helper function to get or create MasterChef entity.
 */
function getOrCreateAlphaHunter(): AlphaHunter {
  let alphaHunter = AlphaHunter.load(dataSource.address().toHexString())
  if (!alphaHunter) {
    alphaHunter = new AlphaHunter(dataSource.address().toHexString())
    alphaHunter.totalAllocPoint = ZERO_BI
    alphaHunter.timestamp = ZERO_BI
    alphaHunter.block = ZERO_BI
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
  let position = Position.load(event.params.tokenId.toString())
  if (!lmPool || !position) return

  let transaction = new LMTransaction(event.transaction.hash.toHex())
  transaction.type = 'Stake'
  transaction.user = event.params.from.toHexString()
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
  let position = Position.load(event.params.tokenId.toString())
  if (!lmPool || !position) return

  let transaction = new LMTransaction(event.transaction.hash.toHex())
  transaction.type = 'Unstake'
  transaction.user = event.params.from.toHexString()
  transaction.pool = lmPool.id
  transaction.amount = position.liquidity.toBigDecimal() // If needed, calculate actual 'liquidity removed'
  transaction.reward = ZERO_BD
  transaction.timestamp = event.block.timestamp

  // Update pool stats
  lmPool.stakedLiquidity = lmPool.stakedLiquidity.minus(transaction.amount)
  if (lmPool.stakedLiquidity.lt(ZERO_BD)) {
    // Prevent negative staked liquidity due to partial data
    lmPool.stakedLiquidity = ZERO_BD
  }
  lmPool.tvl = lmPool.stakedLiquidity

  // Update position
  position.staker = Address.fromString(ADDRESS_ZERO)
  position.isStaked = false

  // Save entities
  lmPool.save()
  transaction.save()
  position.save()
}

/**
 * Handles the Harvest event.
 */

export function handleHarvest(event: Harvest): void {
  let positionId = event.params.tokenId.toString();
  let rewardId = `${positionId}-${event.params.token.toHexString()}`;

  let reward = PositionReward.load(rewardId);
  if (!reward) {
    reward = new PositionReward(rewardId);
    reward.position = positionId;
    reward.token = event.params.token.toHexString();
    reward.earned = ZERO_BD;
  }

  reward.earned = reward.earned.plus(event.params.reward.toBigDecimal());
  reward.save();

  let transaction = new LMTransaction(event.transaction.hash.toHex());
  transaction.type = "Harvest";
  transaction.user = event.params.sender.toHexString();
  transaction.pool = event.params.pid.toString();
  transaction.amount = ZERO_BD;
  transaction.reward = event.params.reward.toBigDecimal();
  transaction.timestamp = event.block.timestamp;
  transaction.save();
}


/**
 * Handles the UpdateLiquidity event.
 */
export function handleUpdateLiquidity(event: UpdateLiquidity): void {
  let lmPool = LMPool.load(event.params.pid.toString())
  let position = Position.load(event.params.tokenId.toString())
  if (!lmPool || !position) return
  let liquidityDelta = event.params.liquidity;
  lmPool.stakedLiquidity = lmPool.stakedLiquidity.plus(liquidityDelta.toBigDecimal())
  
  lmPool.tvl = lmPool.stakedLiquidity
  lmPool.save()
  position.liquidity = position.liquidity.plus(liquidityDelta)
  position.tickLowerInt = BigInt.fromI32(event.params.tickLower)
  position.tickUpperInt = BigInt.fromI32(event.params.tickUpper)
  position.save()
}


export function handleNewUpkeepPeriodHelper(
  event: NewUpkeepPeriod,
  subgraphConfig: SubgraphConfig = getSubgraphConfig(),
): void {
  const tokenOverrides = subgraphConfig.tokenOverrides
  let token = Token.load(event.params.token.toHexString());
  if(!token){
    populateToken(event.params.token.toHexString(),tokenOverrides);
  }
}

  
/**
 * Handles the NewUpkeepPeriod event.
 */
export function handleNewUpkeepPeriod(event: NewUpkeepPeriod): void {
  let alphaHunter = getOrCreateAlphaHunter()
  let periodId = event.params.periodNumber.toString();
  let rewardPeriod = RewardPeriod.load(periodId);

  if (!rewardPeriod) {
    rewardPeriod = new RewardPeriod(periodId);
    rewardPeriod.alphaHunter = alphaHunter.id // Assuming period number matches pool ID
    rewardPeriod.id = periodId;
    rewardPeriod.periodNumber = event.params.periodNumber;
    rewardPeriod.save();
  }

  handleNewUpkeepPeriodHelper(event);

  let rewardTokenId = `${event.params.token.toHexString()}-${periodId}`;
  let rewardToken = new RewardToken(rewardTokenId);
  rewardToken.rewardPeriod = rewardPeriod.id;
  rewardToken.token = event.params.token.toHexString();
  rewardToken.rewardRate = event.params.huntPerSecond.toBigDecimal();
  rewardToken.startTime = event.params.startTime;
  rewardToken.endTime = event.params.endTime;
  rewardToken.save();
}

/**
 * Handles the UpdateUpkeepPeriod event.
 */
export function handleUpdateUpkeepPeriod(event: UpdateUpkeepPeriod): void {
  let periodId = event.params.periodNumber.toString();
  let rewardTokenId = `${event.params.token.toHexString()}-${periodId}`;
  let rewardToken = RewardToken.load(rewardTokenId);

  if (!rewardToken) return;

  rewardToken.endTime = event.params.newEndTime;
  rewardToken.save();
}

/**
 * Handles the NewPeriodDuration event. (If needed)
 */
export function handleNewPeriodDuration(event: NewPeriodDuration): void {}
