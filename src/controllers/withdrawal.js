const WithdrawalModel = require('../models/withdrawal.model')

class Withdrawal {
    constructor() {
        this.state = {
            CONFIRMED: 'confirmed',
            PENDING: 'pending',
            FAILED: 'failed',
            DUPLICATE: 'duplicate',
            BROADCASTED: 'broadcasted'
        };
    }

    async create({ service, toAddress, memo, transactionHash, outputIndex, currency, amount, externalId, state }) {
        return await WithdrawalModel.create({
            service,
            toAddress,
            memo,
            transactionHash,
            outputIndex,
            currency,
            amount,
            externalId,
            state
        })
    }

    async find(service, transactionHash, outputIndex) {
        return await WithdrawalModel.findOne({
            service,
            transactionHash,
            outputIndex
        })
    }

    async findByServiceAndExternalId(service, externalId) {
        return await WithdrawalModel.findOne({
            service,
            externalId
        })
    }

    async updateStateAndStatus(service, externalId, state, status) {
        return await WithdrawalModel.findOneAndUpdate(
            {
                service,
                externalId
            },
            {
                state,
                status
            })
    }

    async updateStateAndTransactionHash(service, externalId, state, transactionHash) {
        return await WithdrawalModel.findOneAndUpdate(
            {
                service,
                externalId
            },
            {
                state,
                transactionHash
            })
    }

    async markAsConfirmed(service, transactionHash) {
        return await WithdrawalModel.updateMany(
            { service, transactionHash },
            { state: this.state.CONFIRMED }
        )
    }
}

module.exports = Withdrawal

