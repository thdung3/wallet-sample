const Promise = require('bluebird');
const Monitor = require('../monitor');
const xrpConstants = require('./xrp_constants')
const logger = require('../../helpers/logger.helper')

class XrpMonitor extends Monitor {
    constructor({
        block,
        token,
        funding,
        wallet,
        address,
        withdrawal,
        xrpApi,
        xrpInterpreter,
        XRP_SLEEP_TIME,
        XRP_START_BLOCK_HEIGHT,
        XRP_MINIMUM_CONFIRMATIONS,
    }) {
        super({
            block,
            token,
            funding,
            withdrawal,
            api: xrpApi,
            sleepTime: Number(XRP_SLEEP_TIME),
            startBlockHeight: Number(XRP_START_BLOCK_HEIGHT),
            minimumConfirmation: Number(XRP_MINIMUM_CONFIRMATIONS),
        });

        this.currency = xrpConstants.CURRENCY;
        this.interpreter = xrpInterpreter;
        this.minimumMoveFund = Number(process.env.XRP_MINIMUM_MOVE_FUND)
        this.wallets = wallet;
        this.addresses = address;
        this.name = xrpConstants.SERVICE_NAME;
        this.currency = xrpConstants.CURRENCY;
        this.xrpTokenAccount = xrpConstants.XRP_TOKEN_ACCOUNT;
        this.itemPerPage = 10;
    }

    async fetchRange(fromHeight, toHeight) {
        if (fromHeight > toHeight) return;
        const txsMap = await this.buildTxsMap(fromHeight, toHeight);
        const blocksMap = await this.buildBlocksMap(txsMap, fromHeight, toHeight);
        await Promise.each(
            Array.from(blocksMap.keys()).sort(),
            async (height) => {
                const rawTransactions = blocksMap.get(height);
                const transactions = [];
                await Promise.each(
                    rawTransactions,
                    async item => {
                        const tx = await this.interpreter.parseTransaction(item, height)
                        transactions.push(tx)
                    }
                );
                this.nextBlocks.push({ height, transactions });
            }, { concurrency: 1 }
        )
    }

    async buildTxsMap(fromHeight, toHeight) {
        // Get all settlement addresses to fetch
        const wallet = await this.wallets.findByService(this.name)

        // Fetch transactions off all addresses
        // Use txsMap to keep only one tx from all with same hash
        // Use blocksMap to collect txs with same height
        let txs = await this.api.getTransactions(wallet.hotWallet, fromHeight)

        // Reformating txs
        txs = txs.map(item => {
            return {
                account: item.address,
                height: item.outcome.ledgerVersion,
                hash: item.id,
                toAddress: item.specification.destination.address,
                memo: item.specification.destination.tag,
                amount: parseFloat(item.specification.source.maxAmount.value),
                currency: item.specification.source.maxAmount.currency,
            };
        })

        // Filter with conditionsr
        let txsMap = txs
            .filter(tx => tx.height >= fromHeight && tx.height <= toHeight)
            .filter(tx => tx.currency == this.currency)
        return txsMap;
    }

    async buildBlocksMap(txsMap, fromHeight, toHeight) {
        const blocksMap = new Map();
        txsMap.forEach(tx => blocksMap.set(
            tx.height,
            (blocksMap.get(tx.height) || []).concat(tx),
        ));

        // Set a virtual block for height = toHeight
        // Because there is no transactions there
        if (!blocksMap.get(toHeight)) blocksMap.set(toHeight, []);

        return blocksMap;
    }
}

module.exports = XrpMonitor;
