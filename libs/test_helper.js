const abi = require('ethjs-abi')

// 不存在的用户
const invalidUser = '0x0000000000000000000000000000000000000000'
const DEFAULT_TRANSACTION_ERROR_MSG = 'VM Exception while processing transaction: revert'
const ASSERT_ERROR_MSG = 'VM Exception while processing transaction: invalid opcode'
const NOT_ENOUGH_ETH_ERROR_MSG = 'sender doesn\'t have enough funds to send tx'
// gas单价1 gwei
const GAS_PRICE = 1000000000

/**
 * 判断运行时是否会报指定错误
 * @param {Function} promise
 * @param {string} wording
 * @param {string?} exceptedErrorMsg 期望的错误wording，默认为合约assert错误
 * @return {Promise}
 */
async function assertReject(promise, wording, exceptedErrorMsg) {
    try {
        await promise
    } catch (e) {
        assert.equal(e.message, exceptedErrorMsg || DEFAULT_TRANSACTION_ERROR_MSG)
        return
    }
    throw new Error(wording)
}

/**
 * 账户间的ETH转账
 * @param {string} fromAccount 发送方
 * @param {string} toAccount 接收方
 * @param {number} finney 金额
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
 * 用来测试不正常调用ETH转账的方法
 * @param {string} fromAccount 发送方
 * @param {string} toAccount 接收方
 * @param {number} finney 金额
 * @param {string} exceptErrMsg 应该抛出这个异常才对
 * @param {string} msgIfNoError 如果没有抛异常，就抛这个异常
 * @return {Promise}
 */
async function transferETHAndCatch(fromAccount, toAccount, finney, exceptErrMsg, msgIfNoError) {
    return new Promise((resolve, reject) => {
        web3.eth.sendTransaction({
            from: fromAccount,
            to: toAccount,
            value: web3.toWei(finney, 'finney'),
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
 * 获取调用合约时参数的ABI编码
 * @param {object} instance 合约实例
 * @param {string?} methodName 要调用的合约方法名。如果不填则是普通的ETH转账
 * @param {Array?} params 合约方法的参数
 * @return {Promise}
 */
async function encodeABIParams(instance, methodName, ...params) {
    const methodInfo = instance.abi.find(item => item.name === methodName)
    if (!methodInfo) {
        console.error('ABI文件中没有找到该函数', methodName)
        return ''
    }
    return abi.encodeMethod(methodInfo, params)
}

/**
 * 获取交易消耗的gas费用
 * @param {string} txHash 交易hash
 * @return {number} 以wei为单位的交易费用
 */
function getGasWei(txHash) {
    const transaction = web3.eth.getTransaction(txHash);
    const receipt = web3.eth.getTransactionReceipt(txHash);
    return receipt.gasUsed * transaction.gasPrice.toNumber()
}

/**
 * 将事件包装为Promise
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
 * 将setTimeout函数封装为promise
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
 * 开始监听LogNote日志
 * @param instance
 * @param {string=allEvents} eventName 事件名。不填则捕获所有事件
 */
function logOn(instance, eventName = 'allEvents') {
    const observer = instance[eventName]()
    observer.watch((errMsg, event) => {
        console.log(errMsg || formatLogNote(event))
    })
    observerMap.set(eventName, observer)
}

/**
 * 格式化LogNote事件
 * @param event
 * @return {string}
 */
function formatLogNote(event) {
    const args = Object.entries(event.args).map(([key, value]) => `${key}: ${value.toString()}`).join(', ')
    return `${event.event}(${args})`
}

/**
 * 停止监听LogNote日志
 * @param {string=allEvents} eventName 事件名。不填则捕获所有事件
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
