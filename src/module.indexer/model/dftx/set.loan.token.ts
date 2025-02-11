import { DfTxIndexer, DfTxTransaction } from '@src/module.indexer/model/dftx/_abstract'
import { CSetLoanToken, SetLoanToken } from '@muirglacier/jellyfish-transaction'
import { RawBlock } from '@src/module.indexer/model/_abstract'
import { Injectable, Logger } from '@nestjs/common'
import { HexEncoder } from '@src/module.model/_hex.encoder'
import { MAX_TOKEN_NAME_LENGTH, MAX_TOKEN_SYMBOL_LENGTH, TokenMapper } from '@src/module.model/token'
import BigNumber from 'bignumber.js'

@Injectable()
export class SetLoanTokenIndexer extends DfTxIndexer<SetLoanToken> {
  OP_CODE: number = CSetLoanToken.OP_CODE
  private readonly logger = new Logger(SetLoanTokenIndexer.name)

  constructor (
    private readonly tokenMapper: TokenMapper
  ) {
    super()
  }

  async indexTransaction (block: RawBlock, transaction: DfTxTransaction<SetLoanToken>): Promise<void> {
    const data = transaction.dftx.data
    const tokenId = await this.tokenMapper.getNextTokenID(true)
    await this.tokenMapper.put({
      id: `${tokenId}`,
      sort: HexEncoder.encodeHeight(tokenId),
      symbol: data.symbol.trim().substr(0, MAX_TOKEN_SYMBOL_LENGTH),
      name: data?.name?.trim().substr(0, MAX_TOKEN_NAME_LENGTH) ?? data.symbol.trim().substr(0, MAX_TOKEN_NAME_LENGTH),
      isDAT: true,
      isLPS: false,
      limit: new BigNumber(0).toFixed(8),
      mintable: false,
      decimal: 8,
      tradeable: true,
      block: { hash: block.hash, height: block.height, medianTime: block.mediantime, time: block.time }
    })
  }

  async invalidateTransaction (_: RawBlock, txns: DfTxTransaction<SetLoanToken>): Promise<void> {
    const tokenId = await this.tokenMapper.getNextTokenID(true)
    await this.tokenMapper.delete(`${tokenId - 1}`)
  }
}
