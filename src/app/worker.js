const debug = require('debug')('wallet:worker');
const snakeCaseKeys = require('snakecase-keys');
const fetch = require('node-fetch');
const { resolve: urlResolve } = require('url');
const Promise = require('bluebird');
const BACKEND_URL = process.env.BACKEND_URL
const DEPOSIT_PATH = process.env.DEPOSIT_PATH
const logger = require('../helpers/logger.helper')

async function call(bodyDeposit) {
    try {
        console.log('bodyDeposit:', bodyDeposit)
        const method = 'POST';
        const headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify(bodyDeposit)
        const options = { method, body, headers };
        const url = urlResolve(BACKEND_URL, DEPOSIT_PATH);
        return await fetch(url, options);
    } catch (err) {
        logger.log('Deposit call back end err:', err)
        console.log('Deposit call url.err:', err)
    }
}

function create({ monitor, balancesHash }) {
    // const producer = createKafka();
    // When an event emitted from monito
    const sleepTime = 1;
    const maxAttempt = 1;
    const timeout = 20000;

    monitor.on('deposit', async (block) => {
        // Convert to json
        const snakeCaseBlock = snakeCaseKeys(block, { deep: false });
        let body = snakeCaseBlock.balances_hash
        const raw = call(body);

        const jsonBalancesHash = JSON.stringify(snakeCaseBlock);
        debug(`New block: ${jsonBalancesHash}`);
        logger.log(`New block: ${jsonBalancesHash}`)

        balancesHash.create(monitor.name, jsonBalancesHash, true, "deposit")
    });

    monitor.on('withdraw', async (block) => {
        // Convert to json
        console.log("block", block);
        // const messages = {  block.hash, block.height, block.balancesHash, block.confirmedNetworkTxs ,token  } 
        const snakeCaseBlock = snakeCaseKeys(block, { deep: false });

        const jsonBalancesHash = JSON.stringify(snakeCaseBlock);
        // const raw = call(body);

        debug(`New block: ${jsonBalancesHash}`);
        balancesHash.create(monitor.name, jsonBalancesHash, true, "withdrawal")
    });

    return monitor;
}

module.exports = { create };
