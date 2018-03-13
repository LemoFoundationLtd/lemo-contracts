const coinConfig = require('../configs/LemoCoin')
const saleConfig = require('../configs/LemoSale')
const testHelper = require('../libs/test_helper')

// Specifically request an abstraction for LemoCoin
const LemoCoin = artifacts.require('LemoCoin')
const LemoSale = artifacts.require('LemoSale')

contract('LemoSale_fail', function(accounts) {
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

    it('init', async () => {
        await saleInstance.setTokenContract(coinInstance.address)
        await saleInstance.initialize(saleConfig.START_TIME, saleConfig.END_TIME, saleConfig.MIN_FINNEY)
        await coinInstance.approve(saleInstance.address, coinConfig.totalToken - 900, {from: owner})
        console.log('    /********** ICO start **********/')

        await testHelper.transferETH(normalUser, saleInstance.address, saleConfig.MIN_FINNEY + 10)
        await testHelper.transferETH(poorUser, saleInstance.address, saleConfig.MIN_FINNEY + 10)
    })

    it('owner.finalize() before softCap reached', async () => {
        await saleInstance.initialize(saleConfig.START_TIME - 100, saleConfig.START_TIME - 99, saleConfig.MIN_FINNEY)
        console.log('    /********** ICO end **********/')

        const soldAmount = await saleInstance.soldAmount()
        const tokenContributionMin = await saleInstance.tokenContributionMin()
        if (soldAmount.toNumber() >= tokenContributionMin.toNumber()) {
            console.error(`Please reach soft cap to test ICO fail case. soldAmount: ${soldAmount.toNumber()}, soft cap: ${tokenContributionMin.toNumber()}`)
        }
        const promise = saleInstance.finalize()
        await testHelper.assertReject(promise, 'Should reject finalize cause the soft cap is not reached')
    })

    it('normalUser.refund()', async () => {

        const soldAmount = await saleInstance.soldAmount()
        const tokenContributionMin = await saleInstance.tokenContributionMin()
        if (soldAmount.toNumber() >= tokenContributionMin.toNumber()) {
            console.error(`Please don't reach soft cap to test refund case. soldAmount: ${soldAmount.toNumber()}, soft cap: ${tokenContributionMin.toNumber()}`)
        }

        const oldUserLemo = await coinInstance.balanceOf(normalUser)
        await coinInstance.approve(saleInstance.address, oldUserLemo, {from: normalUser})
        const oldContractEth = web3.eth.getBalance(saleInstance.address)
        const oldUserEth = web3.eth.getBalance(normalUser)
        const oldsoldAmount = await saleInstance.soldAmount()
        const gas = await saleInstance.refund.estimateGas({from: normalUser})
        const receipt = await saleInstance.refund({from: normalUser, gasPrice: testHelper.GAS_PRICE})
        const newUserLemo = await coinInstance.balanceOf(normalUser)
        const newContractEth = web3.eth.getBalance(saleInstance.address)
        const newUserEth = web3.eth.getBalance(normalUser)
        const newsoldAmount = await saleInstance.soldAmount()
        const refundEth = web3.toWei(oldUserLemo / saleConfig.FINNEY_TO_LEMO_RATE, 'finney')

        assert.equal(gas * testHelper.GAS_PRICE, testHelper.getGasWei(receipt.tx))
        assert.equal(oldContractEth.minus(refundEth).toNumber(), newContractEth.toNumber())
        assert.equal(oldsoldAmount.minus(oldUserLemo).toNumber(), newsoldAmount.toNumber())
        assert.equal(oldUserEth.plus(refundEth).minus(gas * testHelper.GAS_PRICE).toNumber(), newUserEth.toNumber())
        assert.equal(newUserLemo.toNumber(), 0)
    })

    it('normalUser.refund() nothing', async () => {
        const promise = saleInstance.refund()
        await testHelper.assertReject(promise, 'Should reject refund cause no token balance')
    })

    it('owner.withdraw() during lock time', async () => {
        const promise = saleInstance.withdraw()
        await testHelper.assertReject(promise, 'Should reject withdraw cause the eth will lock for 3 months after ICO end')
    })

    it('normalUser.withdraw()', async () => {
        const promise = saleInstance.withdraw({from: normalUser})
        await testHelper.assertReject(promise, 'Should reject withdraw cause no permission')
    })

    it('owner.withdraw()', async () => {
        const lockTime = 3600 * 24 * 30 * 3
        await saleInstance.initialize(saleConfig.START_TIME - lockTime - 100, saleConfig.START_TIME - lockTime - 99, saleConfig.MIN_FINNEY)
        console.log('    /********** Unlock failed ICO **********/')

        const oldOwnerEth = web3.eth.getBalance(owner)
        const oldContractEth = web3.eth.getBalance(saleInstance.address)
        const gas = await saleInstance.withdraw.estimateGas()
        const receipt = await saleInstance.withdraw({gasPrice: testHelper.GAS_PRICE})
        const newOwnerEth = web3.eth.getBalance(owner)
        const newContractEth = web3.eth.getBalance(saleInstance.address)

        assert.equal(gas * testHelper.GAS_PRICE, testHelper.getGasWei(receipt.tx))
        assert.equal(oldOwnerEth.plus(oldContractEth).minus(gas * testHelper.GAS_PRICE).toNumber(), newOwnerEth.toNumber(), 'owner got ETH')
        assert.equal(newContractEth.toNumber(), 0, 'clear ETH in contract')
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
