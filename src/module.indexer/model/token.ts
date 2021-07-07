import { Injectable } from '@nestjs/common'
import { Indexer, RawBlock } from '@src/module.indexer/model/_abstract'
import { Token, TokenMapper } from '@src/module.model/token'
import { SmartBuffer } from 'smart-buffer'
import { OP_DEFI_TX, TokenCreate } from '@defichain/jellyfish-transaction/dist/script/defi'
import { toOPCodes } from '@defichain/jellyfish-transaction/dist/script/_buffer'
import { DctId, DctIdMapper } from '@src/module.model/dctid'

@Injectable()
export class TokenIndexer extends Indexer {
  constructor (
    private readonly mapper: TokenMapper,
    private readonly dctMapper: DctIdMapper
  ) {
    super()
  }

  async index (block: RawBlock): Promise<void> {
    for (const txn of block.tx) {
      for (const vout of txn.vout) {
        if (vout.scriptPubKey.asm.startsWith('OP_RETURN 4466547854')) { // 44665478 -> DFTX, 54 -> p -> create token
          const stack: any = toOPCodes(
            SmartBuffer.fromBuffer(Buffer.from(vout.scriptPubKey.hex, 'hex'))
          )

          const data: TokenCreate = (stack[1] as OP_DEFI_TX).tx.data

          let dctId = await this.dctMapper.getLatest()

          const id = dctId === undefined ? '0' : (Number(dctId.id) + 1).toString() // dctId increment

          // its fine to index without checking existence
          // as it already passed through the validation during create token in dfid
          const newToken = TokenIndexer.newToken(block, data, id)
          await this.mapper.put(newToken)

          dctId = TokenIndexer.newDctId(id)
          await this.dctMapper.put(dctId)
        }

        // TODO(canonbrother): index UpdateToken
      }
    }
  }

  async invalidate (block: RawBlock): Promise<void> {
    for (const txn of block.tx) {
      for (const vout of txn.vout) {
        if (vout.scriptPubKey.asm.startsWith('OP_RETURN 4466547854')) { // 44665478 -> DFTX, 54 -> p -> create token
          continue
        }
        const stack: any = toOPCodes(
          SmartBuffer.fromBuffer(Buffer.from(vout.scriptPubKey.hex, 'hex'))
        )

        const data = (stack[1] as OP_DEFI_TX).tx.data

        const token = await this.mapper.getLatest()
        if (token !== undefined && token.symbol === data.symbol) {
          await this.mapper.delete(token.id)
        }
      }
    }
  }

  static newToken (block: RawBlock, data: TokenCreate, id: string, symbolId?: string): Token {
    return {
      id: id,
      block: {
        hash: block.hash,
        height: block.height
      },
      symbolId: symbolId,
      ...data
    }
  }

  static newDctId (id: string): DctId {
    return {
      id: id
    }
  }
}