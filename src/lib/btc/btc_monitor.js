const Promise = require('bluebird');
const Monitor = require('../monitor');
const constants = require('./btc_constants')
const { rangeToArray } = require('../../utils');
const logger = require('../../helpers/logger.helper')

class BtcMonitor extends Monitor {
    constructor({
        block,
        token,
        funding,
        wallet,
        address,
        withdrawal,
        btcRpc,
        btcInterpreter,
        BTC_SLEEP_TIME,
        BTC_START_BLOCK_HEIGHT,
        BTC_MINIMUM_CONFIRMATION,
    }) {
        super({
            block,
            token,
            funding,
            withdrawal,
            api: btcRpc,
            name: constants.SERVICE_NAME,
            currency: constants.CURRENCY,
            sleepTime: Number(BTC_SLEEP_TIME),
            startBlockHeight: Number(BTC_START_BLOCK_HEIGHT),
            minimumConfirmation: Number(BTC_MINIMUM_CONFIRMATION),
        });
        this.currency = constants.CURRENCY;
        this.interpreter = btcInterpreter;
        this.wallets = wallet;
        this.addresses = address;
    }

    async fetchRange(fromHeight, toHeight) {
        if (fromHeight > toHeight) return;
        const heights = rangeToArray(fromHeight, toHeight);
        await Promise.each(heights, async (height) => {
            if (!this.isRunning) return;
            const blockHash = await this.api.getBlockHashByHeight(height);
            const block = await this.api.getBlock(blockHash);
            const txs = block.tx ? block.tx : []
            const transactions = [];
            await Promise.each(txs, async (transaction) => {
                try {
                    const parsedTx = await this.interpreter.parseTransaction(transaction, height);
                    // Parse transacion of BTC is an array
                    if (parsedTx.length) {
                        transactions.push(...parsedTx);
                    }
                } catch (error) {
                    console.log('error', error);
                    logger.log(this.currency + ' fetchRange error:' + error)
                }
            });
            const nextBlock = { hash: block.hash, height, transactions };
            this.nextBlocks.push(nextBlock);
        }, { concurrency: 1 });
    }
}

module.exports = BtcMonitor;
