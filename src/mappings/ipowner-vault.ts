import { VestedTokensAndEthClaimed } from '../types/IPOwnerVault/IPOwnerVault'
import { ClaimEvent } from '../types/schema'

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
