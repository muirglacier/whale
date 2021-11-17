import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestingApp, stopTestingApp } from '@src/e2e.module'
import { LoanMasterNodeRegTestContainer } from '@defichain/testcontainers'
import { LoanController } from '@src/module.api/loan.controller'
import { Testing } from '@defichain/jellyfish-testing'
import BigNumber from 'bignumber.js'

const container = new LoanMasterNodeRegTestContainer()
let app: NestFastifyApplication
let controller: LoanController
let testing: Testing

beforeAll(async () => {
  await container.start()
  await container.waitForWalletCoinbaseMaturity()
  await container.waitForWalletBalanceGTE(100)

  app = await createTestingApp(container)
  testing = Testing.create(container)
  controller = app.get(LoanController)

  await testing.container.start()
  await testing.container.waitForWalletCoinbaseMaturity()

  const collateralAddress = await testing.generateAddress()
  await testing.token.dfi({
    address: collateralAddress,
    amount: 100000
  })
  await testing.token.create({
    symbol: 'BTC',
    collateralAddress
  })
  await testing.generate(1)
  await testing.token.mint({
    symbol: 'BTC',
    amount: 5
  })
  await testing.generate(1)

  // Loan scheme
  await testing.container.call('createloanscheme', [100, 1, 'default'])
  await testing.generate(1)

  // Price oracle
  const addr = await testing.generateAddress()
  const priceFeeds = [
    {
      token: 'DFI',
      currency: 'USD'
    },
    {
      token: 'BTC',
      currency: 'USD'
    },
    {
      token: 'TSLA',
      currency: 'USD'
    }
  ]
  const oracleId = await testing.rpc.oracle.appointOracle(addr, priceFeeds, { weightage: 1 })
  await testing.generate(1)

  const timestamp = Math.floor(new Date().getTime() / 1000)
  await testing.rpc.oracle.setOracleData(oracleId, timestamp, {
    prices: [{
      tokenAmount: '1@DFI',
      currency: 'USD'
    }]
  })
  await testing.rpc.oracle.setOracleData(oracleId, timestamp, {
    prices: [{
      tokenAmount: '10000@BTC',
      currency: 'USD'
    }]
  })
  await testing.rpc.oracle.setOracleData(oracleId, timestamp, {
    prices: [{
      tokenAmount: '2@TSLA',
      currency: 'USD'
    }]
  })
  await testing.generate(1)

  // Collateral tokens
  await testing.rpc.loan.setCollateralToken({
    token: 'DFI',
    factor: new BigNumber(1),
    fixedIntervalPriceId: 'DFI/USD'
  })
  await testing.rpc.loan.setCollateralToken({
    token: 'BTC',
    factor: new BigNumber(1),
    fixedIntervalPriceId: 'BTC/USD'
  })
  await testing.generate(1)

  // Loan token
  await testing.rpc.loan.setLoanToken({
    symbol: 'TSLA',
    fixedIntervalPriceId: 'TSLA/USD'
  })
  await testing.generate(1)

  // mint loan token TSLA
  await testing.token.mint({ symbol: 'TSLA', amount: 30000 })
  await testing.generate(1)

  // Vault 1
  const ownerAddressVault1 = await testing.generateAddress()
  const vaultId1 = await testing.rpc.container.call('createvault', [ownerAddressVault1, 'default'])
  await testing.generate(1)

  await testing.container.call('deposittovault', [vaultId1, collateralAddress, '1000@DFI'])
  await testing.generate(1)
  await testing.container.call('deposittovault', [vaultId1, collateralAddress, '0.05@BTC'])
  await testing.generate(1)

  await testing.container.call('takeloan', [{
    vaultId: vaultId1,
    amounts: '750@TSLA'
  }])
  await testing.generate(1)

  // Vault 2
  const vaultId2 = await testing.rpc.container.call('createvault', [await testing.generateAddress(), 'default'])
  await testing.generate(1)

  await testing.container.call('deposittovault', [vaultId2, collateralAddress, '2000@0DFI'])
  await testing.generate(1)
  await testing.container.call('deposittovault', [vaultId2, collateralAddress, '0.1@BTC'])
  await testing.generate(1)

  await testing.container.call('takeloan', [{
    vaultId: vaultId2,
    amounts: '1500@TSLA'
  }])
  await testing.generate(1)

  // Vault 3
  const vaultId3 = await testing.rpc.container.call('createvault', [await testing.generateAddress(), 'default'])
  await testing.generate(1)

  await testing.container.call('deposittovault', [vaultId3, collateralAddress, '3000@DFI'])
  await testing.generate(1)
  await testing.container.call('deposittovault', [vaultId3, collateralAddress, '0.15@BTC'])
  await testing.generate(1)

  await testing.container.call('takeloan', [{
    vaultId: vaultId3,
    amounts: '2250@TSLA'
  }])
  await testing.generate(1)

  // Vault 4
  const ownerAddress = await testing.generateAddress()
  const vaultId4 = await testing.rpc.container.call('createvault', [ownerAddress, 'default'])
  await testing.generate(1)

  await testing.container.call('deposittovault', [vaultId4, collateralAddress, '4000@DFI'])
  await testing.generate(1)
  await testing.container.call('deposittovault', [vaultId4, collateralAddress, '0.2@BTC'])
  await testing.generate(1)

  await testing.container.call('takeloan', [{
    vaultId: vaultId4,
    amounts: '3000@TSLA'
  }])
  await testing.generate(1)

  // Going to liquidate the vault by a price increase of the loan token
  await testing.rpc.oracle.setOracleData(oracleId, timestamp, {
    prices: [{
      tokenAmount: '2.2@TSLA',
      currency: 'USD'
    }]
  })
  await testing.generate(12)

  await testing.rpc.account.sendTokensToAddress({}, { [collateralAddress]: ['10000@TSLA'] })
  await testing.generate(1)

  await container.call('placeauctionbid', [vaultId1, 0, collateralAddress, '790@TSLA'])
  await testing.generate(1)

  await container.call('placeauctionbid', [vaultId2, 0, collateralAddress, '1600@TSLA'])
  await testing.generate(1)

  await container.call('placeauctionbid', [vaultId3, 0, collateralAddress, '2400@TSLA'])
  await testing.generate(1)

  await container.call('placeauctionbid', [vaultId4, 0, collateralAddress, '3200@TSLA'])
  await testing.generate(1)

  await testing.generate(40)
})

afterAll(async () => {
  await stopTestingApp(container, app)
})

describe('loan', () => {
  it('should listAuctions', async () => {
    const result = await controller.listAuctionHistory({ size: 0 }, container)
    console.log(JSON.stringify(result))
    expect(result.length).toStrictEqual(4)
    result.forEach((e: any) =>
      expect(e).toStrictEqual({
        auctionBid: expect.any(String),
        auctionWon: expect.any(Object),
        batchIndex: expect.any(Number),
        blockHash: expect.any(String),
        blockHeight: expect.any(Number),
        blockTime: expect.any(Number),
        winner: expect.any(String),
        vaultId: expect.any(String)
      })
    )
  })
})