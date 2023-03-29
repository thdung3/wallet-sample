const Promise = require('bluebird');
const Monitor = require('../monitor');
const hdkey = require('ethereumjs-wallet/hdkey');
const constants = require('./eth_constants')
const { rangeToArray, decryptWithAES, formatingNumber } = require('../../utils');
// web3.ultils does not need Node URL
const Web3 = require('web3')
const web3 = new Web3()
const logger = require('../../helpers/logger.helper')

class EthMonitor extends Monitor {
    constructor({
        block,
        token,
        funding,
        wallet,
        address,
        withdrawal,
        ethApi,
        ethInterpreter,
        ETH_SLEEP_TIME,
        ETH_START_BLOCK_HEIGHT,
        ETH_MINIMUM_CONFIRMATIONS,
    }) {
        super({
            block,
            token,
            funding,
            withdrawal,
            api: ethApi,
            name: constants.SERVICE_NAME,
            currency: constants.CURRENCY,
            sleepTime: Number(ETH_SLEEP_TIME),
            startBlockHeight: Number(ETH_START_BLOCK_HEIGHT),
            minimumConfirmation: Number(ETH_MINIMUM_CONFIRMATIONS),
        });
        this.currency = constants.CURRENCY;
        this.interpreter = ethInterpreter;
        this.wallets = wallet;
        this.addresses = address;
        this.minimumMoveFund = Number(process.env.ETH_MINIMUM_MOVE_FUND);
        this.maximumGasPriceMoveFund = Number(process.env.ETH_MAXIMUM_GAS_PRICE_MOVE_FUND);
    }

    async fetchRange(fromHeight, toHeight) {
        if (fromHeight > toHeight) return;
        const heights = rangeToArray(fromHeight, toHeight);
        await Promise.each(heights, async (height) => {
            if (!this.isRunning) return;
            const block = await this.api.getBlock(height);
            const txs = block.transactions ? block.transactions : []
            const transactions = [];
            await Promise.each(txs, async (transaction) => {
                try {
                    const parsedTx = await this.interpreter.parseTransaction(transaction, height);
                    if (parsedTx) {
                        transactions.push(parsedTx);
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

    async autoMoveFunds(funding) {
        try {
            // Wait for the transaction fee was moved   
            let countWaited = 0;
            let gasPrice = await this.api.getGasPrice()
            gasPrice = parseFloat(web3.utils.fromWei(gasPrice, 'gwei'))
            while ((countWaited < 72) && (gasPrice >= this.maximumGasPriceMoveFund)) {
                // 1 hours
                await Promise.delay(1000 * 60 * 60);
                gasPrice = await this.api.getGasPrice()
                gasPrice = parseFloat(web3.utils.fromWei(gasPrice, 'gwei'))
                countWaited++;
            }

            const wallet = await this.wallets.findByService(this.name);
            if (funding.toAddress.address !== wallet.hotWallet && funding.toAddress.address !== wallet.coldWallet) {
                const fromPath = funding.toAddress.path
                const xprivateDecrypt = decryptWithAES(wallet.xpriv)
                const xprivate = hdkey.fromExtendedKey(xprivateDecrypt);
                const privateKey = xprivate.derivePath(`m/${fromPath}`).getWallet().getPrivateKeyString()

                // Create tx for signing
                let balance = await this.api.getBalance(funding.toAddress.address);
                balance = parseFloat(web3.utils.fromWei(balance, 'ether'))
                let txAmount = formatingNumber(balance - constants.BASE_FEE)
                txAmount = web3.utils.toWei(txAmount.toString(), "ether")
                let gasPrice = await this.api.getGasPrice()

                const rawTx = {
                    to: wallet.hotWallet,
                    gasPrice,
                    gas: constants.GAS_LIMIT,
                    value: txAmount
                }

                const signTx = await this.api.signTransaction(rawTx, privateKey)

                const broadcast = await this.api.sendSignedTransaction(signTx.rawTransaction)
                // Update database
                this.fundings.markMoveFund(this.name, funding.transactionHash)
            }
        } catch (error) {
            console.log('Auto move fund error:', error)
            logger.log('Auto move fund error:' + error)
        }
    }

    async distributeGasAndMoveFund(fundings) {
        // ETH no need to distribute Gas
        fundings.map((item) => {
            if (item.amount > this.minimumMoveFund) {
                let movefund = this.autoMoveFunds(item);
            }
        })
    }
}

module.exports = EthMonitor;
