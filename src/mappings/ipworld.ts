import { BigInt } from '@graphprotocol/graph-ts'
import { TokenDeployed, Harvest } from '../types/IPWorld/IPWorld'
import { TokenDeployment, HarvestEvent } from '../types/schema'

export function handleTokenDeployed(event: TokenDeployed): void {
  const tokenDeployment = new TokenDeployment(event.transaction.hash.toHexString() + '#' + event.logIndex.toString())

  tokenDeployment.block = event.block.number
  tokenDeployment.blockNumber = event.block.number
  tokenDeployment.timestamp = event.block.timestamp
  tokenDeployment.transactionHash = event.transaction.hash.toHexString()
  tokenDeployment.contractId = event.address.toHexString()
  tokenDeployment.tokenCreator = event.params.tokenCreator.toHexString()
  tokenDeployment.token = event.params.token.toHexString()
  tokenDeployment.pool = event.params.pool.toHexString()

  // Convert startTickList array
  const startTickList: BigInt[] = []
  for (let i = 0; i < event.params.startTickList.length; i++) {
    startTickList.push(BigInt.fromI32(event.params.startTickList[i]))
  }
  tokenDeployment.startTickList = startTickList

  // Convert allocationList array
  const allocationList: BigInt[] = []
  for (let i = 0; i < event.params.allocationList.length; i++) {
    allocationList.push(event.params.allocationList[i])
  }
  tokenDeployment.allocationList = allocationList

  tokenDeployment.save()
}

export function handleHarvest(event: Harvest): void {
  const harvestEvent = new HarvestEvent(event.transaction.hash.toHexString() + '#' + event.logIndex.toString())

  harvestEvent.token = event.params.token.toHexString()
  harvestEvent.wethCollected = event.params.wethCollected
  harvestEvent.tokensCollected = event.params.tokensCollected
  harvestEvent.tokensBurned = event.params.tokensBurned
  harvestEvent.wethToBuyback = event.params.wethToBuyback
  harvestEvent.wethToIpOwner = event.params.wethToIpOwner
  harvestEvent.blockNumber = event.block.number
  harvestEvent.timestamp = event.block.timestamp
  harvestEvent.transactionHash = event.transaction.hash.toHexString()

  harvestEvent.save()
}
