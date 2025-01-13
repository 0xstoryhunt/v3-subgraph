import { BigDecimal, Address, BigInt } from "@graphprotocol/graph-ts";
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
} from "../../types/AlphaHunterV3/AlphaHunterV3"
import {
  LMPool,
  RewardPeriod,
  LMTransaction,
  Pool,
  Position,
  Token,
} from "../../types/schema";
import { getTokenPriceUSD } from "../../utils";
import { ZERO_BD, SECONDS_PER_YEAR, ADDRESS_ZERO } from "../../utils/constants";

/**
 * Handles the AddPool event.
 */
export function handleAddPool(event: AddPool): void {
  let lmPool = new LMPool(event.params.pid.toString());
  let v3Pool = Pool.load(event.params.v3Pool.toHexString());

  lmPool.id = event.params.pid.toString();
  lmPool.pool = v3Pool ? v3Pool.id : event.params.v3Pool.toHexString();
  lmPool.rewardToken = ADDRESS_ZERO;
  lmPool.rewardRate = ZERO_BD;
  lmPool.allocPoint = event.params.allocPoint;
  lmPool.stakedLiquidity = ZERO_BD;
  lmPool.stakedLiquidityUSD = ZERO_BD;
  lmPool.tvl = ZERO_BD;
  lmPool.tvlUSD = ZERO_BD;
  lmPool.volume = ZERO_BD;
  lmPool.volumeUSD = ZERO_BD;
  lmPool.apr = ZERO_BD;

  if (v3Pool) {
    v3Pool.lmPool = lmPool.id;
    v3Pool.save();
  }

  lmPool.save();
}

/**
 * Handles the SetPool event.
 */
export function handleSetPool(event: SetPool): void {
  let lmPool = LMPool.load(event.params.pid.toString());
  if (!lmPool) return;

  lmPool.allocPoint = event.params.allocPoint;
  lmPool.save();
}

/**
 * Handles the Deposit event.
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

  // Update pool stats
  lmPool.stakedLiquidity = lmPool.stakedLiquidity.plus(transaction.amount);
  lmPool.stakedLiquidityUSD = lmPool.stakedLiquidity.times(
    getTokenPriceUSD(Address.fromString(lmPool.rewardToken))
  );
  lmPool.tvl = lmPool.stakedLiquidity;
  lmPool.tvlUSD = lmPool.stakedLiquidityUSD;
  lmPool.apr = calculateAPR(lmPool);

  // Update position
  position.tickLowerInt = BigInt.fromI32(event.params.tickLower);
  position.tickUpperInt = BigInt.fromI32(event.params.tickUpper);
  position.isStaked = true;

  // Save entities
  position.save();
  lmPool.save();
  transaction.save();
}

/**
 * Handles the Withdraw event.
 */
export function handleWithdraw(event: Withdraw): void {
  let lmPool = LMPool.load(event.params.pid.toString());
  let position = Position.load(event.params.pid.toString());
  if (!lmPool || !position) return;

  let transaction = new LMTransaction(event.transaction.hash.toHex());
  transaction.type = "Withdraw";
  transaction.user = event.params.from;
  transaction.pool = lmPool.id;
  transaction.amount = ZERO_BD; // If needed, calculate actual 'liquidity removed'
  transaction.reward = ZERO_BD;
  transaction.timestamp = event.block.timestamp;

  // Update pool stats
  lmPool.stakedLiquidity = lmPool.stakedLiquidity.minus(transaction.amount);
  if (lmPool.stakedLiquidity.lt(ZERO_BD)) {
    // Prevent negative staked liquidity due to partial data
    lmPool.stakedLiquidity = ZERO_BD;
  }
  lmPool.stakedLiquidityUSD = lmPool.stakedLiquidity.times(
    getTokenPriceUSD(Address.fromString(lmPool.rewardToken))
  );
  lmPool.tvl = lmPool.stakedLiquidity;
  lmPool.tvlUSD = lmPool.stakedLiquidityUSD;
  lmPool.apr = calculateAPR(lmPool);

  // Update position
  position.isStaked = false;

  // Save entities
  lmPool.save();
  transaction.save();
  position.save();
}

/**
 * Handles the Harvest event.
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

  // `token` param from the event (reward token)
  transaction.token = event.params.token.toHexString();

  transaction.save();

  if (!position) return;
  position.earned = position.earned.plus(event.params.reward);
  position.save();
}

/**
 * Handles the UpdateLiquidity event.
 */
export function handleUpdateLiquidity(event: UpdateLiquidity): void {
  let lmPool = LMPool.load(event.params.pid.toString());
  let position = Position.load(event.params.pid.toString());
  if (!lmPool || !position) return;

  let liquidityDelta = event.params.liquidity.toBigDecimal();
  lmPool.stakedLiquidity = lmPool.stakedLiquidity.plus(liquidityDelta);
  lmPool.stakedLiquidityUSD = lmPool.stakedLiquidity.times(
    getTokenPriceUSD(Address.fromString(lmPool.rewardToken))
  );
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
 * Handles the NewUpkeepPeriod event.
 */
export function handleNewUpkeepPeriod(event: NewUpkeepPeriod): void {
  let rewardPeriod = new RewardPeriod(event.params.periodNumber.toString());
  rewardPeriod.pool = event.params.periodNumber.toString();
  rewardPeriod.rewardRate = event.params.huntPerSecond.toBigDecimal();
  rewardPeriod.startTime = event.params.startTime;
  rewardPeriod.endTime = event.params.endTime;
  rewardPeriod.token = event.params.token.toHexString();
  rewardPeriod.save();

  // Update the LMPool to new reward token & rewardRate
  let lmPool = LMPool.load(rewardPeriod.pool);
  if (lmPool) {
    lmPool.rewardToken = event.params.token.toHexString();
    lmPool.rewardRate = rewardPeriod.rewardRate;
    lmPool.apr = calculateAPR(lmPool);
    lmPool.save();
  }
}

/**
 * Handles the UpdateUpkeepPeriod event.
 */
export function handleUpdateUpkeepPeriod(event: UpdateUpkeepPeriod): void {
  let rewardPeriod = RewardPeriod.load(event.params.periodNumber.toString());
  if (!rewardPeriod) return;

  rewardPeriod.endTime = event.params.newEndTime;
  rewardPeriod.token = event.params.token.toHexString(); // Updated if token changed
  rewardPeriod.save();

  // Update the LMPool to new reward token & recalc rewardRate
  let lmPool = LMPool.load(rewardPeriod.pool);
  if (lmPool) {
    lmPool.rewardToken = event.params.token.toHexString();
    /**
     * If you have leftover tokens and extended end time,
     * recalc the new rewardRate if needed:
     */
    let oldDuration = rewardPeriod.endTime.minus(event.params.oldEndTime);
    let leftoverHunt = event.params.remainingHunt; // If leftover tokens are specified
    if (oldDuration.gt(BigInt.fromI32(0))) {
      // leftoverHunt / extended time
      let newRewardRate = leftoverHunt
        .toBigDecimal()
        .div(oldDuration.toBigDecimal());
      lmPool.rewardRate = newRewardRate;
    }

    lmPool.apr = calculateAPR(lmPool);
    lmPool.save();
  }
}

/**
 * Handles the NewPeriodDuration event. (If needed)
 */
export function handleNewPeriodDuration(event: NewPeriodDuration): void {
  // If there's a MasterChef or global entity storing period durations, update that here.
}

/**
 * Calculates APR for the LM Pool.
 */
function calculateAPR(pool: LMPool): BigDecimal {
  if (pool.stakedLiquidity.equals(ZERO_BD)) return ZERO_BD;

  let annualRewards = pool.rewardRate.times(SECONDS_PER_YEAR);
  let rewardTokenPrice = getTokenPriceUSD(Address.fromString(pool.rewardToken));
  if (rewardTokenPrice.equals(ZERO_BD)) return annualRewards; // or ZERO_BD if you prefer no price => no APR

  return annualRewards
    .times(rewardTokenPrice)
    .div(pool.stakedLiquidity)
    .times(BigDecimal.fromString("100"));
}
