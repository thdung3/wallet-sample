const constants = require('./btc_constants')
const { Address, HDPublicKey, Networks } = require('bitcore-lib');
const Promise = require('bluebird');

class BtcInterpreter {
    constructor({
        address,
        funding,
        wallet,
        btcRpc
    }) {
        this.addresses = address;
        this.fundings = funding;
        this.wallet = wallet;
        this.name = constants.SERVICE_NAME
        this.currency = constants.CURRENCY
        this.api = btcRpc;
    }

    async derive(wallet, hdPath) {
        const hdPublicKey = new HDPublicKey(wallet.xpub);
        const path = hdPath.indexOf('m') > -1 ? hdPath : `m/${hdPath}`;
        const address = new Address(hdPublicKey.derive(path).publicKey, Networks.mainnet).toString();
        return { address };
    }

    async parseTransaction(transaction, blockHeight) {
        let inputs = null;
        const vin = transaction.vin.filter(item => item.txid && item.vout >= 0);
        const input = vin[0];
        const isWithdrawal =
            input && (await this.fundings.find(this.name, input.txid, input.vout));
        if (isWithdrawal) {
            // If the transaction is withdrawal, create inputs
            inputs = await Promise.map(transaction.vin, async item => ({
                ...item,
                transactionHash: item.txid,
                outputIndex: item.vout,
            }));
        }
        const outputs = [];
        // parse vout
        await Promise.each(transaction.vout, async (item) => {

            const { scriptPubKey, n, value } = item;

            const { addresses, hex } = scriptPubKey;
            if (addresses && addresses.length > 0) {
                let toAddress = await this.addresses.findByAddressAndService(this.name, addresses[0])
                if (isWithdrawal || toAddress) {
                    outputs.push({
                        inputs,
                        blockHeight,
                        height: blockHeight,
                        currency: this.currency,
                        feeCurrency: constants.FEE_CURRENCY,
                        amount: value,
                        to: addresses[0],
                        toAddress,
                        transactionHash: transaction.txid,
                        outputIndex: n,
                        script: hex,
                    });
                }
            }
        });
        return outputs;
    }
}

module.exports = BtcInterpreter;
