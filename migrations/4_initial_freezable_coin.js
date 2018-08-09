var FreezableCoin = artifacts.require("./FreezableCoin.sol");

module.exports = function(deployer) {
    deployer.deploy(FreezableCoin, 1000000, 'Coin1', 'COIN1');
};
