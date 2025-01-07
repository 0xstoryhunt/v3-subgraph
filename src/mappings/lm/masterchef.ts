import { BigDecimal, Address, dataSource, BigInt } from "@graphprotocol/graph-ts";
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
} from "../../types/MasterChefV3/MasterChefV3";
import { LMPool, RewardPeriod, LMTransaction, Pool, MasterChef, Position } from "../../types/schema";
import { getTokenPriceUSD } from "../../utils";
import { ONE_BI, ZERO_BD } from "../../utils/constants";

const SECONDS_IN_YEAR = BigDecimal.fromString("31536000");

/**
 * Handles AddPool event.
 */
export function handleAddPool(event: AddPool): void {
  let lmPool = new LMPool(event.params.pid.toString());
  let v3Pool = Pool.load(event.params.v3Pool.toHexString());
  // let masterChef = MasterChef.load(dataSource.address().toHex());
  // if(!masterChef) return;

  lmPool.id = event.params.pid.toString();
  lmPool.pool = v3Pool ? v3Pool.id : event.params.v3Pool.toHexString();
  lmPool.rewardToken = event.params.lmPool.toHexString();
  lmPool.rewardRate = ZERO_BD;
  lmPool.allocPoint = event.params.allocPoint;
  lmPool.stakedLiquidity = ZERO_BD;
  lmPool.stakedLiquidityUSD = ZERO_BD;
  lmPool.tvl = ZERO_BD;
  lmPool.tvlUSD = ZERO_BD;
  lmPool.volume = ZERO_BD;
  lmPool.volumeUSD = ZERO_BD;
  lmPool.apr = ZERO_BD;
  //lmPool.masterChef = masterChef.id;

  if (v3Pool && lmPool) {
    v3Pool.lmPool = lmPool.id
    v3Pool.save()
  }

  lmPool.save();

  // if(!masterChef) return;
  // masterChef.totalAllocPoint = masterChef.totalAllocPoint.plus(lmPool.allocPoint);
  // masterChef.poolCount = masterChef.poolCount.plus(ONE_BI);
  // masterChef.save();
}


/**
 * Handles SetPool event.
 */
export function handleSetPool(event: SetPool): void {
  let lmPool = LMPool.load(event.params.pid.toString());
  //let masterChef = MasterChef.load(dataSource.address().toHex());

  if (!lmPool) return;

  // masterChef.totalAllocPoint = masterChef.totalAllocPoint.minus(lmPool.allocPoint).plus(event.params.allocPoint);
  // masterChef.save();

  lmPool.allocPoint = event.params.allocPoint;
  lmPool.save();
}

/**
 * Handles Deposit event.
 */
export function handleDeposit(event: Deposit): void {
  let lmPool = LMPool.load(event.params.pid.toString());
  let position = Position.load(event.params.pid.toString());
  if (!lmPool || !position) return;

  let transaction = new LMTransaction(event.transaction.hash.toHex());
  transaction.type = "Deposit";
  transaction.user = event.params.from;
  transaction.pool = lmPool.id;
  transaction.amount = event.params.liquidity.toBigDecimal();
  transaction.reward = ZERO_BD;
  transaction.timestamp = event.block.timestamp;

  lmPool.stakedLiquidity = lmPool.stakedLiquidity.plus(transaction.amount);
  lmPool.stakedLiquidityUSD = lmPool.stakedLiquidity.times(getTokenPriceUSD(Address.fromString(lmPool.rewardToken)));
  lmPool.tvl = lmPool.stakedLiquidity;
  lmPool.tvlUSD = lmPool.stakedLiquidityUSD;
  lmPool.apr = calculateAPR(lmPool);

  position.tickLowerInt = BigInt.fromI32(event.params.tickLower);
  position.tickUpperInt = BigInt.fromI32(event.params.tickUpper);
  position.isStaked = true;

  position.save();
  lmPool.save();
  transaction.save();
}

/**
 * Handles Withdraw event.
 */
export function handleWithdraw(event: Withdraw): void {
  let lmPool = LMPool.load(event.params.pid.toString());
  let position = Position.load(event.params.pid.toString());
  if (!lmPool || !position) return;

  let transaction = new LMTransaction(event.transaction.hash.toHex());
  transaction.type = "Withdraw";
  transaction.user = event.params.from;
  transaction.pool = lmPool.id;
  transaction.amount = ZERO_BD;
  transaction.reward = ZERO_BD;
  transaction.timestamp = event.block.timestamp;

  lmPool.stakedLiquidity = lmPool.stakedLiquidity.minus(transaction.amount);
  lmPool.stakedLiquidityUSD = lmPool.stakedLiquidity.times(getTokenPriceUSD(Address.fromString(lmPool.rewardToken)));
  lmPool.tvl = lmPool.stakedLiquidity;
  lmPool.tvlUSD = lmPool.stakedLiquidityUSD;
  lmPool.apr = calculateAPR(lmPool);

  position.isStaked = false;

  lmPool.save();
  transaction.save();
}

/**
 * Handles Harvest event.
 */
export function handleHarvest(event: Harvest): void {
  let transaction = new LMTransaction(event.transaction.hash.toHex());
  let position = Position.load(event.params.pid.toString());
  transaction.type = "Harvest";
  transaction.user = event.params.sender;
  transaction.pool = event.params.pid.toString();
  transaction.amount = ZERO_BD;
  transaction.reward = event.params.reward.toBigDecimal();
  transaction.timestamp = event.block.timestamp;

  transaction.save();

  if(!position) return;
  position.earned = position.earned.plus(event.params.reward);
  position.save();
}


export function handleNewPeriodDuration(event: NewPeriodDuration): void {
  // let masterChef = MasterChef.load(dataSource.address().toHex());
  // if(!masterChef) return;

  // masterChef.periodDuration = event.params.periodDuration;
  // masterChef.save()
}

/**
 * Handles UpdateLiquidity event.
 */
export function handleUpdateLiquidity(event: UpdateLiquidity): void {
  let lmPool = LMPool.load(event.params.pid.toString());
  let position = Position.load(event.params.pid.toString());
  if (!lmPool || !position) return;

  let liquidityDelta = event.params.liquidity.toBigDecimal();
  lmPool.stakedLiquidity = lmPool.stakedLiquidity.plus(liquidityDelta);
  lmPool.stakedLiquidityUSD = lmPool.stakedLiquidity.times(getTokenPriceUSD(Address.fromString(lmPool.rewardToken)));
  lmPool.tvl = lmPool.stakedLiquidity;
  lmPool.tvlUSD = lmPool.stakedLiquidityUSD;
  lmPool.apr = calculateAPR(lmPool);

  lmPool.save();

  position.liquidity = event.params.liquidity;
  position.tickLowerInt = BigInt.fromI32(event.params.tickLower);
  position.tickUpperInt = BigInt.fromI32(event.params.tickUpper);
  position.save();

}

/**
 * Handles NewUpkeepPeriod event.
 */
export function handleNewUpkeepPeriod(event: NewUpkeepPeriod): void {
  let rewardPeriod = new RewardPeriod(event.params.periodNumber.toString());
  rewardPeriod.pool = event.params.periodNumber.toString(); // Assuming period number matches pool ID
  rewardPeriod.rewardRate = event.params.cakePerSecond.toBigDecimal();
  rewardPeriod.startTime = event.params.startTime;
  rewardPeriod.endTime = event.params.endTime;
  rewardPeriod.save();

  // let masterChef = MasterChef.load(dataSource.address().toHex());
  // if(!masterChef) return;
  // masterChef.latestPeriodStartTime = event.params.startTime;
  // masterChef.latestPeriodEndTime = event.params.endTime;
  // masterChef.latestPeriodCakePerSecond = event.params.cakePerSecond;
  // masterChef.latestPeriodCakeAmount = event.params.cakeAmount;
  // masterChef.save();
}

/**
 * Handles UpdateUpkeepPeriod event.
 */
export function handleUpdateUpkeepPeriod(event: UpdateUpkeepPeriod): void {
  let rewardPeriod = RewardPeriod.load(event.params.periodNumber.toString());
  if (!rewardPeriod) return;

  rewardPeriod.endTime = event.params.newEndTime;
  rewardPeriod.save();
}

/**
 * Calculates APR for the LM Pool.
 */
function calculateAPR(pool: LMPool): BigDecimal {
  if (pool.stakedLiquidity.equals(ZERO_BD)) return ZERO_BD;

  let annualRewards = pool.rewardRate.times(SECONDS_IN_YEAR);
  return annualRewards.div(pool.stakedLiquidity).times(BigDecimal.fromString("100"));
}