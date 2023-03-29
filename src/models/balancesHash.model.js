const mongoose = require('mongoose')
const Schema = mongoose.Schema

const BalancesHashModel = Schema(
    {
        service: { type: String, required: true },
        content: { type: String },
        isConfirmed: { type: Boolean, default: true },
        type: { type: String, enum: ["deposit", "withdrawal"] }
    },
    {
        timestamps: true
    }
)

const BalancesHash = mongoose.model('BalancesHash', BalancesHashModel)
module.exports = BalancesHash



