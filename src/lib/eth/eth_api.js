const Api = require('../api');
const Web3 = require('web3')
// let web3 = new Web3(process.env.ETH_NODE_URL);
const ETH_NODE_URL = process.env.ETH_NODE_URL || "wss://mainnet.infura.io/ws/v3/7a084d9985a34b9c90a3c3ebcd9f019d"
let web3 = new Web3(new Web3.providers.WebsocketProvider(ETH_NODE_URL, {
    clientConfig: {
        maxReceivedFrameSize: 100000000,
        maxReceivedMessageSize: 100000000,
    }
}))
const Promise = require('bluebird')
const logger = require('../../helpers/logger.helper')


class EthApi extends Api {
    constructor({ ethNodeUrl }) {
        super({ baseUrl: ethNodeUrl });
        this.MAX_ATTEMPT = 20;
        this.sleepTime = 10;
    }

    async initWSConnection() {
        // return web3 = new Web3(process.env.ETH_NODE_URL);
        return web3 = new Web3(new Web3.providers.WebsocketProvider(ETH_NODE_URL, {
            clientConfig: {
                maxReceivedFrameSize: 100000000,
                maxReceivedMessageSize: 100000000,
            }
        }))
    }

    async validateAddress(address, attempt = 0) {
        try {
            return await web3.utils.isAddress(address)
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Validate address error: ${err}`)
                throw Error(`Validate address error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.validateAddress(address, attempt + 1)
        }
    }

    async getGasPrice(attempt = 0) {
        try {
            return await web3.eth.getGasPrice()
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Get gas price error: ${err}`)
                throw Error(`Get gas price error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.getGasPrice(attempt + 1)
        }
    }

    async signTransaction(rawTx, privateKey, attempt = 0) {
        try {
            return await web3.eth.accounts.signTransaction(rawTx, privateKey)
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Sign Transaction error: ${err}`)
                throw Error(`Sign Transaction error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.signTransaction(rawTx, privateKey, attempt + 1)
        }
    }

    async sendSignedTransaction(signedTx, attempt = 0) {
        try {
            return await web3.eth.sendSignedTransaction(signedTx)
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Send signed transaction error: ${err}`)
                throw Error(`Send signed transaction error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.sendSignedTransaction(signedTx, attempt + 1)
        }
    }

    async getLatestBlockHeight(attempt = 0) {
        try {
            const number = await web3.eth.getBlockNumber();
            if (!number) {
                const sync = await web3.eth.isSyncing();
                if (sync) {
                    return sync.currentBlock;
                }
                return 0;
            }
            return number
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Get latest block height error: ${err}`)
                throw Error(`Get latest block height error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.getLatestBlockHeight(attempt + 1)
        }
    }


    async getBlock(height, attempt = 0) {
        try {
            return await web3.eth.getBlock(height, true);
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Get block error: ${err}`)
                throw Error(`Get block error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.getBlock(height, attempt + 1)
        }
    }

    async getBalance(address, attempt = 0) {
        try {
            const balance = await web3.eth.getBalance(address);
            return balance;
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Get balance error: ${err}`)
                throw Error(`Get balance error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.getBalance(address, attempt + 1)
        }
    }

    async getTransactionReceipt(txHash, attempt = 0) {
        try {
            return await web3.eth.getTransactionReceipt(txHash);
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Get transaction receipt error: ${err}`)
                throw Error(`Get transaction receipt error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.getTransactionReceipt(txHash, attempt + 1)
        }
    }

    async getTransaction(txHash, attempt = 0) {
        try {
            return await web3.eth.getTransaction(txHash);
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Get transaction receipt error: ${err}`)
                throw Error(`Get transaction receipt error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.getTransaction(txHash, attempt + 1)
        }
    }

    async getNonce(address, attempt = 0) {
        try {
            const nonce = await web3.eth.getTransactionCount(address);
            return nonce;
        } catch (err) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Get nonce error: ${err}`)
                throw Error(`Get nonce error: ${err}`);
            }
            await this.initWSConnection()
            await Promise.delay(1000 * this.sleepTime)
            return await this.getNonce(address, attempt + 1)
        }
    }
}

module.exports = EthApi;
