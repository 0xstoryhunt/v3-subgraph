import { log } from '@graphprotocol/graph-ts'

import { CreatedToken } from '../types/schema'
import { TokenCreated } from '../types/StoryHuntTokenLaunchpad/StoryHuntTokenLaunchpad'

export function handleTokenCreated(event: TokenCreated): void {
  const createdToken = new CreatedToken(event.params.tokenAddress.toHexString())
  createdToken.name = event.params.name.toString()
  createdToken.symbol = event.params.symbol.toString()
  createdToken.initialSupply = event.params.initialSupply
  createdToken.decimals = 18
  createdToken.owner = event.params.owner.toHexString()
  createdToken.save()
  log.info('Token {} created', [createdToken.id])
}