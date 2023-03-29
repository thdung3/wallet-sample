const BlockModel = require('../models/block.model')

class Block {
    constructor() {
    }

    async findByService(service) {
        return await BlockModel.findOne({ service })
    }

    async updateHeight(service, height) {
        const find = await this.findByService(service)
        if (find) {
            return await BlockModel.findOneAndUpdate({ service }, { height })
        } else {
            return await BlockModel.create({ service, height })
        }
    }
}

module.exports = Block