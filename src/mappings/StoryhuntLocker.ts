/* eslint-disable @typescript-eslint/no-unused-vars */
import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { getOrCreatePool } from "../entities/pool";
import { getOrCreateUser, getOrCreateUserPosition } from "../entities/user";
import { ADDRESS_ZERO, BI_ONE, factoryContract, V3_NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from "../utils";
import {
  StoryHuntNFTLocked,
  StoryhuntLocker,
  UnlockStoryHuntNFT,
} from "../types/StoryhuntLocker/StoryhuntLocker";
import { NonfungiblePositionManager } from "../types/StoryhuntLocker/NonfungiblePositionManager";
import { Position } from "../types/schema";

export function handleLock(event: StoryHuntNFTLocked): void {
  log.info("[Locker] Log Lock {} {} {} {} {}", [
    event.params.from.toHex(),
    event.params.startTimestamp.toString(),
    event.params.finalTimestamp.toString(),
    event.params.liquidity.toString(),
    event.params.tokenId.toString(),
  ]);

  const pool = getPoolAddress(event, event.params.tokenId);
  const poolObj = getOrCreatePool(pool, event.block);
  const user = getOrCreateUser(event.params.from, event.block);
  const userPosition = getOrCreateUserPosition(
    event.params.tokenId,
    poolObj,
    event.block
  );

  userPosition.liquidity = event.params.liquidity;
  userPosition.isLocked = true;
  userPosition.finishTimestamp = event.params.finalTimestamp;
  userPosition.user = user.id;

  userPosition.save();
  poolObj.save();
  user.save();
}

export function handleUnlock(event: UnlockStoryHuntNFT): void {
  log.info("[Locker] Log Unlock {} {} {}", [
    event.params.from.toHex(),
    event.params.to.toString(),
    event.params.tokenId.toString(),
  ]);
  const pool = getPoolAddress(event, event.params.tokenId);
  const poolObj = getOrCreatePool(pool, event.block);
  const user = getOrCreateUser(event.params.from, event.block);
  const userPosition = getOrCreateUserPosition(
    event.params.tokenId,
    poolObj,
    event.block
  );

  userPosition.isLocked = false;

  userPosition.save();
  user.save();
}

function getPoolAddress(event: ethereum.Event, tokenId: BigInt): string {
  let position = Position.load(tokenId.toString());
  if (position === null) {
    const contract = NonfungiblePositionManager.bind(Address.fromString(V3_NONFUNGIBLE_POSITION_MANAGER_ADDRESS));
    const positionCall = contract.try_positions(tokenId);

    log.info("Processing getPoolAddress for tokenId: {}", [
      positionCall.reverted.toString(),
    ]);

    if (!positionCall.reverted) {
      const positionResult = positionCall.value;
      const poolAddress = factoryContract.try_getPool(
        positionResult.value2,
        positionResult.value3,
        positionResult.value4
      );

      if (!poolAddress.reverted) {
        position = new Position(tokenId.toString());
        position.pool = poolAddress.value.toHexString();
        position.liquidity = positionResult.value7;
        position.isLocked = true;
      }
    }
  }
  return position ? position.pool : "0";
}
