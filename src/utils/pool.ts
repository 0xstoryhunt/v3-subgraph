import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { Pool as PoolContract } from '../types/templates/Pool/Pool'
import { Pool, Token } from '../types/schema'
import { ZERO_BD, ZERO_BI } from './constants'

export function getPool(poolAddress: Address ): Pool | null {
  let pool = Pool.load(poolAddress.toHexString())
  if (pool === null) {
    const poolContract = PoolContract.bind(poolAddress)
    const token0Call = poolContract.try_token0()
    const token1Call = poolContract.try_token1()
    const feeTierCall = poolContract.try_fee()
    const liquidityCall = poolContract.try_liquidity()
    const slot0Call = poolContract.try_slot0()
    
    if (!token0Call.reverted && !token1Call.reverted && !feeTierCall.reverted) {
      pool = new Pool(poolAddress.toHexString())
      pool.token0 = token0Call.value.toHexString()
      pool.token1 = token1Call.value.toHexString()
      pool.feeTier = BigInt.fromI32(feeTierCall.value)
      
      // Get current liquidity
      if (!liquidityCall.reverted) {
        pool.liquidity = liquidityCall.value
      } else {
        pool.liquidity = ZERO_BI
      }

      // Get slot0 data (sqrtPrice, tick, etc)
      if (!slot0Call.reverted) {
        let slot0 = slot0Call.value
        pool.sqrtPrice = slot0.value0
        pool.tick = BigInt.fromI32(slot0.value1)
        pool.observationIndex = BigInt.fromI32(slot0.value2)
      } else {
        pool.sqrtPrice = ZERO_BI
        pool.tick = ZERO_BI
        pool.observationIndex = ZERO_BI
      }

      // Initialize other fields
      pool.token0Price = ZERO_BD
      pool.token1Price = ZERO_BD
      pool.txCount = ZERO_BI
      pool.totalValueLockedToken0 = ZERO_BD
      pool.totalValueLockedToken1 = ZERO_BD
      pool.totalValueLockedUSD = ZERO_BD
      pool.volumeToken0 = ZERO_BD
      pool.volumeToken1 = ZERO_BD
      pool.volumeUSD = ZERO_BD
      pool.feesUSD = ZERO_BD

      // Add missing required fields
      pool.createdAtTimestamp = ZERO_BI
      pool.createdAtBlockNumber = ZERO_BI
      pool.untrackedVolumeUSD = ZERO_BD
      pool.collectedFeesToken0 = ZERO_BD
      pool.collectedFeesToken1 = ZERO_BD
      pool.collectedFeesUSD = ZERO_BD
      pool.totalValueLockedIP = ZERO_BD
      pool.totalValueLockedUSDUntracked = ZERO_BD
      pool.liquidityProviderCount = ZERO_BI
      pool.feesIP = ZERO_BD
      pool.feeAPRUSD = ZERO_BD
      pool.feeAPRIP = ZERO_BD
      pool.from = ''
      pool.lmPool = null

      pool.save()
    }
  }
  return pool
} 