import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Pool } from "../types/schema";
import { ADDRESS_ZERO, BD_ZERO, BI_ZERO } from "../utils";
// import { getOrCreateToken } from "./token";

// export function fetchPoolToken0(v3PoolAddress: Address): Token {
//   const poolContract = V3Pool.bind(v3PoolAddress);
//   const token0 = poolContract.token0();
//   return getOrCreateToken(token0);
// }
// export function fetchPoolToken1(v3PoolAddress: Address): Token {
//   const poolContract = V3Pool.bind(v3PoolAddress);
//   const token1 = poolContract.token1();
//   return getOrCreateToken(token1);
// }

export function getOrCreatePool(poolId: string, block: ethereum.Block): Pool {
  let pool = Pool.load(poolId);

  if (pool === null) {
    pool = new Pool(poolId);
  }

  pool.timestamp = block.timestamp;
  pool.block = block.number;
  // pool.save();

  return pool as Pool;
}
