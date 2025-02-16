import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { exponentToBigDecimal, safeDiv } from '../utils/index'
import { Bundle, Pool, Token } from './../types/schema'
import { ONE_BD, ZERO_BD, ZERO_BI } from './constants'

// Helper function to compute the absolute value of a BigDecimal
function bdAbs(x: BigDecimal): BigDecimal {
  return x.lt(ZERO_BD) ? x.times(BigDecimal.fromString("-1")) : x;
}

const Q192 = BigInt.fromI32(2).pow(192 as u8);

/**
 * Converts a Uniswap V3 sqrtPriceX96 to token prices.
 * Returns an array where [price0, price1] are the prices of token0 and token1.
 */
export function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: BigInt, 
  token0: Token, 
  token1: Token
): BigDecimal[] {
  // Compute sqrtPrice^2 as a BigDecimal.
  const num = sqrtPriceX96.times(sqrtPriceX96).toBigDecimal();
  // Q192 is our fixed-point denominator.
  const denom = BigDecimal.fromString(Q192.toString());
  
  // Calculate price1 = (sqrtPriceX96^2 / 2^192) * (10^(token0.decimals)) / (10^(token1.decimals))
  const price1 = num
    .div(denom)
    .times(exponentToBigDecimal(token0.decimals))
    .div(exponentToBigDecimal(token1.decimals));

  // Price0 is the reciprocal of price1, using safeDiv to avoid division by zero.
  const price0 = safeDiv(BigDecimal.fromString("1"), price1);
  return [price0, price1];
}

/**
 * Returns the native price in USD by loading a stablecoin-wrapped native pool.
 * If the pool is found, it returns either token0Price or token1Price based on stablecoinIsToken0.
 */
export function getNativePriceInUSD(
  stablecoinWrappedNativePoolAddress: string,
  stablecoinIsToken0: boolean,
): BigDecimal {
  const stablecoinWrappedNativePool = Pool.load(stablecoinWrappedNativePoolAddress);
  if (stablecoinWrappedNativePool !== null) {
    log.info(
      '[STABLE_POOL_PRICES]: token0Price / token1Price: {} / {}', 
      [
        stablecoinWrappedNativePool.token0Price.toString(), 
        stablecoinWrappedNativePool.token1Price.toString()
      ]
    );
    return stablecoinIsToken0 
      ? stablecoinWrappedNativePool.token0Price 
      : stablecoinWrappedNativePool.token1Price;
  } else {
    return BigDecimal.fromString("0");
  }
}

/**
 * Finds the derived native price (IP) per token.
 * It examines whitelist pools for the token, choosing the pool with the largest locked native liquidity above a minimum threshold.
 */
export function findNativePerToken(
  token: Token,
  wrappedNativeAddress: string,
  stablecoinAddresses: string[],
  minimumNativeLocked: BigDecimal,
): BigDecimal {
  if (token.id == wrappedNativeAddress) {
    return ONE_BD;
  }
  const whiteList = token.whitelistPools; // Array of pool IDs (strings)
  let largestLiquidityIP = ZERO_BD;
  let priceSoFar = ZERO_BD;
  const bundle = Bundle.load("1")!;

  // Hardcoded fix: if the token itself is a stablecoin, return a safe price.
  if (stablecoinAddresses.includes(token.id)) {
    priceSoFar = safeDiv(ONE_BD, bundle.IPPriceUSD);
  } else {
    for (let i = 0; i < whiteList.length; ++i) {
      const poolAddress = whiteList[i];
      const pool = Pool.load(poolAddress);
      if (pool) {
        if (pool.liquidity.gt(ZERO_BI)) {
          if (pool.token0 == token.id) {
            const token1 = Token.load(pool.token1);
            if (token1) {
              const IPLocked = pool.totalValueLockedToken1.times(token1.derivedIP);
              if (IPLocked.gt(largestLiquidityIP) && IPLocked.gt(minimumNativeLocked)) {
                largestLiquidityIP = IPLocked;
                // Price is derived as token1Price * token1's derived IP.
                priceSoFar = pool.token1Price.times(token1.derivedIP);
              }
            }
          }
          if (pool.token1 == token.id) {
            const token0 = Token.load(pool.token0);
            if (token0) {
              const IPLocked = pool.totalValueLockedToken0.times(token0.derivedIP);
              if (IPLocked.gt(largestLiquidityIP) && IPLocked.gt(minimumNativeLocked)) {
                largestLiquidityIP = IPLocked;
                // Price is derived as token0Price * token0's derived IP.
                priceSoFar = pool.token0Price.times(token0.derivedIP);
              }
            }
          }
        }
      }
    }
  }
  return priceSoFar; // If nothing is found, returns ZERO_BD.
}

/**
 * Calculates the tracked USD amount given token amounts and a whitelist.
 * If both tokens are whitelisted, returns the sum of their USD values.
 * If only one token is whitelisted, returns double its USD value.
 * If neither is whitelisted, returns ZERO_BD.
 */
export function getTrackedAmountUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  whitelistTokens: string[],
): BigDecimal {
  const bundle = Bundle.load("1")!;
  const price0USD = token0.derivedIP.times(bundle.IPPriceUSD);
  const price1USD = token1.derivedIP.times(bundle.IPPriceUSD);

  // Both tokens whitelisted: return sum of both values.
  if (whitelistTokens.includes(token0.id) && whitelistTokens.includes(token1.id)) {
    return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD));
  }

  // Only token0 is whitelisted: return double its value.
  if (whitelistTokens.includes(token0.id) && !whitelistTokens.includes(token1.id)) {
    return tokenAmount0.times(price0USD).times(BigDecimal.fromString("2"));
  }

  // Only token1 is whitelisted: return double its value.
  if (!whitelistTokens.includes(token0.id) && whitelistTokens.includes(token1.id)) {
    return tokenAmount1.times(price1USD).times(BigDecimal.fromString("2"));
  }

  // Neither token is whitelisted.
  return ZERO_BD;
}