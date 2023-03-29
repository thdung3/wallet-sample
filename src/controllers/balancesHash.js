const BalancesHashModel = require('../models/balancesHash.model')

class BalancesHash {
    async create(service, content, isConfirmed, type) {
        return await BalancesHashModel.create({ service, content, isConfirmed, type })
    }
}

module.exports = BalancesHash