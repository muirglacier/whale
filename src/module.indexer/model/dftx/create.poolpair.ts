import { DfTxIndexer, DfTxTransaction } from '@src/module.indexer/model/dftx/_abstract'
import { CPoolCreatePair, PoolCreatePair } from '@muirglacier/jellyfish-transaction'
import { RawBlock } from '@src/module.indexer/model/_abstract'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { PoolPairMapper } from '@src/module.model/poolpair'
import { PoolPairTokenMapper } from '@src/module.model/poolpair.token'
import { MAX_TOKEN_SYMBOL_LENGTH, TokenMapper } from '@src/module.model/token'
import { HexEncoder } from '@src/module.model/_hex.encoder'
import { IndexerError } from '@src/module.indexer/error'
import { NetworkName } from '@muirglacier/jellyfish-network'

const ConsensusParams = {
  mainnet: {
    FortCanningHeight: 1367000
  },
  testnet: {
    FortCanningHeight: 686200
  },
  regtest: {
    FortCanningHeight: 10000000
  }
}

const MAX_TOKEN_SYMBOL_LENGTH_POST_FC = 16

@Injectable()
export class CreatePoolPairIndexer extends DfTxIndexer<PoolCreatePair> {
  OP_CODE: number = CPoolCreatePair.OP_CODE
  private readonly logger = new Logger(CreatePoolPairIndexer.name)

  constructor (
    private readonly poolPairMapper: PoolPairMapper,
    private readonly poolPairTokenMapper: PoolPairTokenMapper,
    private readonly tokenMapper: TokenMapper,
    @Inject('NETWORK') protected readonly network: NetworkName
  ) {
    super()
  }

  async indexTransaction (block: RawBlock, transaction: DfTxTransaction<PoolCreatePair>): Promise<void> {
    const data = transaction.dftx.data
    const tokenId = await this.tokenMapper.getNextTokenID(true)

    const tokenA = await this.tokenMapper.get(`${data.tokenA}`)
    const tokenB = await this.tokenMapper.get(`${data.tokenB}`)

    if (tokenA === undefined || tokenB === undefined) {
      throw new IndexerError(`Tokens (${data.tokenA}, ${data.tokenB}) referenced by PoolPair (${tokenId}) do not exist`)
    }

    let pairSymbol
    if (data.pairSymbol.length === 0) {
      pairSymbol = (tokenA?.symbol + '-' + tokenB?.symbol).trim().substr(0, MAX_TOKEN_SYMBOL_LENGTH)
    } else {
      const symbolLength = block.height >= ConsensusParams[this.network].FortCanningHeight
        ? MAX_TOKEN_SYMBOL_LENGTH_POST_FC
        : MAX_TOKEN_SYMBOL_LENGTH

      pairSymbol = data.pairSymbol.trim().substr(0, symbolLength)
    }

    // TODO: Index customRewards, ownerAddress
    await this.poolPairMapper.put({
      id: `${tokenId}-${block.height}`,
      pairSymbol,
      poolPairId: `${tokenId}`,
      tokenA: {
        id: data.tokenA,
        symbol: tokenA.symbol
      },
      tokenB: {
        id: data.tokenB,
        symbol: tokenB.symbol
      },
      block: { hash: block.hash, height: block.height, medianTime: block.mediantime, time: block.time },
      status: data.status,
      commission: data.commission.toFixed(8)
    })

    await this.poolPairTokenMapper.put({
      id: `${data.tokenA}-${data.tokenB}-${tokenId}`,
      key: `${data.tokenA}-${data.tokenB}`,
      poolpairId: tokenId,
      block: { hash: block.hash, height: block.height, medianTime: block.mediantime, time: block.time }
    })

    await this.tokenMapper.put({
      id: `${tokenId}`,
      sort: HexEncoder.encodeHeight(tokenId),
      symbol: data.pairSymbol,
      name: `${data.tokenA}-${data.tokenB} LP Token`,
      isDAT: true,
      isLPS: true,
      limit: '0.0',
      mintable: false,
      decimal: 8,
      tradeable: true,
      block: { hash: block.hash, height: block.height, medianTime: block.mediantime, time: block.time }
    })
  }

  async invalidateTransaction (block: RawBlock, transaction: DfTxTransaction<PoolCreatePair>): Promise<void> {
    const data = transaction.dftx.data
    const tokenId = await this.tokenMapper.getNextTokenID(true)
    await this.poolPairMapper.delete(`${tokenId - 1}-${block.height}`)
    await this.poolPairTokenMapper.delete(`${data.tokenA}-${data.tokenB}-${tokenId - 1}`)
    await this.tokenMapper.delete(`${tokenId - 1}`)
  }
}
