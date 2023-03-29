const ip = require('ip');
const _ = require('lodash');
const Decimal = require('decimal.js');
const FlakeId = require('flake-idgen');
const CryptoJS = require('crypto-js');
const serviceToken = process.env.SERVICE_TOKEN;


const generator = new FlakeId({
    // Prevent multiple servers collision
    id: ip.toLong(ip.address()) % 1024,
});

function capTransactions(transactions, maximumAmount) {
    let total = new Decimal(0);
    return _.sortBy(transactions, 'id').filter((t) => {
        total = total.add(t.grossAmount);
        return total.lte(maximumAmount);
    });
}

function formatAddressWithMemo({ address, memo }) {
    return `${address},memo_text:${memo}`;
}

function splitAddressAndMemo(hash) {
    const addressAndMemo = hash.split(",");
    const address = addressAndMemo[0];
    let memo = '';
    if (addressAndMemo[1]) {
        memo = addressAndMemo[1].split(":")[1];
    }
    return { address, memo }
}

function nextId() {
    return new Decimal(`0x${generator.next().toString('hex')}`).toFixed();
}

function generateMemo(path) {
    const id = path.replace('0/0/', '');
    const memo = parseInt(id) + 101000000
    return memo
}

function formatingNumber(number) {
    return Math.round(number * Math.pow(10, 6)) / Math.pow(10, 6)
}

function formatingNumberWithDecimal(number, decimal) {
    return Math.round(number * Math.pow(10, decimal)) / Math.pow(10, decimal)
}

function buildConfirmNetworkTxs(withdrawals) {
    const confirmedNetworkTxs = [];
    withdrawals.forEach((withdrawal) => {
        const { transactionHash, currency, outputIndex, amount } = withdrawal;
        confirmedNetworkTxs.push({
            currency,
            transactionHash,
            outputIndex,
            amount,
        });
    });
    return confirmedNetworkTxs;
}

function buildBalancesHash(fundings) {
    const balancesHash = {};
    const deposits = [];
    fundings.forEach((funding) => {
        const { transactionHash, currency, amount, toAddress } = funding;
        const address = toAddress.fullAddress || toAddress.address;
        if (!balancesHash[currency]) {
            balancesHash[currency] = {};
        }
        if (!balancesHash[currency][address]) {
            balancesHash[currency][address] = {};
        }
        const addressBalancesHash = balancesHash[currency][address];
        if (!addressBalancesHash[transactionHash]) {
            addressBalancesHash[transactionHash] = '0';
        }
        addressBalancesHash[transactionHash] = new Decimal(addressBalancesHash[transactionHash])
            .add(new Decimal(amount))
            .toFixed();
    });

    try {
        if (balancesHash != {}) {
            const currencies = Object.keys(balancesHash);
            currencies.forEach(currency => {
                if (balancesHash[currency] != {}) {
                    const addresses = Object.keys(balancesHash[currency]);
                    addresses.forEach((address) => {
                        const addressBalancesHash = balancesHash[currency][address];
                        const transansactionHashs = Object.keys(addressBalancesHash);
                        transansactionHashs.forEach(transactionHash => {
                            const amount = addressBalancesHash[transactionHash];
                            deposits.push({
                                currency,
                                address,
                                transactionHash,
                                amount,
                            })
                        })
                    });
                }
            })

        }
        return deposits;
    } catch (err) {
        return [];
    }
}

function arrayToMap(array, { keys = [], separator = '_' }) {
    const map = new Map();

    array.forEach((element) => {
        const key = keys.map(k => element[k]).join(separator);
        map.set(key, element);
    });

    return map;
}

function rangeToArray(startAt, to) {
    const size = (to - startAt) + 1; // include startAt and to
    return [...Array(size).keys()].map(i => i + startAt);
}

function encryptWithAES(text) {
    return CryptoJS.AES.encrypt(text, serviceToken).toString();
}

function decryptWithAES(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, serviceToken);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
};

module.exports = {
    nextId,
    capTransactions,
    buildBalancesHash,
    formatAddressWithMemo,
    buildConfirmNetworkTxs,
    arrayToMap,
    rangeToArray,
    splitAddressAndMemo,
    generateMemo,
    encryptWithAES,
    decryptWithAES,
    formatingNumber,
    formatingNumberWithDecimal
};
