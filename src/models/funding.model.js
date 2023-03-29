const mongoose = require('mongoose')
const Schema = mongoose.Schema

const fundingModel = Schema(
    {
        service: { type: String, required: true },
        currency: { type: String },
        transactionHash: { type: String, required: true },
        outputIndex: { type: Number, default: 0 },
        type: { type: String, enum: ["funding", "virtual"] },
        blockHeight: { type: Number, required: true },
        amount: { type: Number, required: true },
        addressId: { type: Number },
        address: { type: String },
        memo: { type: String, default: null },
        spentInTransactionHash: { type: String, default: null },
        isSpent: { type: Boolean, default: false },
        state: { type: String, enum: ["confirmed", "pending", "failed"] },
        isMoveFund: { type: Boolean, default: false },
        script: { type: String }
    },
    {
        timestamps: true
    }
)

const Funding = mongoose.model('Funding', fundingModel)
module.exports = Funding