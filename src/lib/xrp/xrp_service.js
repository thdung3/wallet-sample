const Promise = require('bluebird');
const debug = require('debug')('wallet:xrp_service');
const xrpConstants = require('./xrp_constants');
const Service = require('../service')
const api = require('../api')
const BACKEND_URL = process.env.BACKEND_URL
const WITHDRAW_CONFIRM_PATH = process.env.WITHDRAW_CONFIRM_PATH
const { decryptWithAES, formatingNumberWithDecimal } = require('../../utils')
const logger = require('../../helpers/logger.helper')

class XrpService extends Service {
    constructor({
        block,
        token,
        xrpApi,
        wallet,
        funding,
        address,
        withdrawal,
        xrpInterpreter,
    }) {
        const error = {
            NOT_ENOUGH_BALANCE: 'Not enough balance',
            TOKEN_NOT_FOUND: 'Token not found',
            WALLET_NOT_ADDED: 'Wallet have not added',
            ALREADY_ADDED_TOKEN: 'Already added token',
            BROADCAST_FAIL: 'Broadcast fail',
        };

        super({
            api: xrpApi,
            block,
            token,
            funding,
            withdrawal,
            name: xrpConstants.SERVICE_NAME,
            currency: xrpConstants.CURRENCY,
            interpreter: xrpInterpreter,
            feeCurrency: xrpConstants.FEE_CURRENCY,
            error,
        });

        this.wallets = wallet;
        this.addresses = address;
        this.tokens = token;
    }

    async validateAddress(req) {
        const { address } = req;
        const result = await this.api.validateAddress(address)
        return { result }
    }

    async getBalance(req) {
        const { address } = req;
        let balance = await this.api.getBalance(address)
        if (!balance)
            balance = 0
        return { balance }
    }

    async getBalanceWallet(req) {
        const { service } = req
        const wallet = await this.wallets.findByService(service)
        if (!wallet)
            throw Error('wallet not found')
        let balance = await this.api.getBalance(wallet.hotWallet)
        if (!balance)
            balance = 0
        balance = formatingNumberWithDecimal(balance, 4)
        return { balance }
    }

    async bundleWithdrawal(req) {
        const { service, transactions, currency } = req;

        const wallet = await this.wallets.findByService(service)
        if (!wallet) {
            await Promise.each(transactions, async transaction => {
                await this.withdrawals.updateStateAndStatus(service, transaction.id, "failed", this.error.WALLET_NOT_FOUND)
            })
            console.log("Error withdrawal:" + this.error.WALLET_NOT_FOUND)
            logger.log("Error withdrawal:" + this.error.WALLET_NOT_FOUND)
            throw Error(this.error.WALLET_NOT_FOUND);
        }

        let sumWithDrawReq = 0;
        await Promise.each(transactions, async transaction => {
            transaction.amount = formatingNumberWithDecimal(transaction.amount, 4)
            sumWithDrawReq += transaction.amount;
        })

        let balance = 0;

        balance = await this.api.getBalance(wallet.hotWallet);

        if (balance < sumWithDrawReq) {
            await Promise.each(transactions, async transaction => {
                await this.withdrawals.updateStateAndStatus(service, transaction.id, "failed", this.error.NOT_ENOUGH_BALANCE)
            })
            console.log("Error withdrawal:" + this.error.NOT_ENOUGH_BALANCE)
            logger.log("Error withdrawal:" + this.error.NOT_ENOUGH_BALANCE)
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
                const privateKey = decryptWithAES(wallet.xpriv)
                let preparedTx = await this.api.prepareTransaction(wallet.hotWallet, transaction.address, transaction.memo, transaction.amount)
                let signedTx = await this.api.signTransaction(preparedTx, privateKey, wallet.xpub)
                const broadcasted = await this.api.broadcast(signedTx)
                if (broadcasted.engine_result_code == 0)
                    response = broadcasted.tx_json.hash
                else {
                    response = null
                    error = broadcasted.engine_result_message
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

module.exports = XrpService;
