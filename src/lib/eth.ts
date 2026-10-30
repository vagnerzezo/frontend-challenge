import Big from 'big.js'
import type { EthString } from '@/api/contracts'

// Usamos big.js para não perder precisão com valores em ETH (number não serve aqui)
Big.DP = 18
Big.RM = Big.roundHalfUp

export const eth = (value: EthString | number | Big) => new Big(value)

export function ethAdd(...values: EthString[]): EthString {
  let total = new Big(0)
  for (const value of values) {
    total = total.plus(value)
  }
  return total.toString()
}

export function ethMul(value: EthString, quantity: number): EthString {
  return new Big(value).times(quantity).toString()
}

export function ethCmp(a: EthString, b: EthString) {
  return new Big(a).cmp(b)
}

// Mostra no mínimo 2 e no máximo 6 casas decimais. Ex.: "0.50 ETH", "1.234567 ETH"
export function formatEth(value: EthString, options: { suffix?: boolean } = {}): string {
  const fixed = new Big(value).toFixed(6).replace(/0+$/, '')
  const [integerPart, decimalPart = ''] = fixed.split('.')
  const text = `${integerPart}.${decimalPart.padEnd(2, '0')}`
  return options.suffix === false ? text : `${text} ETH`
}
