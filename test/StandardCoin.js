const coinConfig = require('../configs/StandardCoin')
const testHelper = require('../libs/test_helper')

// Specifically request an abstraction for StandardCoin
const StandardCoin = artifacts.require('StandardCoin')

contract('StandardCoin', function(accounts) {
    const owner = accounts[0] // contract owner, who holds all tokens
    const normalUser = accounts[1] // 0 token from beginning
    const poorUser = accounts[9] // who has no token

    let instance
    it('deploy', async () => {
        instance = await StandardCoin.deployed()
    })

    it('totalSupply', async () => {
        const totalSupply = await instance.totalSupply()
        assert.equal(totalSupply.toNumber(), coinConfig.totalToken)
    })

    it('name', async () => {
        const name = await instance.name()
        assert.equal(name, 'Standard Coin')
    })

    it('symbol', async () => {
        const symbol = await instance.symbol()
        assert.equal(symbol, 'COIN')
    })

    it('decimals', async () => {
        const decimals = await instance.decimals()
        assert.equal(decimals, 18)
    })

    it('owner', async () => {
        const ownerName = await instance.owner()
        assert.equal(ownerName, owner)
    })

    it('balanceOf(owner)', async () => {
        let balance = await instance.balanceOf(owner)
        assert.equal(balance.toNumber(), coinConfig.totalToken)
    })

    it('balanceOf(normalUser)', async () => {
        balance = await instance.balanceOf(normalUser)
        assert.equal(balance.toNumber(), 0)
    })

    it('balanceOf(invalidUser)', async () => {
        balance = await instance.balanceOf(testHelper.invalidUser)
        assert.equal(balance.toNumber(), 0)
    })

    it('owner.setName("new name")', async () => {
        await instance.setName('new name', {from: owner})
        const name = await instance.name()
        assert.equal(name, 'new name')
    })

    it('normalUser.setName("another name")', async () => {
        const promise = instance.setName('another name', {from: normalUser})
        await testHelper.assertReject(promise, 'Should reject setName cause no permission')
    })

    it('transfer(short address)', async () => {
        // Test the short address bug. https://blog.golemproject.net/how-to-find-10m-by-just-reading-blockchain-6ae9d39fcd95
        // const data = await testHelper.encodeABIParams(instance, 'transfer', accounts[4], 1000)
        const transferData = '0xa9059cbb0000000000000000000000000d1d4e623d10f9fba5db95830f7d3839406c6af00000000000000000000000000000000000000000000000000000000000003e8'

        await testHelper.transferETHAndCatch(owner, instance.address, 0, testHelper.DEFAULT_TRANSACTION_ERROR_MSG, 'Should reject transfer cause target address is invalid', transferData)
    })

    it('stopped', async () => {
        const stopped = await instance.stopped()
        assert.equal(stopped, false, 'stopped is false from beginning')
    })

    it('owner.transfer(normalUser, 10)', async () => {
        await transfer(owner, normalUser, 10)
    })

    it('owner.transfer(owner, 10)', async () => {
        const fromAccount = owner
        const amount = 10

        // testHelper.logOn(instance)
        const fromAccount_starting_balance = await instance.balanceOf(fromAccount)
        await instance.transfer(fromAccount, amount, {from: fromAccount})
        const event = await testHelper.promisifyEvent(instance, 'Transfer')
        const fromAccount_ending_balance = await instance.balanceOf(fromAccount)

        assert.equal(fromAccount_ending_balance.toNumber(), fromAccount_starting_balance.toNumber())
        assert.equal(event.args.from, fromAccount)
        assert.equal(event.args.to, fromAccount)
        assert.equal(event.args.value.toNumber(), amount)
        // testHelper.logOff()
    })

    it('owner.transfer(invalidUser, 10)', async () => {
        await transfer(owner, testHelper.invalidUser, 10)
    })

    it('owner.transfer(normalUser, 0)', async () => {
        await transfer(owner, normalUser, 0)
    })

    it('owner.transfer(normalUser, -1)', async () => {
        const promise = instance.transfer(normalUser, -1, {from: owner})
        await testHelper.assertReject(promise, 'Should reject transfer -1 token')
    })

    it('poorUser.transfer(owner, 10)', async () => {
        const promise = instance.transfer(owner, 10, {from: poorUser})
        await testHelper.assertReject(promise, 'Should reject transfer cause token is not enough')
    })

    it('allowance(owner, normalUser)', async () => {
        const allowance = await instance.allowance(owner, normalUser)
        assert.equal(allowance.toNumber(), 0)
    })

    it('owner.approve(normalUser, 10)', async () => {
        const fromAccount = owner
        const toAccount = normalUser
        const amount = 10
        const amount2 = 20

        await instance.approve(toAccount, amount, {from: fromAccount})
        let allowance = await instance.allowance(fromAccount, toAccount)
        assert.equal(allowance.toNumber(), amount)

        // Approve twice, the allowance will be covered
        await instance.approve(toAccount, amount2, {from: fromAccount})
        allowance = await instance.allowance(fromAccount, toAccount)
        assert.equal(allowance.toNumber(), amount2)
    })

    it('owner.approve(owner, 10)', async () => {
        const fromAccount = owner
        const toAccount = owner
        const amount = 10

        await instance.approve(toAccount, amount, {from: fromAccount})
        const allowance = await instance.allowance(fromAccount, toAccount)
        assert.equal(allowance.toNumber(), amount)
    })

    it('owner.approve(normalUser, -1)', async () => {
        const fromAccount = owner
        const toAccount = normalUser
        const amount = -1

        const promise = instance.approve(toAccount, amount, {from: fromAccount})
        await testHelper.assertReject(promise, 'Should reject approve -1 token')
    })

    it('normalUser.transferFrom(owner, normalUser, 10)', async () => {
        const amount = 10

        await instance.approve(normalUser, amount, {from: owner})
        await transferFrom(normalUser, owner, normalUser, amount)
    })

    it('normalUser.transferFrom(owner, normalUser, more than allowance)', async () => {
        const amount = 10

        await instance.approve(normalUser, amount, {from: owner})
        const promise = instance.transferFrom(owner, normalUser, amount + 1, {from: normalUser})
        await testHelper.assertReject(promise, 'Should reject transferFrom cause the amount is bigger than allowance')
    })

    it('normalUser.transferFrom(owner, normalUser, not enough)', async () => {
        // transfer tokens out to make the amount below less than total apply, and make sure the approve will be run correctly
        await transfer(owner, normalUser, 10)
        const balance = await instance.balanceOf(owner)
        const amount = balance.toNumber() + 1
        await instance.approve(normalUser, amount, {from: owner})
        const promise = instance.transferFrom(owner, normalUser, amount, {from: normalUser})
        await testHelper.assertReject(promise, 'Should reject transferFrom cause the balance is not enough')
    })

    it('owner.stop()', async () => {
        // approve normalUser for test transferFrom
        await instance.approve(normalUser, 1, {from: owner})

        await instance.stop({from: owner})
        const stopped = await instance.stopped()
        assert.equal(stopped, true)

        let promise = instance.approve(normalUser, 10, {from: owner})
        await testHelper.assertReject(promise, 'Should reject approve after stop')
        promise = instance.transfer(normalUser, 10, {from: owner})
        await testHelper.assertReject(promise, 'Should reject transfer after stop')
        promise = instance.transferFrom(owner, normalUser, 1, {from: normalUser})
        await testHelper.assertReject(promise, 'Should reject transferFrom after stop')
    })

    it('owner.start()', async () => {
        await instance.start({from: owner})
        const stopped = await instance.stopped()
        assert.equal(stopped, false)

        // Sending transaction is enable now
        await instance.approve(normalUser, 1, {from: owner})
    })

    it('normalUser.stop()', async () => {
        const promise = instance.stop({from: normalUser})
        await testHelper.assertReject(promise, 'Should reject stop cause no permission')
    })

    it('normalUser.start()', async () => {
        const promise = instance.start({from: normalUser})
        await testHelper.assertReject(promise, 'Should reject start cause no permission')
    })

    it('transferETH(contract address, 1 finney)', async () => {
        await testHelper.transferETHAndCatch(normalUser, instance.address, 1, testHelper.DEFAULT_TRANSACTION_ERROR_MSG, 'Should reject transfer cause contract address is not payable')
    })

    // TODO gas is not enough
})

/**
 * transfer token
 * @param {string} fromAccount
 * @param {string} toAccount
 * @param {number} amount
 * @return {Promise}
 */
async function transfer(fromAccount, toAccount, amount) {
    const instance = await StandardCoin.deployed()
    const fromAccount_starting_balance = await instance.balanceOf(fromAccount)
    const toAccount_starting_balance = await instance.balanceOf(toAccount)
    await instance.transfer(toAccount, amount, {from: fromAccount})
    const event = await testHelper.promisifyEvent(instance, 'Transfer')
    const fromAccount_ending_balance = await instance.balanceOf(fromAccount)
    const toAccount_ending_balance = await instance.balanceOf(toAccount)

    assert.equal(fromAccount_ending_balance.toNumber(), fromAccount_starting_balance.toNumber() - amount, `send ${amount} token`)
    assert.equal(toAccount_ending_balance.toNumber(), toAccount_starting_balance.toNumber() + amount, `receive ${amount} token`)
    assert.equal(event.args.from, fromAccount)
    assert.equal(event.args.to, toAccount)
    assert.equal(event.args.value.toNumber(), amount)
}

/**
 * operator transfer fromAccount's token to toAccount
 * @param {string} operator should be approved firstly
 * @param {string} fromAccount
 * @param {string} toAccount
 * @param {number} amount
 * @return {Promise}
 */
async function transferFrom(operator, fromAccount, toAccount, amount) {
    const instance = await StandardCoin.deployed()
    const fromAccount_starting_balance = await instance.balanceOf(fromAccount)
    const toAccount_starting_balance = await instance.balanceOf(toAccount)
    await instance.transferFrom(fromAccount, toAccount, amount, {from: operator})
    const event = await testHelper.promisifyEvent(instance, 'Transfer')
    const fromAccount_ending_balance = await instance.balanceOf(fromAccount)
    const toAccount_ending_balance = await instance.balanceOf(toAccount)

    assert.equal(fromAccount_ending_balance.toNumber(), fromAccount_starting_balance.toNumber() - amount, `send ${amount} token`)
    assert.equal(toAccount_ending_balance.toNumber(), toAccount_starting_balance.toNumber() + amount, `receive ${amount} token`)
    assert.equal(event.args.from, fromAccount)
    assert.equal(event.args.to, toAccount)
    assert.equal(event.args.value.toNumber(), amount)
}

/**
 * Show all datas in contract's storage
 * @return {Promise}
 */
async function showAllCoinData() {
    const instance = await StandardCoin.deployed()
    console.log('address', instance.address)
    console.log('owner', await instance.owner())
    console.log('authority', await instance.authority())
    console.log('name', await instance.name())
    console.log('stopped', await instance.stopped())
    console.log('symbol', await instance.symbol())
    await logNumber('decimals')
    await logNumber('totalSupply')

    async function logNumber(funcName) {
        const num = await instance[funcName]()
        console.log(funcName, num.toNumber())
    }
}

/**
 * Get current stamp in seconds
 * @return {number}
 */
function nowSeconds() {
    return Math.floor(Date.now() / 1000)
}
