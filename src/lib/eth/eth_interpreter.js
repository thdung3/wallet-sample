const constants = require('./eth_constants')
const hdkey = require('ethereumjs-wallet/hdkey');
const utils = require('../../utils')
const ethApi = require('./eth_api')
const ETH_NODE_URL = process.env.ETHEREUM_NODE_URL;
// web3.utils does not need Node URL
const Web3 = require('web3')
const web3 = new Web3()

class EthInterpreter {
    constructor({
        address,
        funding,
        wallet,
    }) {
        this.addresses = address;
        this.fundings = funding;
        this.wallet = wallet;
        this.name = constants.SERVICE_NAME
        this.currency = constants.CURRENCY
        this.api = new ethApi({ ETH_NODE_URL })
    }


    async derive(wallet, hdPath) {
        const hdPubKey = hdkey.fromExtendedKey(wallet.xpub);
        const path = hdPath.indexOf('m') > -1 ? hdPath : `m/${hdPath}`;
        const address = web3.utils.toChecksumAddress(
            hdPubKey.derivePath(path).getWallet().getAddressString()
        );
        return { address };
    }

    async isSuccessTransaction(transaction) {
        const status = await this.api.getTransactionReceipt(transaction.hash);
        if (status) return status.status;
    };

    async parseTransaction(transaction, blockHeight) {
        const toAddress = await this.addresses.findByAddressAndService(this.name, transaction.to)

        // For deposit
        if (toAddress && toAddress.type === constants.ADDRESS_TYPE_USER) {
            if (await this.isSuccessTransaction(transaction)) {
                const wallet = await this.wallet.findByService(this.name)
                const fromAddress = await this.addresses.findByAddressAndService(this.name, transaction.from)
                if (!fromAddress || (fromAddress.address !== wallet.hotWallet)) {
                    const amount = utils.formatingNumber(parseFloat(web3.utils.fromWei(transaction.value, "ether")))
                    return {
                        ...transaction,
                        blockHeight,
                        outputIndex: 0,
                        currency: this.currency,
                        transactionHash: transaction.hash,
                        toAddress,
                        amount,
                    }
                } else {
                    return null
                }
            } else {
                return null
            }
            // For confirmation withdrawal
            // } else if (fromAddress && fromAddress.type === this.addresses.type.SETTLEMENT) {
            //     const amount = utils.formatingNumber(parseFloat(web3.utils.fromWei(transaction.value, "ether")))
            //     return {
            //         ...transaction,
            //         blockHeight,
            //         outputIndex: 0,
            //         currency: this.currency,
            //         transactionHash: transaction.hash,
            //         fromAddress,
            //         amount,
            //     }

        } else {
            return null
        }
    }
}

module.exports = EthInterpreter;
