import { DfTxIndexer, DfTxTransaction } from '@src/module.indexer/model/dftx/_abstract'
import { PoolUpdatePair, CPoolUpdatePair } from '@muirglacier/jellyfish-transaction'
import { RawBlock } from '@src/module.indexer/model/_abstract'
import { Injectable, Logger } from '@nestjs/common'
import { PoolPairMapper } from '@src/module.model/poolpair'

@Injectable()
export class UpdatePoolPairIndexer extends DfTxIndexer<PoolUpdatePair> {
  OP_CODE: number = CPoolUpdatePair.OP_CODE
  private readonly logger = new Logger(UpdatePoolPairIndexer.name)

  constructor (
    private readonly poolPairMapper: PoolPairMapper
  ) {
    super()
  }

  async indexTransaction (block: RawBlock, transaction: DfTxTransaction<PoolUpdatePair>): Promise<void> {
    const data = transaction.dftx.data
    const poolPair = await this.poolPairMapper.getLatest(`${data.poolId}`)
    if (poolPair !== undefined) {
      await this.poolPairMapper.put({
        ...poolPair,
        id: `${data.poolId}-${block.height}`,
        block: { hash: block.hash, height: block.height, medianTime: block.mediantime, time: block.time },
        status: data.status, // Always override status
        commission: data.commission.eq(-1) ? poolPair.commission : data.commission.toFixed(8)
      })
    }
  }

  async invalidateTransaction (block: RawBlock, transaction: DfTxTransaction<PoolUpdatePair>): Promise<void> {
    const data = transaction.dftx.data
    const poolPair = await this.poolPairMapper.getLatest(`${data.poolId}`)
    if (poolPair !== undefined) {
      await this.poolPairMapper.delete(`${data.poolId}-${block.height}`)
    }
  }
}
