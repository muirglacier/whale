import BigNumber from 'bignumber.js'
import { WhaleApiClient } from '@muirglacier/whale-api-client'
import { FeeRateProvider } from '@muirglacier/jellyfish-transaction-builder'

export class WhaleFeeRateProvider implements FeeRateProvider {
  constructor (protected readonly client: WhaleApiClient) {
  }

  async estimate (): Promise<BigNumber> {
    const feeRate = await this.client.fee.estimate()
    return new BigNumber(feeRate)
  }
}
