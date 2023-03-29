const debug = require('debug');
const Promise = require('bluebird');
const { formatAddressWithMemo, encryptWithAES } = require('../utils');
const logger = require('../helpers/logger.helper')

class Service {
    constructor({
        // Global
        api,
        block,
        token,
        wallet,
        address,
        funding,
        withdrawal,
        limit,
        name,
        error,
        baseFee,
        currency,
        feeCurrency,
        interpreter,
    }) {
        // Components
        this.api = api;
        this.blocks = block;
        this.tokens = token;
        this.wallets = wallet;
        this.fundings = funding;
        this.addresses = address;
        this.withdrawals = withdrawal;
        this.interpreter = interpreter;
        this.limits = limit;

        // Configs
        this.name = name;
        this.baseFee = baseFee;
        this.currency = currency;
        this.feeCurrency = feeCurrency;
        this.debug = debug(`wallet:service:${this.name}`);

        this.error = {
            ...error,
            MISSING_PAYLOAD: 'Missing payload.',
            WALLET_NOT_FOUND: 'Wallet not found.',
            SERVICE_NOT_FOUND: 'Service not found.',
            ALREADY_HAS_WALLET: 'Already has wallet.',
            MISSING_TRANSACTIONS: 'Missing transactions',
            DUPLICATED_WITHDRAWAL: 'Duplicated withdrawal',
            MOVE_FUND_NOT_IMPLEMENTED: 'Move fund has not implemented',
            NOT_HAVE_SMART_CONTACT: 'Currency not have suport smart contract',
            GET_TOTAL_BALANCE_NOT_IMPLEMENTED: 'Get total balance has not implemented',
        };

        this.bundleType = {
            MOVE_FUND: 'move_fund',
            WITHDRAWAL: 'withdrawal',
        };
    }

    async addWallet(req) {
        // Validate req
        await this.validateWallet(req);

        // Create wallet
        let { service, xpub, hotWallet, xpriv, coldWallet, mnemonic } = req;
        let xprivateEncryp = ''
        if (xpriv)
            xprivateEncryp = encryptWithAES(xpriv)

        let mnemonicEncryp = ''
        if (mnemonic)
            mnemonicEncryp = encryptWithAES(mnemonic)
        const wallet = await this.wallets.create(service, xpub, hotWallet, xprivateEncryp, coldWallet, mnemonicEncryp)


        const address = await this.generateAddress(wallet, this.addresses.path.HOTWALLET);

        if (!hotWallet) {
            hotWallet = address.address
            await this.wallets.updateHotWallet(service, hotWallet);
        }

        return { id: wallet.id, hotWallet };
    }

    async validateWallet(req) {
        const { service, xpub } = req;
        const wallet = await this.wallets.findByXpub(service, xpub);
        if (wallet) throw Error(this.error.ALREADY_HAS_WALLET);
    }

    async addContractToken(req) {
        throw Error(this.error.NOT_HAVE_SMART_CONTACT);
    }

    async getAddress(req) {
        const { service, path } = req;
        const wallet = await this.wallets.findByService(service);
        if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);
        const { address, memo } =
            (await this.addresses.findByPath(service, path)) ||
            (await this.generateAddress(wallet, path));
        this.debug(`Get address of ${service} from path m/${path}: ${address} with memo : ${memo}`);
        return { address, memo };
    }

    async generateAddress(wallet, path) {
        const { address, memo } = await this.interpreter.derive(wallet, path);
        // Mongodb
        await this.addresses.create(
            path,
            memo,
            address,
            this.name,
            wallet.id,
            path === this.addresses.path.HOTWALLET
                ? this.addresses.type.SETTLEMENT
                : this.addresses.type.USER)
        return { address, memo };
    }

    async getBalance() {
        throw Error('Not implement');
    }

    async getBalanceWallet() {
        throw Error('Not implement');
    }

    async withdraw(req) {
        const { transactions } = req;
        logger.log("Received withdrawal request", transactions)
        let transactionsFilter = []
        await Promise.each(transactions, async (transaction) => {
            const found = await this.withdrawals.findByServiceAndExternalId(this.name, transaction.id);
            if (found) {
                if (found.state == this.withdrawals.state.FAILED) {
                    transaction = { ...transaction, state: this.withdrawals.state.PENDING }
                    await this.withdrawals.updateStateAndStatus(this.name, transaction.id, this.withdrawals.state.PENDING, null)
                } else {
                    transaction = { ...transaction, state: this.withdrawals.state.DUPLICATE }
                    logger.log("Error duplicate withdrawal", transaction)
                    await this.withdrawals.create({
                        externalId: transaction.id || null,
                        service: this.name,
                        amount: transaction.amount,
                        currency: transaction.currency,
                        toAddress: transaction.address,
                        memo: transaction.memo || null,
                        outputIndex: 0,
                        state: this.withdrawals.state.DUPLICATE,
                        status: this.withdrawals.state.DUPLICATE,
                        transactionHash: null,
                    })
                }
            } else {
                await this.withdrawals.create({
                    externalId: transaction.id || null,
                    service: this.name,
                    amount: transaction.amount,
                    currency: transaction.currency,
                    toAddress: transaction.address,
                    memo: transaction.memo || null,
                    outputIndex: 0,
                    state: this.withdrawals.state.PENDING,
                    status: null,
                    transactionHash: null,
                })
                transaction = { ...transaction, state: this.withdrawals.state.PENDING }
            }
            transactionsFilter.push(transaction)
        });
        req.transactions = transactionsFilter.filter(item => item.state === this.withdrawals.state.PENDING)
        // const payload = await this.bundleWithdrawal(req, false)
        const payload = this.bundleWithdrawal(req, false)

        return {
            type: req.type,
            service: req.service,
            currency: req.currency,
            transactions: transactionsFilter
        }
    }
}

module.exports = Service;
