const coinConfig = require('../configs/LemoCoin')
const testHelper = require('../libs/test_helper')

// Specifically request an abstraction for LemoCoin
const LemoCoin = artifacts.require('LemoCoin')

contract('LemoCoin', function(accounts) {
    const owner = accounts[0] // contract owner, who holds all tokens
    const normalUser = accounts[1] // 0 token from beginning
    const freezer = accounts[8] // who can freeze other's token
    const poorUser = accounts[9] // who has no token

    let instance
    it('deploy', async () => {
        instance = await LemoCoin.deployed()
    })

    it('totalSupply', async () => {
        const totalSupply = await instance.totalSupply()
        assert.equal(totalSupply.toNumber(), coinConfig.totalToken)
    })

    it('name', async () => {
        const name = await instance.name()
        assert.equal(name, 'Lemo')
    })

    it('symbol', async () => {
        const symbol = await instance.symbol()
        assert.equal(symbol, 'LEMO')
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

    it('validBalanceOf(owner)', async () => {
        let balance = await instance.validBalanceOf(owner)
        assert.equal(balance.toNumber(), coinConfig.totalToken)
    })

    it('validBalanceOf(normalUser)', async () => {
        balance = await instance.validBalanceOf(normalUser)
        assert.equal(balance.toNumber(), 0)
    })

    it('validBalanceOf(invalidUser)', async () => {
        balance = await instance.validBalanceOf(testHelper.invalidUser)
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

        await testHelper.transferETHAndCatch(owner, instance.address, 0, testHelper.ASSERT_ERROR_MSG, 'Should reject transfer cause target address is invalid', transferData)
    })

    it('owner.addFreezer(freezer)', async () => {
        await instance.addFreezer(freezer, {from: owner})
    })

    it('owner.removeFreezer(normalUser) before add', async () => {
        await instance.removeFreezer(normalUser, {from: owner})
    })

    it('owner.addFreezer(normalUser); owner.removeFreezer(normalUser)', async () => {
        await instance.addFreezer(normalUser, {from: owner})
        await instance.removeFreezer(normalUser, {from: owner})
    })

    it('normalUser.addFreezer(normalUser); normalUser.removeFreezer(freezer)', async () => {
        let promise = instance.addFreezer(normalUser, {from: normalUser})
        await testHelper.assertReject(promise, 'Should reject addFreezer cause no permission')

        promise = instance.removeFreezer(freezer, {from: normalUser})
        await testHelper.assertReject(promise, 'Should reject removeFreezer cause no permission')
    })

    it('owner.setFreezing(owner, future, 10, 0);freezingBalanceNumberOf(owner);freezingBalanceInfoOf(owner, i)', async () => {
        const fromAccount = owner
        const expireTime = nowSeconds() + 3600
        const amount = 10
        const freezingType = 0

        let starting_balance = await instance.validBalanceOf(owner)
        await instance.setFreezing(owner, expireTime, amount, freezingType, {from: fromAccount})
        let ending_balance = await instance.validBalanceOf(owner)
        assert.equal(ending_balance.toNumber(), starting_balance.toNumber() - amount)

        const event = await testHelper.promisifyEvent(instance, 'SetFreezingEvent')
        assert.equal(event.args.addr, fromAccount)
        assert.equal(event.args.end_stamp.toNumber(), expireTime)
        assert.equal(event.args.num_lemos.toNumber(), amount)
        assert.equal(event.args.freezing_type.toNumber(), freezingType)

        let length = await instance.freezingBalanceNumberOf(owner)
        length = length.toNumber()
        assert.equal(length, 1)
        const info = await instance.freezingBalanceInfoOf(owner, 0)
        assert.equal(info[0].toNumber(), expireTime)
        assert.equal(info[1].toNumber(), amount)
        assert.equal(info[2].toNumber(), freezingType)
    })

    it('freezer.setFreezing(owner, future, 10, 0);validBalanceOf(owner)', async () => {
        const expireTime = nowSeconds() + 3600
        const amount = 10
        const freezingType = 0

        let starting_balance = await instance.validBalanceOf(owner)
        await instance.setFreezing(owner, expireTime, amount, freezingType, {from: freezer})
        let ending_balance = await instance.validBalanceOf(owner)
        assert.equal(ending_balance.toNumber(), starting_balance.toNumber() - amount)
    })

    it('normalUser.setFreezing(owner, future, 10, 0)', async () => {
        const promise = instance.setFreezing(owner, nowSeconds() + 3600, 10, 0, {from: normalUser})
        await testHelper.assertReject(promise, 'Should reject setFreezing cause no permission')
    })

    it('owner.setFreezing(normalUser, future, 10, 0)', async () => {
        const promise = instance.setFreezing(normalUser, nowSeconds() + 3600, 10, 0, {from: owner})
        await testHelper.assertReject(promise, 'Should reject setFreezing cause no balance')
    })

    it('owner.setFreezing(invalidUser, future, 10, 0)', async () => {
        const promise = instance.setFreezing(testHelper.invalidUser, nowSeconds() + 3600, 10, 0, {from: owner})
        await testHelper.assertReject(promise, 'Should reject setFreezing cause account is not exist')
    })

    it('owner.setFreezing(owner, future, -1, 0)', async () => {
        const promise = instance.setFreezing(owner, nowSeconds() + 3600, -1, 0, {from: owner})
        await testHelper.assertReject(promise, 'Should reject freezing -1 token')
    })

    it('owner.setFreezing(owner, past, 10, 0)', async () => {
        const promise = instance.setFreezing(owner, nowSeconds() - 3600, 10, 0, {from: owner})
        await testHelper.assertReject(promise, 'Should reject freezing to a past time')
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
        assert.equal(event.args._from, fromAccount)
        assert.equal(event.args._to, fromAccount)
        assert.equal(event.args._value.toNumber(), amount)
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

    it('owner.transferAndFreezing(normalUser, 10, 10, future, 0)', async () => {
        await transferAndFreezing(owner, normalUser, 10, 10, nowSeconds() + 3600, 0)
    })

    it('owner.transferAndFreezing(normalUser, 10, 11, future, 0)', async () => {
        const promise = instance.transferAndFreezing(normalUser, 10, 11, nowSeconds() + 3600, 0, {from: owner})
        await testHelper.assertReject(promise, 'Should reject transferAndFreezing cause token is not enough')
    })

    it('owner.transferAndFreezing(accounts[2], 10, 10, future, 0); accounts[2].transfer(owner, 10)', async () => {
        const targetAccount = accounts[2]
        const expireTime = nowSeconds() + 3600
        const soonerExpireTime = nowSeconds() + 4
        const amount = 10
        const freezeAmount = 10
        const freezingType = 0

        // The first balance in the queue will be unfreesed in 4 seconds
        await transferAndFreezing(owner, targetAccount, amount, freezeAmount, soonerExpireTime, freezingType)
        await transferAndFreezing(owner, targetAccount, amount, freezeAmount, expireTime, freezingType)
        await testHelper.promiseTimeout(3 * 1000)
        await transfer(targetAccount, owner, 9)
        const promise = instance.transfer(owner, 11, {from: targetAccount})
        await testHelper.assertReject(promise, 'Should transfer cause token is freezing')
    })

    it('owner.transferAndFreezing(accounts[3], 10, 10, future, 0); balanceOf(accounts[3]); validBalanceOf(accounts[3])', async () => {
        const targetAccount = accounts[3]
        const expireTime = nowSeconds() + 3600
        const soonerExpireTime = nowSeconds() + 4
        const amount = 10
        const freezeAmount = 10
        const freezingType = 0

        let starting_balance = await instance.balanceOf(targetAccount)
        let starting_valid_balance = await instance.validBalanceOf(targetAccount)
        // The last balance in the queue will be unfreesed in 4 seconds
        await transferAndFreezing(owner, targetAccount, amount, freezeAmount, expireTime, freezingType)
        await transferAndFreezing(owner, targetAccount, amount, freezeAmount, soonerExpireTime, freezingType)
        await testHelper.promiseTimeout(3 * 1000)
        // Send whatever transaction to update block.stamp
        await transfer(owner, normalUser, 0)

        let ending_balance = await instance.balanceOf(targetAccount)
        let ending_valid_balance = await instance.validBalanceOf(targetAccount)
        assert.equal(ending_balance.toNumber(), starting_balance.toNumber() + amount * 2)
        assert.equal(ending_valid_balance.toNumber(), starting_valid_balance.toNumber() + amount)
    })

    it('owner.transferAndFreezing(accounts[4], 10, 10, future, 0); freezingBalanceNumberOf(accounts[4]); freezingBalanceInfoOf(accounts[4])', async () => {
        const targetAccount = accounts[4]
        const expireTime1 = nowSeconds() + 3600
        const expireTime2 = nowSeconds() + 1800
        const soonerExpireTime = nowSeconds() + 5
        const amount = 10
        const freezeAmount = 10
        const freezingType = 0

        // The last balance in the queue will be unfreesed in 5 seconds
        await transferAndFreezing(owner, targetAccount, amount, freezeAmount, soonerExpireTime, freezingType)
        await transferAndFreezing(owner, targetAccount, amount, freezeAmount, expireTime1, freezingType)
        await transferAndFreezing(owner, targetAccount, amount, freezeAmount, expireTime2, freezingType)
        await testHelper.promiseTimeout(2 * 1000)
        // Send whatever transaction to update block.stamp
        await transfer(owner, normalUser, 0)

        // Haven't update freezing data yet. So the value returned contains freezing data which is expired
        let length = await instance.freezingBalanceNumberOf(targetAccount)
        length = length.toNumber()
        assert.equal(length, 3)

        let info = await instance.freezingBalanceInfoOf(targetAccount, 0)
        assert.equal(info[0].toNumber(), soonerExpireTime)
        assert.equal(info[1].toNumber(), freezeAmount)
        assert.equal(info[2].toNumber(), freezingType)
        info = await instance.freezingBalanceInfoOf(targetAccount, 1)
        assert.equal(info[0].toNumber(), expireTime1)
        assert.equal(info[1].toNumber(), freezeAmount)
        assert.equal(info[2].toNumber(), freezingType)
        info = await instance.freezingBalanceInfoOf(targetAccount, 2)
        assert.equal(info[0].toNumber(), expireTime2)
        assert.equal(info[1].toNumber(), freezeAmount)
        assert.equal(info[2].toNumber(), freezingType)

        await testHelper.promiseTimeout(1000)
        // Update freezing data
        await instance.clearExpiredFreezing(targetAccount)

        length = await instance.freezingBalanceNumberOf(targetAccount)
        length = length.toNumber()
        assert.equal(length, 2)

        info = await instance.freezingBalanceInfoOf(targetAccount, 0)
        assert.equal(info[0].toNumber(), expireTime1)
        assert.equal(info[1].toNumber(), freezeAmount)
        assert.equal(info[2].toNumber(), freezingType)
        info = await instance.freezingBalanceInfoOf(targetAccount, 1)
        assert.equal(info[0].toNumber(), expireTime2)
        assert.equal(info[1].toNumber(), freezeAmount)
        assert.equal(info[2].toNumber(), freezingType)
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

    it('owner.transferFrom(accounts[5], owner, freezing)', async () => {
        const amount = 10
        const targetAccount = accounts[5]

        await transferAndFreezing(owner, targetAccount, amount, amount, nowSeconds() + 3600, 0)
        await instance.approve(owner, amount, {from: targetAccount})
        const promise = instance.transferFrom(targetAccount, owner, amount, {from: owner})
        await testHelper.assertReject(promise, 'Should reject transferFrom cause the balance is freezing')
    })

    it('owner.stop()', async () => {
        // approve normalUser for test transferFrom
        await instance.approve(normalUser, 1, {from: owner})

        await instance.stop({from: owner})
        const stopped = await instance.stopped()
        assert.equal(stopped, true)

        let promise = instance.approve(normalUser, 10, {from: owner})
        await testHelper.assertReject(promise, 'Should reject approve after stop')
        promise = instance.setFreezing(owner, nowSeconds() + 3600, 10, 0, {from: owner})
        await testHelper.assertReject(promise, 'Should reject setFreezing after stop')
        promise = instance.transferAndFreezing(normalUser, 10, 10, nowSeconds() + 3600, 0, {from: owner})
        await testHelper.assertReject(promise, 'Should reject transferAndFreezing after stop')
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
    const instance = await LemoCoin.deployed()
    const fromAccount_starting_balance = await instance.balanceOf(fromAccount)
    const toAccount_starting_balance = await instance.balanceOf(toAccount)
    await instance.transfer(toAccount, amount, {from: fromAccount})
    const event = await testHelper.promisifyEvent(instance, 'Transfer')
    const fromAccount_ending_balance = await instance.balanceOf(fromAccount)
    const toAccount_ending_balance = await instance.balanceOf(toAccount)

    assert.equal(fromAccount_ending_balance.toNumber(), fromAccount_starting_balance.toNumber() - amount, `send ${amount} token`)
    assert.equal(toAccount_ending_balance.toNumber(), toAccount_starting_balance.toNumber() + amount, `receive ${amount} token`)
    assert.equal(event.args._from, fromAccount)
    assert.equal(event.args._to, toAccount)
    assert.equal(event.args._value.toNumber(), amount)
}

/**
 * @param {string} fromAccount
 * @param {string} toAccount
 * @param {number} amount
 * @param {number} freezeAmount
 * @param {number} expireTime
 * @param {number} freezingType
 * @return {Promise}
 */
async function transferAndFreezing(fromAccount, toAccount, amount, freezeAmount, expireTime, freezingType) {
    const instance = await LemoCoin.deployed()
    const fromAccount_starting_balance = await instance.balanceOf(fromAccount)
    const toAccount_starting_balance = await instance.balanceOf(toAccount)
    const toAccount_starting_valid_balance = await instance.validBalanceOf(toAccount)
    await instance.transferAndFreezing(toAccount, amount, freezeAmount, expireTime, freezingType, {from: fromAccount})
    const transferEvent = await testHelper.promisifyEvent(instance, 'Transfer')
    const setFreezingEvent = await testHelper.promisifyEvent(instance, 'SetFreezingEvent')
    const fromAccount_ending_balance = await instance.balanceOf(fromAccount)
    const toAccount_ending_balance = await instance.balanceOf(toAccount)
    const toAccount_ending_valid_balance = await instance.validBalanceOf(toAccount)

    assert.equal(fromAccount_ending_balance.toNumber(), fromAccount_starting_balance.toNumber() - amount, `send ${amount} token`)
    assert.equal(toAccount_ending_balance.toNumber(), toAccount_starting_balance.toNumber() + amount, `receive ${amount} token`)
    assert.equal(toAccount_ending_valid_balance.toNumber(), toAccount_starting_valid_balance.toNumber())
    assert.equal(transferEvent.args._from, fromAccount)
    assert.equal(transferEvent.args._to, toAccount)
    assert.equal(transferEvent.args._value.toNumber(), amount)
    assert.equal(setFreezingEvent.args.addr, toAccount)
    assert.equal(setFreezingEvent.args.end_stamp.toNumber(), expireTime)
    assert.equal(setFreezingEvent.args.num_lemos.toNumber(), freezeAmount)
    assert.equal(setFreezingEvent.args.freezing_type.toNumber(), freezingType)
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
    const instance = await LemoCoin.deployed()
    const fromAccount_starting_balance = await instance.balanceOf(fromAccount)
    const toAccount_starting_balance = await instance.balanceOf(toAccount)
    await instance.transferFrom(fromAccount, toAccount, amount, {from: operator})
    const event = await testHelper.promisifyEvent(instance, 'Transfer')
    const fromAccount_ending_balance = await instance.balanceOf(fromAccount)
    const toAccount_ending_balance = await instance.balanceOf(toAccount)

    assert.equal(fromAccount_ending_balance.toNumber(), fromAccount_starting_balance.toNumber() - amount, `send ${amount} token`)
    assert.equal(toAccount_ending_balance.toNumber(), toAccount_starting_balance.toNumber() + amount, `receive ${amount} token`)
    assert.equal(event.args._from, fromAccount)
    assert.equal(event.args._to, toAccount)
    assert.equal(event.args._value.toNumber(), amount)
}

/**
 * Show all datas in contract's storage
 * @return {Promise}
 */
async function showAllCoinData() {
    const instance = await LemoCoin.deployed()
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
