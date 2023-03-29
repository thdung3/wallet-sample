const Decimal = require('decimal.js');
const { Address, Script, HDPrivateKey, Transaction, Networks } = require('bitcore-lib');
const Promise = require('bluebird');
const constants = require('./btc_constants');
const Service = require('../service')
const { decryptWithAES, formatingNumberWithDecimal } = require('../../utils')
const api = require('../api')
const _ = require('lodash');
const BACKEND_URL = process.env.BACKEND_URL
const WITHDRAW_CONFIRM_PATH = process.env.WITHDRAW_CONFIRM_PATH
const logger = require('../../helpers/logger.helper')

class BtcService extends Service {
    constructor({
        block,
        token,
        btcRpc,
        wallet,
        funding,
        address,
        withdrawal,
        btcInterpreter,
    }) {
        const error = {
            NOT_ENOUGH_BALANCE: 'Not enough balance',
            WALLET_NOT_ADDED: 'Wallet have not added',
            BROADCAST_FAIL: 'Broadcast fail',
        };

        super({
            api: btcRpc,
            block,
            token,
            funding,
            withdrawal,
            name: constants.SERVICE_NAME,
            currency: constants.CURRENCY,
            interpreter: btcInterpreter,
            feeCurrency: constants.FEE_CURRENCY,
            error,
        });

        this.wallets = wallet;
        this.addresses = address;
        this.fundings = funding;
    }

    async validateAddress(req) {
        const { address } = req;
        const result = Address.isValid(address)
        return { result }
    }

    async getBalance(req) {
        throw Error('Not implement');
    }

    async getBalanceWallet(req) {
        const { service, currency } = req
        const wallet = await this.wallets.findByService(service)
        if (!wallet)
            throw Error('wallet not found')
        let balance = await this.fundings.computeAvailableWithdrawUTXONotSpent(service);
        balance = formatingNumberWithDecimal(balance, 8)
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
            sumWithDrawReq += constants.BASE_FEE
        })

        sumWithDrawReq = formatingNumberWithDecimal(sumWithDrawReq, 8)

        const balance = await this.fundings.computeAvailableWithdrawUTXONotSpent(service);

        if (balance < sumWithDrawReq) {
            await Promise.each(transactions, async transaction => {
                await this.withdrawals.updateStateAndStatus(service, transaction.id, "failed", this.error.NOT_ENOUGH_BALANCE)
            })
            logger.log("Error withdrawal:" + this.error.NOT_ENOUGH_BALANCE)
            console.log(("Error withdrawal:" + this.error.NOT_ENOUGH_BALANCE))
            throw Error(this.error.NOT_ENOUGH_BALANCE);
        }

        let successTxsHash = []

        // Sign all transactions at once
        const transactionHash = await this.broadcastAndCreateWithdrawal(service, transactions, wallet, sumWithDrawReq);

        await Promise.each(transactions, async transaction => {
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

    async broadcastAndCreateWithdrawal(service, transactions, wallet, sumWithDrawReq) {
        try {
            let response = null;
            let error = null
            try {

                const signTx = await this.signTransaction(service, transactions, wallet, sumWithDrawReq)

                const broadcast = await this.api.sendSignedTransaction(signTx)
                if (broadcast) {
                    response = broadcast
                }
            } catch (err) {
                logger.log("Error withdrawal:" + err)
                this.debug(`Broadcast fail with error ${err}`);
                error = err
                response = null;
            }
            // Update withdrawals state 
            if (!response || response === false) {
                await Promise.each(transactions, async (transaction) => {
                    await this.withdrawals.updateStateAndStatus(service, transaction.id, this.withdrawals.state.FAILED, `${this.error.BROADCAST_FAIL} : ${error}`)
                })

            } else {
                await Promise.each(transactions, async (transaction) => {
                    await this.withdrawals.updateStateAndTransactionHash(service, transaction.id, this.withdrawals.state.BROADCASTED, response)
                })
            }
            return response
        } catch (error) {
            logger.log("Error withdrawal:" + error)
            this.debug(`Broadcast fail with error ${error}`);
            throw Error(error)
        }
    }

    async signTransaction(service, transactions, wallet, sumWithDrawReq) {
        const xprivateDecrypt = decryptWithAES(wallet.xpriv)

        const topUnspentTransactions = await this.fundings.findTopUnspentFunding(service)
        const unSpentTransactions = []
        let totalAmountSpent = 0

        topUnspentTransactions.map(item => {
            if (totalAmountSpent <= sumWithDrawReq)
                unSpentTransactions.push(item)
            totalAmountSpent += item.amount
        })

        totalAmountSpent = formatingNumberWithDecimal(totalAmountSpent, 8)

        const inputs = await Promise.map(unSpentTransactions, async (item) => {
            const address = await this.addresses.findByIdNum(item.addressId);
            await this.fundings.markUTXOIsSpent(service, item.transactionHash)
            return {
                script: item.script,
                transactionHash: item.transactionHash,
                outputIndex: item.outputIndex,
                amount: item.amount,
                hdPath: address.path,
            };
        });

        const outputs = transactions;
        const multiSigTx = new Transaction();
        const changeAddress = wallet.hotWallet

        _.each(inputs, function (input, index) {
            let _input = new Transaction.Input.PublicKeyHash({
                output: new Transaction.Output({
                    script: input.script,
                    satoshis: formatingNumberWithDecimal(input.amount * Math.pow(10, 8), 8)
                }),
                prevTxId: input.transactionHash,
                outputIndex: input.outputIndex,
                script: Script.empty()
            });
            multiSigTx.addInput(_input);
        });

        _.each(outputs, function (output) {
            multiSigTx.addOutput(
                new Transaction.Output({
                    // script: Script(new Address(output.address, Networks.mainnet)),
                    script: Script(new Address(output.address, Networks.mainnet)),
                    satoshis: formatingNumberWithDecimal(output.amount * Math.pow(10, 8), 8)
                })
            );
        });

        const externals = outputs.map((output, index) => ({
            id: output.id,
            index
        }));

        multiSigTx.change(changeAddress);
        multiSigTx.feePerKb(parseInt(process.env.BTC_MAXIMUM_FEE) || 10000);
        var fee = multiSigTx._getUnspentValue();

        console.log("Est fee is " + multiSigTx.getFee());
        console.log("Actual fee is " + multiSigTx._getUnspentValue());
        logger.log("Est fee is " + multiSigTx.getFee())
        logger.log("Actual fee is " + multiSigTx._getUnspentValue())

        if (fee < multiSigTx.getFee()) {
            await Promise.map(unSpentTransactions, async (item) => {
                await this.fundings.markUTXOIsNotSpent(service, item.transactionHash)
            })
            console.log("Insufficient fee")
            logger.log("Insufficient fee")
            throw Error("Insufficient fee");
        } else if (fee > 10000000) {
            await Promise.map(unSpentTransactions, async (item) => {
                await this.fundings.markUTXOIsNotSpent(service, item.transactionHash)
            })
            console.log("Fee is too high")
            logger.log("Fee is too high")
            throw Error("Fee is too high");
        }

        const hdPaths = Array.from(new Set(inputs.map(input => input.hdPath)));

        hdPaths.forEach(hdPath => {
            const path = hdPath.indexOf("m") > -1 ? hdPath : `m/${hdPath}`;
            const privateKey = HDPrivateKey(xprivateDecrypt).derive(path)
                .privateKey;
            multiSigTx.sign(privateKey);
        });

        if (multiSigTx.isFullySigned()) {
            return multiSigTx.serialize()
        }
        else {
            await Promise.map(unSpentTransactions, async (item) => {
                await this.fundings.markUTXOIsNotSpent(service, item.transactionHash)
            })
            console.log("signing failed " + multiSigTx.serialize())
            logger.log("signing failed " + multiSigTx.serialize())
            throw Error("signing failed", multiSigTx.serialize());
        }
    }
}

module.exports = BtcService;
