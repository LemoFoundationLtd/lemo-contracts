/**
 * 获取当前秒数
 * @return {number}
 */
function nowSeconds() {
    return Math.floor(Date.now() / 1000)
}

module.exports = {
    START_TIME: nowSeconds(), // ICO开始时间
    END_TIME: nowSeconds() + 3600, // ICO结束时间
    MIN_FINNEY: 500, // 最少支付500finney
    FINNEY_TO_LEMO_RATE: 9, // finney到LEMO的汇率
    SOFT_CAP: 50004, // 软顶
    HARD_CAP: 200007, // 硬顶
}
