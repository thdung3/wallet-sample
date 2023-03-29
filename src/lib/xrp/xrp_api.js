const xrpConstants = require('./xrp_constants')
const Promise = require('bluebird')
const logger = require('../../helpers/logger.helper')
const RippleAPI = require('ripple-lib').RippleAPI;

class XrpApi {
    constructor({ xrpApiUrl }) {
        this.apiUrl = xrpApiUrl;
        if (!this.apiUrl) {
            throw Error('Please provide XRP_NODE_URL');
        }
        this.api = new RippleAPI({
            server: this.apiUrl // Public rippled server hosted by Ripple, Inc.
        });
        this.api.connect()
        this.sleepTime = 10;
        this.MAX_ATTEMPT = 20;
    }

    async initWSConnection() {
        this.api = new RippleAPI({
            server: this.apiUrl // Public rippled server hosted by Ripple, Inc.
        });
        return await this.api.connect()
    }

    async validateAddress(address) {
        try {
            const accountInfo = await this.api.isValidAddress(address)
            if (accountInfo)
                return true
            else
                return false
        } catch (err) {
            return false
        }
    }

    async getBalance(address, attempt = 0) {
        try {
            const balanceList = await this.api.getBalances(address);
            const balance = balanceList.filter(item => item.currency == xrpConstants.CURRENCY)
            if (balance.length)
                return parseFloat(balance[0].value);
            else
                return 0
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`XRP.getBalance error: ${err}`)
                throw Error(`XRP.getBalance error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.getBalance(address, attempt + 1)
        }
    }

    async getLatestBlockHeight(attempt = 0) {
        try {
            return await this.api.getLedgerVersion()
        } catch (err) {
            console.log('XRP.getLatestBlockHeight.err:', err)
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Get latest block height error: ${err}`)
                throw Error(`Get latest block height error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.getLatestBlockHeight(attempt + 1)
        }
    }

    async getTransactions(address, fromHeight, attempt = 0) {
        try {
            const options = { minLedgerVersion: fromHeight, types: ["payment"], initiated: false, limit: 100 }
            return await this.api.getTransactions(address, options)
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`XRP.getTransactions error: ${err}`)
                throw Error(`XRP.getTransactions error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.getTransactions(address, fromHeight, attempt + 1)
        }
    }

    async prepareTransaction(fromAddress, toAddress, memo, amount, attempt = 0) {
        try {
            let preparedTx
            if (memo)
                preparedTx = await this.api.prepareTransaction({
                    "TransactionType": "Payment",
                    "Account": fromAddress,
                    "Amount": this.api.xrpToDrops(amount), // Same as "Amount": "2000000"
                    "Destination": toAddress,
                    "DestinationTag": parseInt(memo)
                }, {
                    // Expire this transaction if it doesn't execute within ~5 minutes:
                    "maxLedgerVersion": null
                })
            else
                preparedTx = await this.api.prepareTransaction({
                    "TransactionType": "Payment",
                    "Account": fromAddress,
                    "Amount": this.api.xrpToDrops(amount), // Same as "Amount": "2000000"
                    "Destination": toAddress
                }, {
                    // Expire this transaction if it doesn't execute within ~5 minutes:
                    "maxLedgerVersion": null
                })

            return preparedTx.txJSON;
        } catch (err) {
            console.log('XRP.prepareTransaction.err:', err)
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`XRP.prepareTransaction err: ${err}`)
                throw Error(`XRP.prepareTransaction err: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.prepareTransaction(fromAddress, toAddress, memo, amount, attempt + 1)
        }
    }

    async signTransaction(txJson, privateKey, publicKey, attempt = 0) {
        try {
            const keypair = { privateKey, publicKey };
            const signedTx = await this.api.sign(txJson, keypair)
            return signedTx.signedTransaction
        } catch (err) {
            console.log('XRP.signTransaction.err:', err)
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`XRP.signTransaction err: ${err}`)
                throw Error(`XRP.signTransaction err: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.signTransaction(txJson, privateKey, publicKey, attempt + 1)
        }
    }

    async broadcast(signedTransaction) {
        try {
            return await this.api.submit(signedTransaction)
        } catch (err) {
            console.log('XRP.broadcast err:', err)
            logger.log(`XRP.broadcast err: ${err}`)
            throw Error(`XRP.broadcast err: ${err}`)
        }
    }
}

module.exports = XrpApi;
