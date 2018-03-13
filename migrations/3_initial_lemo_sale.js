var LemoSale = artifacts.require("./LemoSale.sol");

module.exports = function(deployer) {
    deployer.deploy(LemoSale, 50004, 200007, 9);
};
