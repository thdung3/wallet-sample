const FundingModel = require('../models/funding.model')

class Funding {
    constructor() {
        this.type = {
            FUNDING: 'funding',
            MOVE_FUND: 'move_fund',
            VIRTUAL: 'virtual',
        };
        this.state = {
            CONFIRMED: 'confirmed',
            PENDING: 'pending',
            FAILED: 'failed',
        };
    }

    async create({ service, transactionHash, outputIndex,
        type, blockHeight, amount, currency, addressId, address, memo, script, state }) {
        return await FundingModel.create({
            service,
            transactionHash,
            outputIndex,
            type,
            blockHeight,
            amount,
            currency,
            addressId,
            address,
            memo,
            script,
            state
        })
    }

    async find(service, transactionHash, outputIndex) {
        return await FundingModel.findOne({ service, transactionHash, outputIndex })
    }

    async markUTXOIsSpent(service, transactionHash) {
        return await FundingModel.findOneAndUpdate(
            {
                service,
                transactionHash
            },
            {
                isSpent: true
            }
        )
    }

    async markUTXOIsNotSpent(service, transactionHash) {
        return await FundingModel.findOneAndUpdate(
            {
                service,
                transactionHash
            },
            {
                isSpent: false
            }
        )
    }

    async markUTXOAsSpent(service, transactionHash, outputIndex, spentInTransactionHash) {
        return await FundingModel.findOneAndUpdate(
            { service, transactionHash, outputIndex },
            { spentInTransactionHash }
        )
    }

    async markMoveFund(service, transactionHash) {
        return await FundingModel.findOneAndUpdate(
            { service, transactionHash },
            { isMoveFund: true }
        )
    }

    async findFundingByTxHashAndOutputIndex(service, transactionHash, outputIndex, type) {
        return await FundingModel.findOne(
            { service, transactionHash, outputIndex, type }
        )
    }

    async computeAvailableWithdrawUTXONotSpent(service) {
        const balance = await FundingModel.aggregate([
            {
                $match: {
                    service,
                    isSpent: false
                }
            },
            {
                $group: {
                    _id: "$service",
                    amount: { $sum: "$amount" }
                }
            }
        ])
        if (balance.length)
            return balance[0].amount
        else
            return 0
    }

    async findTopUnspentFunding(service) {
        return await FundingModel.find({
            service,
            isSpent: false
        }).sort({
            amount: -1
        })
    }
}

module.exports = Funding