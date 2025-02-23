import { Transfer } from '../../types/MimBokuNFT/MimBokuNFT'
import { NFTHolder, NFTToken, NFTTransfer, Transaction } from '../../types/schema'
import { BigInt, Address } from '@graphprotocol/graph-ts'

function getOrCreateHolder(address: Address, timestamp: BigInt): NFTHolder {
  let holder = NFTHolder.load(address.toHexString())
  
  if (!holder) {
    holder = new NFTHolder(address.toHexString())
    holder.address = address
    holder.tokenCount = BigInt.fromI32(0)
    holder.firstOwnedAt = timestamp
    holder.lastUpdatedAt = timestamp
  }
  
  return holder
}

export function handleTransfer(event: Transfer): void {
  let token = NFTToken.load(event.params.tokenId.toString())
  
  // Handle new token mint
  if (!token) {
    token = new NFTToken(event.params.tokenId.toString())
    token.tokenId = event.params.tokenId
    token.mintedAt = event.block.timestamp
    token.mintedBy = event.params.from
  }
  
  // Update holders
  if (event.params.from != Address.zero()) {
    let fromHolder = getOrCreateHolder(event.params.from, event.block.timestamp)
    fromHolder.tokenCount = fromHolder.tokenCount.minus(BigInt.fromI32(1))
    fromHolder.lastUpdatedAt = event.block.timestamp
    fromHolder.save()
  }
  
  let toHolder = getOrCreateHolder(event.params.to, event.block.timestamp)
  toHolder.tokenCount = toHolder.tokenCount.plus(BigInt.fromI32(1))
  toHolder.lastUpdatedAt = event.block.timestamp
  toHolder.save()
  
  // Update token owner
  token.owner = toHolder.id
  token.save()
  
  // Create transfer event
  let transfer = new NFTTransfer(
    event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  )
  
  let tx = new Transaction(event.transaction.hash.toHexString())
  tx.blockNumber = event.block.number
  tx.timestamp = event.block.timestamp
  tx.save()
  
  transfer.token = token.id
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.timestamp = event.block.timestamp
  transfer.transaction = tx.id
  transfer.blockNumber = event.block.number
  transfer.save()
}