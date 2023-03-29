const constants = require('./xrp_constants')
const utils = require('../../utils')

class xrpInterpreter {
    constructor({ address, funding, wallet }) {
        this.addresses = address;
        this.fundings = funding;
        this.wallet = wallet;
        this.name = constants.SERVICE_NAME;
        this.currency = constants.CURRENCY
    }

    async derive(wallet, hdPath) {
        const address = wallet.hotWallet
        const memo = hdPath === this.addresses.path.HOTWALLET
            ? null
            : utils.generateMemo(hdPath)
        return { address, memo };
    }

    async parseTransaction(transaction, blockHeight) {
        const toAddress = await this.addresses.findByAddressMemoAndService(this.name, transaction.toAddress, transaction.memo)
        if (transaction.currency == this.currency) {
            if (toAddress && toAddress.type === constants.ADDRESS_TYPE_USER) {
                return {
                    ...transaction,
                    blockHeight,
                    outputIndex: 0,
                    currency: this.currency,
                    transactionHash: transaction.hash,
                    toAddress,
                    amount: transaction.amount,
                }

            } else {
                return null
            }
        } else {
            return null
        }
    }
}

module.exports = xrpInterpreter;
