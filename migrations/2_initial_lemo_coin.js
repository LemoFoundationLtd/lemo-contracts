var LemoCoin = artifacts.require("./LemoCoin.sol");

module.exports = function(deployer) {
    deployer.deploy(LemoCoin, 1000000, 'Lemo', 'LEMO');
};
