const AddressModel = require('../models/address.model')

class Address {
    constructor(wallet) {
        this.type = {
            FEE: 'fee',
            USER: 'user',
            SETTLEMENT: 'settlement',
            COLDWALLET: 'cold',
        };
        this.path = {
            FEE: '0/1/0',
            HOTWALLET: '0/1/0',
            COLDWALLET: '100/0/0'
        };
        this.wallets = wallet;
    }

    async create(path, memo, address, service, walletId, type) {
        return await AddressModel.create({
            path,
            memo,
            address,
            service,
            walletId,
            type
        })
    }

    async findByPath(service, path) {
        return await AddressModel.findOne({ service, path })
    }

    async findByAddressAndService(service, address) {
        return await AddressModel.findOne({ service, address })
    }

    async findByAddressMemoAndService(service, address, memo) {
        return await AddressModel.findOne({ service, address, memo })
    }

    async findByLowerCaseAddressAndService(service, address) {
        return await AddressModel.findOne({
            service,
            address: { $regex: new RegExp("^" + address.toLowerCase(), "i") }
        })
    }

    async findByIdNum(idNum) {
        return await AddressModel.findOne({ id: idNum })
    }
}

module.exports = Address
