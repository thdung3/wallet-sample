const jayson = require('jayson');
const Promise = require('bluebird');
const logger = require('../../helpers/logger.helper')

class BtcRpc {
    constructor({ btcNodeUrl }) {
        this.nodeUrl = btcNodeUrl;
        this.sleepTime = 10;
        this.MAX_ATTEMPT = 20;
        if (!this.nodeUrl) {
            throw Error('Please provide BTC_NODE_URL');
        }
        this.client = Promise.promisifyAll(jayson.client.http(this.nodeUrl));
    }

    async getBlock(blockHash, raw, verbose = 2, attempt = 0) {
        try {
            return (await this.client.requestAsync('getblock', [blockHash, verbose])).result;
        }
        catch (error) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Failed after ${attempt} retries , exit. Error: ${error}`)
                throw Error(`Failed after ${attempt} retries , exit. Error: ${error}`);
            }
            await Promise.delay(1000 * this.sleepTime);
            return await this.getBlock(blockHash, raw, verbose = 2, attempt + 1);
        }
    }

    async getBlockHashByHeight(height, attempt = 0) {
        try {
            return (await this.client.requestAsync('getblockhash', [height])).result;
        }
        catch (error) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Failed after ${attempt} retries , exit. Error: ${error}`);
                throw Error(`Failed after ${attempt} retries , exit. Error: ${error}`);
            }
            await Promise.delay(1000 * this.sleepTime);
            return await this.getBlockHashByHeight(height, attempt + 1);
        }
    }

    async getRawTx(txHash, verbose = 1, attempt = 0) {
        try {
            return (await this.client.requestAsync('getrawtransaction', [txHash, verbose])).result;
        }
        catch (error) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Failed after ${attempt} retries , exit. Error: ${error}`);
                throw Error(`Failed after ${attempt} retries , exit. Error: ${error}`);
            }
            await Promise.delay(1000 * this.sleepTime);
            return await this.getRawTx(txHash, verbose, attempt + 1);
        }

    }

    async decodeRawTransaction(rawTransaction, attempt = 0) {
        try {
            return (await this.client.requestAsync('decoderawtransaction', [rawTransaction])).result;
        }
        catch (error) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Failed after ${attempt} retries , exit. Error: ${error}`);
                throw Error(`Failed after ${attempt} retries , exit. Error: ${error}`);
            }
            await Promise.delay(1000 * this.sleepTime);
            return await this.decodeRawTransaction(rawTransaction, attempt + 1);
        }
    }

    async getLatestBlockHeight(attempt = 0) {
        try {
            return (await this.client.requestAsync('getblockcount', [])).result;
        }
        catch (error) {
            if (attempt >= this.MAX_ATTEMPT) {
                logger.log(`Failed after ${attempt} retries , exit. Error: ${error}`);
                throw Error(`Failed after ${attempt} retries , exit. Error: ${error}`);
            }
            await Promise.delay(1000 * this.sleepTime);
            return await this.getLatestBlockHeight(attempt + 1);
        }
    }

    async sendSignedTransaction(hex, attempt = 0) {
        try {
            return (await this.client.requestAsync('sendrawtransaction', [hex])).result;
        }
        catch (error) {
            logger.log(error.message)
            throw Error(error.message);
        }
    }
}

module.exports = BtcRpc;
