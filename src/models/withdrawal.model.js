const mongoose = require('mongoose')
const Schema = mongoose.Schema

const withdrawalModel = Schema(
    {
        service: { type: String, required: true },
        currency: { type: String, required: true },
        toAddress: { type: String, required: true },
        memo: { type: String, default: null },
        transactionHash: { type: String },
        outputIndex: { type: Number, default: 0 },
        amount: { type: Number },
        externalId: { type: String },
        state: { type: String, enum: ["confirmed", "pending", "failed", "duplicate"], default: "pending" },
        status: { type: String },
    },
    {
        timestamps: true
    }
)

const Withdrawal = mongoose.model('Withdrawal', withdrawalModel)
module.exports = Withdrawal