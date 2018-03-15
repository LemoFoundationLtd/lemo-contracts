# lemo-contracts
 
`LemoCoin` is an [ERC20](https://github.com/ethereum/EIPs/issues/20) token used for LemoChain.   
`LemoSale` is an ICO contract that facilitates the sale of LEMO  

1. Users can directly transfer ETH to LemoChain’s ICO contract address to obtain LEMO tokens. Users can use such wallets as: ImToken, MyEtherWallet, MetaMask etc. as long as the wallet supports ERC20 so can be used to purchase and store LEMO tokens.  
2. After the ICO is over, LemoChain will close the contract and transfer the ETH received in the contract into the Lemo Foundation's account.  
3. If the ICO is over but it does not reach the soft cap, the user can return their LEMO tokens to get ETH. The exchange rate remains unchanged. There is no other loss except to consume a little gas. 3 months after failure, LemoChain will recover the remaining ETH that are not claimed by the users in the ICO contract


## Development

### Install
- Clone this repository: `git clone git@github.com:LemoFoundationLtd/lemo-contracts.git`
- Install dependencies: `npm install`
- Install truffle: `sudo npm install -g truffle`


### Compile
- `truffle compile`

### Test
- `truffle test` to run the tests

## Usage

General notes:
- All values are specified as `uint256` with 18 decimals.
- We throw on error rather than return false.


## License
Code released under the [MIT License](https://github.com/LemoFoundationLtd/lemo-contracts/blob/master/LICENSE).
