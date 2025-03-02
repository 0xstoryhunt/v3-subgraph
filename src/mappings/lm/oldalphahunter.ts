import { Address } from '@graphprotocol/graph-ts'
import {
  Deposit,
  Withdraw,
  Harvest,
} from '../../types/OldAlphaHunterV3/OldAlphaHunterV3'
import { Position, PositionReward } from '../../types/schema'
import { ZERO_BD, ADDRESS_ZERO } from '../../utils/constants'

/**
 * Handles the Deposit event.
 */
export function handleDeposit(event: Deposit): void {
  //let lmPool = LMPool.load(event.params.pid.toString())
  let position = Position.load(event.params.tokenId.toString())
  if (!position) return

  position.staker = event.params.from
  position.isStaked = true

  // Save entities
  position.save()
}

/**
 * Handles the Withdraw event.
 */
export function handleWithdraw(event: Withdraw): void {
  let position = Position.load(event.params.tokenId.toString())
  if (!position) return

  // Update position
  position.staker = Address.fromString(ADDRESS_ZERO)
  position.isStaked = false

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
}
