const debug = require('debug');
const Promise = require('bluebird');
const Decimal = require('decimal.js');
const TinyQueue = require('tinyqueue');
const { EventEmitter } = require('events');
const { buildBalancesHash, buildConfirmNetworkTxs } = require('../utils');
const logger = require('../helpers/logger.helper')

class Monitor extends EventEmitter {
    constructor({
        api,
        name,
        block,
        token,
        wallet,
        interpreter,
        funding,
        withdrawal,
        moveFund,
        sleepTime,
        moveFundSleepTime,
        startBlockHeight,
        minimumConfirmation,
        address,
        currency,
    }) {
        super();

        // States
        this.canStop = true;
        this.nextBlocks = [];
        this.isRunning = false;
        this.nextBlocks = new TinyQueue([], (a, b) => a.height - b.height);
        this.currency = currency;

        // Configs
        this.api = api;
        this.name = name;
        this.interpreter = interpreter;
        this.blocks = block;
        this.tokens = token;
        this.wallets = wallet;
        this.fundings = funding;
        this.moveFunds = moveFund;
        this.withdrawals = withdrawal;
        this.addresses = address;
        this.sleepTime = Number(sleepTime);
        this.moveFundSleepTime = Number(moveFundSleepTime);
        this.startBlockHeight = Number(startBlockHeight);
        this.minimumConfirmation = Number(minimumConfirmation);
        this.debug = debug(`wallet:monitor:${this.name}`);

        this.bundleType = {
            MOVE_FUND: 'move_fund',
            WITHDRAWAL: 'withdrawal',
        };
    }

    async start() {
        this.isRunning = true;
        this.canStop = false;
        await this.run();
        this.canStop = true;
    }

    async stop() {
        this.isRunning = false;
        this.debug('Attempt to stop...');
        if (this.canStop) {
            this.debug('Stopped.');
            return;
        }
        await Promise.delay(1000 * this.sleepTime);
        await this.stop();
    }

    async run() {
        while (this.isRunning) {
            await this.monitorNetwork();
        }
    }

    validateBlock(block, fromHeight, toHeight) {
        return block && (block.height >= fromHeight && block.height <= toHeight);
    }

    async fetchRange(fromHeight, toHeight) {
        // Should implement in each coin's monitor
    }

    distributeGasAndMoveFund(fundings) {
        // Should implement in each coin's monitor if needed
    }

    async monitorNetwork() {
        // Get height from database
        const latestProcessedBlock = await this.blocks.findByService(this.name);

        // We set current height to height from db
        // Or from environment if db is blank
        const currentHeight = latestProcessedBlock
            ? latestProcessedBlock.height
            : this.startBlockHeight - 1;

        // Latest block from network
        const latestHeight = parseInt(await this.api.getLatestBlockHeight());

        const confirmedHeight = latestHeight - this.minimumConfirmation;

        if (currentHeight < confirmedHeight) {
            // Fetch and process at the same time
            await Promise.all([
                this.fetchRange(currentHeight + 1, confirmedHeight),
                this.processRange(currentHeight + 1, confirmedHeight),
            ])
        } else {
            // Reach confirmed height, nothing to do
            await Promise.delay(1000 * this.sleepTime);
        }
    }

    async shouldProcessNextBlock(fromHeight, toHeight) {
        // Pre-validate
        if (!this.isRunning || fromHeight > toHeight) return false;

        // Validate next block
        const nextBlock = this.nextBlocks.peek();

        if (this.validateBlock(nextBlock, fromHeight, toHeight)) return true;
        await Promise.delay(1000 * this.sleepTime);
        return this.shouldProcessNextBlock(fromHeight, toHeight);
    }

    async processRange(fromHeight, toHeight) {
        if (await this.shouldProcessNextBlock(fromHeight, toHeight)) {
            const nextBlock = this.nextBlocks.pop();
            await this.processBlock(nextBlock);
            await this.processRange(parseInt(nextBlock.height) + 1, toHeight);
        }
    }

    async processBlock(nextBlock) {
        var { height, hash, transactions } = nextBlock;
        try {
            this.debug(`Process block ${height}`);

            // Analyze fundings
            /// deposit
            const fundings = await this.buildFundings(transactions);
            let balancesHash = buildBalancesHash(fundings);
            balancesHash.map((item, index) => {
                item.service = this.name
                item.amount = parseFloat(item.amount)
                fundings[index].toAddress.memo ? item.memo = fundings[index].toAddress.memo : item.memo = null
            })

            await Promise.each(fundings, async (tx) => { await this.fundings.create(tx) });

            // Analyze withdrawals
            const withdrawals = await this.buildWithdrawals(transactions);
            const confirmedNetworkTxs = buildConfirmNetworkTxs(withdrawals);
            await Promise.each(withdrawals, tx =>
                this.withdrawals.markAsConfirmed(this.name, tx.transactionHash));
            // This is for Bxx currencies
            await Promise.each(withdrawals, tx => this.processWithdrawal(tx));

            // Submit new block
            const block = { hash, height, balancesHash, confirmedNetworkTxs };
            await this.blocks.updateHeight(this.name, height);

            // Only emit if necessary            
            if (balancesHash.length || confirmedNetworkTxs.length) {
                this.emit('deposit', block);
                this.distributeGasAndMoveFund(fundings)
            }

            // if (confirmedNetworkTxs.length) {
            //     this.emit('withdraw', block);
            // }
        } catch (err) {
            console.log("err", err);
            logger.log("Process block error:" + err)
        }
    }

    async buildFundings(transactions) {
        // Our filters
        const isFunding = transaction => transaction.toAddress;
        const isSupportedCurrency = (tx) => {
            const { currency, contractAddress } = tx;
            return (
                currency === this.currency || this.tokens.isEnabled(this.name, currency, contractAddress)
            );
        };
        const isNotExisted = async (tx) => {
            const { transactionHash, outputIndex } = tx;
            return !(await this.fundings.findFundingByTxHashAndOutputIndex(
                this.name,
                transactionHash,
                outputIndex,
                this.fundings.type.FUNDING,
            ));
        };

        const isHavingAmout = async (tx) => {
            const { amount } = tx;
            return (new Decimal(amount) > 0);
        };

        const fundingTransaction = await Promise.filter(
            transactions,
            async (tx) => {
                const notExisted = await isNotExisted(tx);
                return isFunding(tx) && isSupportedCurrency(tx) && notExisted && isHavingAmout(tx);
            },
            { concurrency: 1 },
        );

        const addFundingAttributes = tx => ({
            ...tx,
            addressId: tx.toAddress.id,
            address: tx.toAddress.address,
            memo: tx.toAddress.memo ? tx.toAddress.memo : null,
            service: this.name,
            type: this.fundings.type.FUNDING,
            state: this.fundings.state.CONFIRMED,
        });

        return fundingTransaction.map(addFundingAttributes);
    }

    async buildWithdrawals(transactions) {
        const isUTXO = transaction => transaction.inputs && transaction.inputs.length > 0;
        const isWithdrawal = transaction => transaction.fromAddress;
        const isGoingToProcess = async ({ transactionHash, outputIndex }) => {
            const withdrawal = await this.withdrawals.find(this.name, transactionHash, outputIndex);
            return !withdrawal || withdrawal.state === this.withdrawals.state.BROADCASTED;
        };
        const addWithdrawalsAttribute = tx => ({
            ...tx,
            service: this.name,
            toAddress: tx.to,
        });
        const withdrawals = (await Promise.filter(
            transactions,
            async (tx) => {
                const goingToProcess = await isGoingToProcess(tx);
                return (isUTXO(tx) || isWithdrawal(tx)) && goingToProcess;
            },
            { concurrency: 1 },
        )).map(addWithdrawalsAttribute);
        return withdrawals;
    }

    async processWithdrawal(withdrawal) {
        if (withdrawal.inputs) {
            await Promise.each(withdrawal.inputs, input =>
                this.spend(
                    {
                        ...input,
                        spentInTransactionHash: withdrawal.transactionHash,
                    }
                ));
        }
    }

    async spend({ transactionHash, outputIndex, spentInTransactionHash }) {
        this.fundings.markUTXOAsSpent(
            this.name,
            transactionHash,
            outputIndex,
            spentInTransactionHash
        );
    }
}

module.exports = Monitor;
