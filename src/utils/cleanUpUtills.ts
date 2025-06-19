// src/utils/cleanup.ts
import { BigInt, log, store } from '@graphprotocol/graph-ts'
import { TokenMinuteDataLoader } from '../types/schema'

const THIRTY_MIN_SECONDS = 3600

export function cleanupOldTokenMinuteData(
  currentTimestamp: BigInt,
  tokenId: string
): void {
  // Use the generated loader class
  const loader = new TokenMinuteDataLoader('Token', tokenId, 'TokenMinuteData')
  const minuteDataRecords = loader.load()

  const cutoff = currentTimestamp.minus(BigInt.fromI32(THIRTY_MIN_SECONDS))
  let kept = 0

  // Sort records newest first
  minuteDataRecords.sort((a, b) => b.periodStartUnix - a.periodStartUnix)

  for (let i = 0; i < minuteDataRecords.length; i++) {
    const record = minuteDataRecords[i]
    if (kept < 30 || BigInt.fromI32(record.periodStartUnix).ge(cutoff)) {
      kept++
    } else {
      store.remove('TokenMinuteData', record.id)
    }
  }

  log.info('Cleanup for token {}: Kept {} records', [
    tokenId,
    kept.toString()
  ])
}