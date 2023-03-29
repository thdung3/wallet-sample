const hdkey = require('ethereumjs-wallet/hdkey');
const Decimal = require('decimal.js');
const Promise = require('bluebird');
const constants = require('./eth_constants');
const Service = require('../service')
const { decryptWithAES, formatingNumberWithDecimal } = require('../../utils')
// web3.ultils does not need Node URL
const Web3 = require('web3');
const web3 = new Web3()
const api = require('../api')
const BACKEND_URL = process.env.BACKEND_URL
const WITHDRAW_CONFIRM_PATH = process.env.WITHDRAW_CONFIRM_PATH
const logger = require('../../helpers/logger.helper')

class EthService extends Service {
    constructor({
        block,
        token,
        ethApi,
        wallet,
        funding,
        address,
        withdrawal,
        ethInterpreter,
    }) {
        const error = {
            NOT_ENOUGH_BALANCE: 'Not enough balance',
            WALLET_NOT_ADDED: 'Wallet have not added',
            BROADCAST_FAIL: 'Broadcast fail',
        };

        super({
            api: ethApi,
            block,
            token,
            funding,
            withdrawal,
            name: constants.SERVICE_NAME,
            currency: constants.CURRENCY,
            interpreter: ethInterpreter,
            feeCurrency: constants.FEE_CURRENCY,
            error,
        });

        this.wallets = wallet;
        this.addresses = address;
    }

    async validateAddress(req) {
        const { address } = req;
        const result = await web3.utils.isAddress(address)
        return { result }
    }

    async getBalance(req) {
        const { address } = req;
        let result = await this.api.getBalance(address)
        const balance = parseFloat(web3.utils.fromWei(result, 'ether'))
        return { balance }
    }

    async getBalanceWallet(req) {
        const { service, currency } = req
        const wallet = await this.wallets.findByService(service)
        if (!wallet)
            throw Error('wallet not found')
        let result = await this.api.getBalance(wallet.hotWallet)
        let balance = parseFloat(web3.utils.fromWei(result, 'ether'))
        balance = formatingNumberWithDecimal(balance, 9)
        return { balance }
    }

    async bundleMoveFund(req) {
        const { walletId, currency } = req;
        const wallet = await this.wallets.find(walletId);
        if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);
        const token = await this.tokens.findByServiceAndCurrency(this.name, currency);
        const unspentMoveFunds = await this.fundings.findAllUnspentMoveFund(wallet, currency);
        const transactions = unspentMoveFunds.map(funding => ({
            id: funding.id,
            fromPath: funding.addressPath,
            toPath: this.addresses.path.SETTLEMENT,
            amount: new Decimal(funding.amount).toFixed(),
            currency,
        }));

        const payload = {
            type: this.bundleType.MOVE_FUND,
            currency,
            transactions,
            meta: await this.interpreter.getMeta(token)
        };
        // const option = { deep: true };
        return { payload: JSON.stringify(payload) };
    }

    async bundleWithdrawal(req) {
        const { service, transactions } = req;

        const wallet = await this.wallets.findByService(service);
        if (!wallet) {
            await Promise.each(transactions, async transaction => {
                await this.withdrawals.updateStateAndStatus(service, transaction.id, "failed", this.error.WALLET_NOT_FOUND)
            })
            logger.log("Error withdrawal:" + this.error.WALLET_NOT_FOUND)
            console.log("Error withdrawal:" + this.error.WALLET_NOT_FOUND)
            throw Error(this.error.WALLET_NOT_FOUND);
        }

        let sumWithDrawReq = 0;
        await Promise.each(transactions, async transaction => {
            sumWithDrawReq += transaction.amount;
        })

        let result = await this.api.getBalance(wallet.hotWallet);
        let balance = parseFloat(web3.utils.fromWei(result, 'ether'))

        if (balance < sumWithDrawReq) {
            await Promise.each(transactions, async transaction => {
                await this.withdrawals.updateStateAndStatus(service, transaction.id, "failed", this.error.NOT_ENOUGH_BALANCE)
            })
            logger.log("Error withdrawal:" + this.error.NOT_ENOUGH_BALANCE)
            console.log(("Error withdrawal:" + this.error.NOT_ENOUGH_BALANCE))
            throw Error(this.error.NOT_ENOUGH_BALANCE);
        }

        let successTxsHash = []

        await Promise.each(transactions, async transaction => {
            const transactionHash = await this.broadcastAndCreateWithdrawal(service, transaction, wallet);
            let status = "success"
            if (!transactionHash)
                status = "failed"
            successTxsHash.push({
                externalId: transaction.id,
                transactionHash: transactionHash,
                status
            })
        })
        await api.postFullUrl(BACKEND_URL, WITHDRAW_CONFIRM_PATH, successTxsHash)
        return successTxsHash;
    }

    async broadcastAndCreateWithdrawal(service, transaction, wallet) {
        try {
            let response = null;
            let error = null
            try {
                const xprivateDecrypt = decryptWithAES(wallet.xpriv)
                const xprivate = hdkey.fromExtendedKey(xprivateDecrypt);
                const privateKey = xprivate.derivePath('m/0/1/0').getWallet().getPrivateKeyString()

                // Create tx for signing
                let txAmount = web3.utils.toWei(transaction.amount.toString(), "ether")
                let gasPrice = await this.api.getGasPrice()

                const rawTx = {
                    to: transaction.address,
                    gasPrice,
                    gas: constants.GAS_LIMIT,
                    value: txAmount
                }

                const signTx = await this.api.signTransaction(rawTx, privateKey)

                const broadcast = await this.api.sendSignedTransaction(signTx.rawTransaction)
                if (broadcast) {
                    response = broadcast.transactionHash
                }
            } catch (err) {
                logger.log("Error withdrawal:" + err)
                this.debug(`Broadcast fail with error ${err}`);
                error = err
                response = null;
            }
            // Update withdrawals state 
            if (!response || response === false) {
                await this.withdrawals.updateStateAndStatus(service, transaction.id, this.withdrawals.state.FAILED, `${this.error.BROADCAST_FAIL} : ${error}`)
            } else {
                await this.withdrawals.updateStateAndTransactionHash(service, transaction.id, this.withdrawals.state.CONFIRMED, response)
            }
            return response
        } catch (error) {
            logger.log("Error withdrawal:" + error)
            this.debug(`Broadcast fail with error ${error}`);
            throw Error(error)
        }
    }
}

module.exports = EthService;
