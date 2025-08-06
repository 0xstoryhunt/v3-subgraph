import { VestedTokensAndEthClaimed, VestingScheduleCreated } from '../types/IPOwnerVault/IPOwnerVault'
import { ClaimEvent, VestingSchedule } from '../types/schema'

export function handleVestedTokensAndEthClaimed(event: VestedTokensAndEthClaimed): void {
  const claimEvent = new ClaimEvent(event.transaction.hash.toHexString() + '#' + event.logIndex.toString())

  claimEvent.token = event.params.token.toHexString()
  claimEvent.recipient = event.params.recipient.toHexString()
  claimEvent.tokenAmount = event.params.tokenAmount
  claimEvent.ethAmount = event.params.ethAmount
  claimEvent.blockNumber = event.block.number
  claimEvent.timestamp = event.block.timestamp
  claimEvent.transactionHash = event.transaction.hash.toHexString()

  claimEvent.save()
}

export function handleVestingScheduleCreated(event: VestingScheduleCreated): void {
  const vestingSchedule = new VestingSchedule(event.transaction.hash.toHexString() + '#' + event.logIndex.toString())

  vestingSchedule.token = event.params.token.toHexString()
  vestingSchedule.totalAmount = event.params.totalAmount
  vestingSchedule.startTime = event.params.startTime
  vestingSchedule.endTime = event.params.endTime
  vestingSchedule.blockNumber = event.block.number
  vestingSchedule.timestamp = event.block.timestamp
  vestingSchedule.transactionHash = event.transaction.hash.toHexString()

  vestingSchedule.save()
}
