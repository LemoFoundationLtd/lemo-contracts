const coinConfig = require('../configs/LemoCoin')
const saleConfig = require('../configs/LemoSale')
const testHelper = require('../libs/test_helper')

// Specifically request an abstraction for LemoCoin
const LemoCoin = artifacts.require('LemoCoin')
const LemoSale = artifacts.require('LemoSale')

contract('LemoSale_success', function(accounts) {
    const owner = accounts[0] // contract owner, who holds all tokens
    const normalUser = accounts[1] // 0 token from beginning
    const poorUser = accounts[9] // who has no token
    const FINNEY = 1000000000000000 // amount of wei in 1 finney

    console.log('owner', web3.eth.getBalance(owner).toNumber())
    console.log('normalUser', web3.eth.getBalance(normalUser).toNumber())

    let coinInstance
    let saleInstance
    it('deploy', async () => {
        coinInstance = await LemoCoin.deployed()
        saleInstance = await LemoSale.deployed()
    })

    it('constructor', async () => {
        const finney2LemoRate = await saleInstance.finney2LemoRate()
        const tokenContributionCap = await saleInstance.tokenContributionCap()
        const tokenContributionMin = await saleInstance.tokenContributionMin()
        assert.equal(saleConfig.FINNEY_TO_LEMO_RATE, finney2LemoRate.toNumber())
        assert.equal(saleConfig.HARD_CAP, tokenContributionCap.toNumber())
        assert.equal(saleConfig.SOFT_CAP, tokenContributionMin.toNumber())
    })

    it('owner.setTokenContract', async () => {
        await saleInstance.setTokenContract(coinInstance.address)
        const token = await saleInstance.token()
        assert.equal(token, coinInstance.address)
    })

    it('normalUser.setTokenContract', async () => {
        const promise = saleInstance.setTokenContract(coinInstance.address, {from: normalUser})
        await testHelper.assertReject(promise, 'Should reject setTokenContract cause no permission')
    })

    it('poorUser.transferETH(owner, all ETH)', async () => {
        const ownerOldEth = web3.eth.getBalance(owner)
        const poorOldEth = web3.eth.getBalance(poorUser)
        // keep some eth for gas. Have to set at least five 0 at the loweast order, or else the error 'significant digit is bigger than 15' will occur
        const amount = poorOldEth.minus(500000 * testHelper.GAS_PRICE).toNumber()
        const finney = Number(web3.fromWei(amount)) * 1000
        const gas = await  web3.eth.estimateGas({to: owner, value: amount})
        const txHash = await testHelper.transferETH(poorUser, owner, finney)
        const ownerNewEth = web3.eth.getBalance(owner)
        const poorNewEth = web3.eth.getBalance(poorUser)

        assert.equal(gas * testHelper.GAS_PRICE, testHelper.getGasWei(txHash))
        assert.equal(ownerOldEth.plus(amount).toNumber(), ownerNewEth.toNumber(), `receive ETH ${amount}`)
        assert.equal(poorOldEth.minus(amount).minus(gas * testHelper.GAS_PRICE).toNumber(), poorNewEth.toNumber(), `send ETH ${poorOldEth.toNumber()} - ${amount} - ${gas * testHelper.GAS_PRICE}(gas)`)
    })

    it('owner.initialize', async () => {
        const random = Math.floor(Math.random() * 1000)
        await saleInstance.initialize(saleConfig.START_TIME + random, saleConfig.END_TIME + random, saleConfig.MIN_FINNEY + random)
        const startTime = await saleInstance.startTime()
        const endTime = await saleInstance.endTime()
        const minPayment = await saleInstance.minPayment()
        assert.equal(saleConfig.START_TIME + random, startTime.toNumber())
        assert.equal(saleConfig.END_TIME + random, endTime.toNumber())
        assert.equal(FINNEY * (saleConfig.MIN_FINNEY + random), minPayment.toNumber())
    })

    it('normalUser.initialize', async () => {
        const promise = saleInstance.initialize(saleConfig.START_TIME, saleConfig.END_TIME, saleConfig.MIN_FINNEY, {from: normalUser})
        await testHelper.assertReject(promise, 'Should reject initialize cause no permission')
    })

    it('normalUser.transferETH(saleConfig.MIN_FINNEY) before start', async () => {
        await coinInstance.approve(saleInstance.address, coinConfig.totalToken - 900, {from: owner})
        await saleInstance.initialize(saleConfig.END_TIME - 1, saleConfig.END_TIME, saleConfig.MIN_FINNEY)

        await testHelper.transferETHAndCatch(normalUser, saleInstance.address, saleConfig.MIN_FINNEY, testHelper.DEFAULT_TRANSACTION_ERROR_MSG, 'Should reject transferETHAndCatch cause ICO is not start')
    })

    it('poorUser.transferETH(saleConfig.MIN_FINNEY)', async () => {
        await testHelper.transferETHAndCatch(poorUser, saleInstance.address, saleConfig.MIN_FINNEY, testHelper.NOT_ENOUGH_ETH_ERROR_MSG, 'Should reject transferETH cause balance is not enough')
    })

    it('normalUser.transferETH(saleConfig.MIN_FINNEY - 1)', async () => {
        await saleInstance.initialize(saleConfig.START_TIME, saleConfig.END_TIME, saleConfig.MIN_FINNEY)
        console.log('    /********** ICO start **********/')

        await testHelper.transferETHAndCatch(normalUser, saleInstance.address, saleConfig.MIN_FINNEY - 1, testHelper.DEFAULT_TRANSACTION_ERROR_MSG, 'Should reject transferETH cause payment is less than min payment limit')
    })

    it('normalUser.transferETH(saleConfig.MIN_FINNEY + 10)', async () => {
        const finney = saleConfig.MIN_FINNEY + 10

        const oldLemo = await coinInstance.balanceOf(normalUser)
        await testHelper.transferETH(normalUser, saleInstance.address, finney)
        const newLemo = await coinInstance.balanceOf(normalUser)
        const gotLemo = finney * saleConfig.FINNEY_TO_LEMO_RATE
        assert.equal(oldLemo.toNumber() + gotLemo, newLemo.toNumber())
    })

    it('normalUser.contribute(saleConfig.MIN_FINNEY);soldAmount;contributionCount', async () => {
        const finney = saleConfig.MIN_FINNEY

        const oldLemo = await coinInstance.balanceOf(normalUser)
        const oldSoldAmount = await saleInstance.soldAmount()
        const oldContributionCount = await saleInstance.contributionCount()
        await saleInstance.contribute({from: normalUser, value: web3.toWei(finney, 'finney')})
        const newLemo = await coinInstance.balanceOf(normalUser)
        const gotLemo = finney * saleConfig.FINNEY_TO_LEMO_RATE
        const newSoldAmount = await saleInstance.soldAmount()
        const newContributionCount = await saleInstance.contributionCount()
        assert.equal(oldLemo.toNumber() + gotLemo, newLemo.toNumber())
        assert.equal(oldSoldAmount.toNumber() + gotLemo, newSoldAmount.toNumber())
        assert.equal(oldContributionCount.toNumber() + 1, newContributionCount.toNumber())
    })

    it('normalUser.transferETH(allowance + 10)', async () => {
        const allowance = saleConfig.MIN_FINNEY * saleConfig.FINNEY_TO_LEMO_RATE
        const finney = saleConfig.MIN_FINNEY + 10
        await coinInstance.approve(saleInstance.address, allowance, {from: owner})

        await testHelper.transferETHAndCatch(normalUser, saleInstance.address, finney, testHelper.DEFAULT_TRANSACTION_ERROR_MSG, 'Should reject transferETH cause the ICO allowance is used out')
        await coinInstance.approve(saleInstance.address, coinConfig.totalToken - 900, {from: owner})
    })

    it('owner.finalize() before end', async () => {
        const promise = saleInstance.finalize()
        await testHelper.assertReject(promise, 'Should reject finalize cause the ICO is not end')
    })

    it('normalUser.refund() before end', async () => {
        const promise = saleInstance.refund()
        await testHelper.assertReject(promise, 'Should reject refund cause the ICO is not end')
    })

    it('normalUser.transferETH(all left lemo + 10 finney)', async () => {
        const oldEth = web3.eth.getBalance(normalUser)
        const oldSoldAmount = await saleInstance.soldAmount()
        const tokenContributionCap = await saleInstance.tokenContributionCap()
        const left = tokenContributionCap.toNumber() - oldSoldAmount.toNumber()
        const oldLemo = await coinInstance.balanceOf(normalUser)
        const leftFinney = Math.floor(left / saleConfig.FINNEY_TO_LEMO_RATE)
        const gas = await web3.eth.estimateGas({
            from: normalUser,
            to: saleInstance.address,
            value: web3.toWei(leftFinney + 10, 'finney')
        })
        const txHash = await testHelper.transferETH(normalUser, saleInstance.address, leftFinney + 10)
        const newLemo = await coinInstance.balanceOf(normalUser)
        const newEth = web3.eth.getBalance(normalUser)
        const newSoldAmount = await saleInstance.soldAmount()

        assert.equal(gas * testHelper.GAS_PRICE, testHelper.getGasWei(txHash))
        assert.equal(oldLemo.toNumber() + left, newLemo.toNumber())
        assert.equal(oldEth.minus(leftFinney * FINNEY).minus(gas * testHelper.GAS_PRICE).toNumber(), newEth.toNumber())
        assert.equal(newSoldAmount.toNumber(), tokenContributionCap.toNumber())
    })

    it('normalUser.transferETH(saleConfig.MIN_FINNEY) after sold out', async () => {
        console.log('    /********** Sold out **********/')

        await testHelper.transferETHAndCatch(normalUser, saleInstance.address, saleConfig.MIN_FINNEY, testHelper.DEFAULT_TRANSACTION_ERROR_MSG, 'Should reject transferETH cause there is no token left')
    })

    it('normalUser.transferETH(saleConfig.MIN_FINNEY) after end', async () => {
        await saleInstance.initialize(saleConfig.START_TIME - 100, saleConfig.START_TIME - 99, saleConfig.MIN_FINNEY)
        console.log('    /********** ICO end **********/')

        await testHelper.transferETHAndCatch(normalUser, saleInstance.address, saleConfig.MIN_FINNEY, testHelper.DEFAULT_TRANSACTION_ERROR_MSG, 'Should reject transferETH cause the ICO is end')
    })

    it('normalUser.refund() after softcap reached', async () => {
        const promise = saleInstance.refund({from: normalUser})
        await testHelper.assertReject(promise, 'Should reject refund cause the soft cap is reached')
    })

    it('normalUser.finalize()', async () => {
        const promise = saleInstance.finalize({from: normalUser})
        await testHelper.assertReject(promise, 'Should reject finalize cause no permission')
    })

    it('owner.finalize()', async () => {
        const oldOwnerEth = web3.eth.getBalance(owner)
        const oldContractEth = web3.eth.getBalance(saleInstance.address)
        const gas = await saleInstance.finalize.estimateGas()
        const receipt = await saleInstance.finalize({gasPrice: testHelper.GAS_PRICE})
        const newFunding = await saleInstance.funding()
        const newOwnerEth = web3.eth.getBalance(owner)
        const newContractEth = web3.eth.getBalance(saleInstance.address)

        assert.equal(gas * testHelper.GAS_PRICE, testHelper.getGasWei(receipt.tx))
        assert.equal(newFunding, false)
        assert.equal(oldOwnerEth.plus(oldContractEth).minus(gas * testHelper.GAS_PRICE).toNumber(), newOwnerEth.toNumber(), 'owner got ETH')
        assert.equal(newContractEth.toNumber(), 0, 'clear ETH in contract')
    })

    it('owner.finalize() again', async () => {
        const promise = saleInstance.finalize()
        await testHelper.assertReject(promise, 'finalize can be run only once')
    })

    it('owner.destroy() during lock time', async () => {
        const promise = saleInstance.destroy()
        await testHelper.assertReject(promise, 'Should reject destroy cause the storage will lock for 3 months after ICO end')
    })

    it('owner.destroy()', async () => {
        const lockTime = 3600 * 24 * 30 * 3
        await saleInstance.initialize(saleConfig.START_TIME - lockTime - 100, saleConfig.START_TIME - lockTime - 99, saleConfig.MIN_FINNEY)
        console.log('    /********** Unlock ICO destroy **********/')

        await saleInstance.destroy()

        const promise = saleInstance.destroy()
        await testHelper.assertReject(promise, 'Should reject destroy cause the contract has gone', testHelper.CONTRACT_HAS_GONE)
    })
})

/**
 * Show all datas in contract's storage
 * @return {Promise}
 */
async function showAllSaleData() {
    const instance = await LemoSale.deployed()
    console.log('address', instance.address)
    console.log('owner', await instance.owner())
    console.log('authority', await instance.authority())
    console.log('funding', await instance.funding())
    console.log('token', await instance.token())
    await logNumber('finney2LemoRate')
    await logNumber('tokenContributionCap')
    await logNumber('tokenContributionMin')
    await logNumber('startTime')
    await logNumber('endTime')
    await logNumber('minPayment')
    await logNumber('soldAmount')
    await logNumber('contributionCount')

    async function logNumber(funcName) {
        const num = await instance[funcName]()
        console.log(funcName, num.toNumber())
    }
}
