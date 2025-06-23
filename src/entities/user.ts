/* eslint-disable @typescript-eslint/no-unused-vars */
import { Pool, User, Position } from "../types/schema";
import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import { getOrCreatePool } from "./pool";
import { BI_ZERO, BI_ONE, BOOST_PRECISION } from "../utils";
//import { getOrCreateAlphaHunter } from "./alpha-hunter";

export function getOrCreateUser(address: Address, block: ethereum.Block): User {

  const uid = address.toHex();
  let user = User.load(uid);

  if (user === null) {
    user = new User(uid);
    user.address = address;
  }

  user.timestamp = block.timestamp;
  user.block = block.number;
  user.save();

  return user as User;
}

// export function getBoostMultiplier(user: User): BigInt {
//   return user.boostMultiplier.gt(BOOST_PRECISION) ? user.boostMultiplier : BOOST_PRECISION;
// }

export function getOrCreateUserPosition(tokenId: BigInt, pool: Pool, block: ethereum.Block): Position {
  const uid = tokenId.toString();
  let userPosition = Position.load(uid);

  if (userPosition === null) {
    userPosition = new Position(uid);
    userPosition.pool = pool.id;
    userPosition.timestamp = block.timestamp;
    userPosition.liquidity = BI_ZERO;
    userPosition.block = block.number;
    userPosition.isLocked = false;
    userPosition.finishTimestamp = BI_ZERO
  }

  return userPosition as Position;
}
