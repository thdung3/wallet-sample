const TokenModel = require('../models/token.model')

class Token {

    async createWithEnable(service, address, currency, enabled, decimals) {
        return await TokenModel.create({ service, address, currency, enabled, decimals })
    }

    async findByServiceAndCurrency(service, currency) {
        return await TokenModel.findOne({ service, currency })
    }

    async findByServiceAndAddress(service, address) {
        return await TokenModel.findOne({ service, address })
    }

    async findByLowerCaseServiceAndAddress(service, address) {
        return await TokenModel.findOne({
            service,
            address: { $regex: new RegExp("^" + address.toLowerCase(), "i") }
        })
    }

    async isEnabled(service, currency, address) {
        // Check for column enabled of table Token
        const found = await TokenModel.findOne({ service, currency, enabled: true })
        return found && (!found.address || found.address === address);
    }
}

module.exports = Token