const WalletModel = require('../models/wallet.model')

class Wallet {
    constructor() {
    }

    async create(service, xpub, hotWallet, xpriv, coldWallet, mnemonic) {
        return await WalletModel.create({
            service,
            xpub,
            hotWallet,
            xpriv,
            coldWallet,
            mnemonic
        })
    }

    async findByXpub(service, xpub) {
        return await WalletModel.findOne({ service, xpub })
    }

    async findByService(service) {
        return await WalletModel.findOne({ service })
    }

    async findById(id) {
        return await WalletModel.findOne({ id })
    }

    async updateHotWallet(service, hotWallet) {
        return await WalletModel.findOneAndUpdate({ service }, { hotWallet })
    }

}

module.exports = Wallet