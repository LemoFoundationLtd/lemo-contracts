const abi = require('ethjs-abi')

const invalidUser = '0x0000000000000000000000000000000000000000'
const DEFAULT_TRANSACTION_ERROR_MSG = 'VM Exception while processing transaction: revert'
const ASSERT_ERROR_MSG = 'VM Exception while processing transaction: invalid opcode'
const NOT_ENOUGH_ETH_ERROR_MSG = 'sender doesn\'t have enough funds to send tx'
const CONTRACT_HAS_GONE = 'is not a contract address'
// 1 gwei
const GAS_PRICE = 1000000000

/**
 * Try and expect a certain exception
 * @param {Function} promise
 * @param {string} wording
 * @param {string?} expectedErrorMsg expect assert failing by default
 * @return {Promise}
 */
async function assertReject(promise, wording, expectedErrorMsg) {
    try {
        await promise
    } catch (e) {
        if (expectedErrorMsg) {
            assert.equal(e.message.includes(expectedErrorMsg), true)
        } else {
            assert.equal(e.message, expectedErrorMsg || DEFAULT_TRANSACTION_ERROR_MSG)
        }
        return
    }
    throw new Error(wording)
}

/**
 * @param {string} fromAccount
 * @param {string} toAccount
 * @param {number} finney amount
 * @return {Promise}
 */
async function transferETH(fromAccount, toAccount, finney) {
    return new Promise((resolve, reject) => {
        web3.eth.sendTransaction({
            from: fromAccount,
            to: toAccount,
            value: web3.toWei(finney, 'finney'),
            gas: 150000,
            gasPrice: GAS_PRICE,
        }, (error, result) => {
            if (error) {
                reject(error)
            } else if (!result) {
                reject(new Error('no txHash'))
            } else {
                resolve(result)
            }
        })
    })
}

/**
 * Send an wrong transaction and catch the exception
 * @param {string} fromAccount
 * @param {string} toAccount
 * @param {number} finney amount
 * @param {string} exceptErrMsg should throw exception with this message
 * @param {string} msgIfNoError reject this error if haven't caught the exception we expected
 * @param {string?} data contract params
 * @return {Promise}
 */
async function transferETHAndCatch(fromAccount, toAccount, finney, exceptErrMsg, msgIfNoError, data) {
    return new Promise((resolve, reject) => {
        web3.eth.sendTransaction({
            from: fromAccount,
            to: toAccount,
            value: web3.toWei(finney, 'finney'),
            data,
            gas: 150000
        }, (error, result) => {
            if (error && error.message.includes(exceptErrMsg)) {
                resolve()
            } else if (error) {
                reject(error)
            } else {
                reject(new Error(msgIfNoError))
            }
        })
    })
}

/**
 * Encode the function parameters by ABI format
 * @param {object} instance contract instance
 * @param {string?} methodName It means traditional transfer of ETH without this parameter
 * @param {Array?} params The parameters of contract function
 * @return {Promise}
 */
async function encodeABIParams(instance, methodName, ...params) {
    const methodInfo = instance.abi.find(item => item.name === methodName)
    if (!methodInfo) {
        console.error(`No such method [${methodName}] in ABI`)
        return ''
    }
    return abi.encodeMethod(methodInfo, params)
}

/**
 * Get the gas used by a transaction
 * @param {string} txHash transaction hash
 * @return {number} fee in wei
 */
function getGasWei(txHash) {
    const transaction = web3.eth.getTransaction(txHash);
    const receipt = web3.eth.getTransactionReceipt(txHash);
    return receipt.gasUsed * transaction.gasPrice.toNumber()
}

/**
 * Create a Promise to watch event
 * @param instance
 * @param {string} eventName
 * @return {Promise}
 */
function promisifyEvent(instance, eventName) {
    return new Promise((resolve, reject) => {
        const observer = instance[eventName]()
        let timer = setTimeout(() => {
            reject(new Error(`${eventName} time out`))
            timer = null
        }, 5000)
        observer.watch((errMsg, event) => {
            if (!timer) {
                console.error('time out but event comes finally')
                return
            }
            clearTimeout(timer)
            observer.stopWatching()
            if (errMsg) {
                reject(errMsg)
            } else {
                resolve(event)
            }
        })
    })
}

/**
 * @param {number} timeout
 * @return {Promise}
 */
function promiseTimeout(timeout) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout)
    })
}

const observerMap = new Map()

/**
 * Start watching LogNote event
 * @param instance
 * @param {string=allEvents} eventName Show all events if no this parameter
 */
function logOn(instance, eventName = 'allEvents') {
    const observer = instance[eventName]()
    observer.watch((errMsg, event) => {
        console.log(errMsg || formatLogNote(event))
    })
    observerMap.set(eventName, observer)
}

/**
 * Format LogNote event info
 * @param event
 * @return {string}
 */
function formatLogNote(event) {
    const args = Object.entries(event.args).map(([key, value]) => `${key}: ${value.toString()}`).join(', ')
    return `${event.event}(${args})`
}

/**
 * Stop watching LogNote event
 * @param {string=allEvents} eventName Show all events if no this parameter
 */
function logOff(eventName = 'allEvents') {
    const observer = observerMap.get(eventName)
    if (observer) {
        observer.stopWatching()
        observerMap.delete(eventName)
    }
}

module.exports = {
    invalidUser,
    DEFAULT_TRANSACTION_ERROR_MSG,
    ASSERT_ERROR_MSG,
    NOT_ENOUGH_ETH_ERROR_MSG,
    CONTRACT_HAS_GONE,
    GAS_PRICE,
    assertReject,
    transferETH,
    transferETHAndCatch,
    encodeABIParams,
    getGasWei,
    promisifyEvent,
    promiseTimeout,
    logOn,
    logOff,
}
