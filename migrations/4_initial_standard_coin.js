var StandardCoin = artifacts.require("./StandardCoin.sol");

module.exports = function(deployer) {
    deployer.deploy(StandardCoin, 1000000, 'Standard Coin', 'COIN');
};
