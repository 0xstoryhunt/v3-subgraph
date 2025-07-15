import { Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts'

import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
  NonfungiblePositionManager,
  Transfer,
} from '../types/NonfungiblePositionManager/NonfungiblePositionManager'
import { Position, PositionSnapshot } from '../types/schema'
import { ADDRESS_ZERO, factoryContract, ZERO_BD, ZERO_BI } from '../utils/constants'


function savePositionSnapshot(position: Position, event: ethereum.Event): void {
  const positionSnapshot = new PositionSnapshot(position.id.concat('#').concat(event.block.number.toString()))
  positionSnapshot.owner = position.owner
  positionSnapshot.pool = position.pool
  positionSnapshot.position = position.id
  positionSnapshot.blockNumber = event.block.number
  positionSnapshot.timestamp = event.block.timestamp
  positionSnapshot.liquidity = position.liquidity
  positionSnapshot.save()
}

function getPosition(event: ethereum.Event, tokenId: BigInt): Position | null {
  let position = Position.load(tokenId.toString())
  if (position === null) {
    const contract = NonfungiblePositionManager.bind(event.address)
    const positionCall = contract.try_positions(tokenId)

    log.info('Processing IncreaseLiquidity for tokenId: {}', [positionCall.reverted.toString()])

    if (!positionCall.reverted) {
      const positionResult = positionCall.value
      const poolAddress = factoryContract.try_getPool(
        positionResult.value2,
        positionResult.value3,
        positionResult.value4,
      )
      if (!poolAddress.reverted) {
        position = new Position(tokenId.toString())
        // The owner gets correctly updated in the Transfer handler
        position.owner = Address.fromString(ADDRESS_ZERO)
        position.pool = poolAddress.value
        position.token0 = positionResult.value2
        position.token1 = positionResult.value3
        position.tickLowerInt = BigInt.fromI32(positionResult.value5)
        position.tickUpperInt = BigInt.fromI32(positionResult.value6)
        position.liquidity = positionResult.value7
        position.feeGrowthInside0LastX128 = positionResult.value8
        position.feeGrowthInside1LastX128 = positionResult.value9
      }
    }
  }
  return position
}
function updateFeeVars(position: Position, event: ethereum.Event, tokenId: BigInt): Position {
  const positionManagerContract = NonfungiblePositionManager.bind(event.address)
  const positionResult = positionManagerContract.try_positions(tokenId)
  if (!positionResult.reverted) {
    position.feeGrowthInside0LastX128 = positionResult.value.value8
    position.feeGrowthInside1LastX128 = positionResult.value.value9
    position.liquidity = positionResult.value.value7
  }
  return position
}

export function handleIncreaseLiquidity(event: IncreaseLiquidity): void {
  const position = getPosition(event, event.params.tokenId)

  // position was not able to be fetched
  if (position == null) {
    return
  }

  updateFeeVars(position, event, event.params.tokenId)
  position.save()
  savePositionSnapshot(position, event)
}
export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  let position = getPosition(event, event.params.tokenId)
  // position was not able to be fetched
  if (position == null) {
    return
  }

  position = updateFeeVars(position, event, event.params.tokenId)
  position.save()
  savePositionSnapshot(position, event)
}
export function handleCollect(event: Collect): void {
  let position = getPosition(event, event.params.tokenId)
  // position was not able to be fetched
  if (position == null) {
    return
  }
  position = updateFeeVars(position, event, event.params.tokenId)
  position.save()
  savePositionSnapshot(position, event)
}
export function handleTransfer(event: Transfer): void {
  const position = getPosition(event, event.params.tokenId)
  // position was not able to be fetched
  if (position == null) {
    return
  }
  position.owner = event.params.to

  position.save()
  savePositionSnapshot(position, event)
}
