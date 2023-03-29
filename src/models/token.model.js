const mongoose = require('mongoose')
const Schema = mongoose.Schema

const tokenSchema = Schema(
    {
        service: { type: String, required: true },
        currency: { type: String, required: true },
        address: { type: String, required: true, unique: true },
        enabled: { type: Boolean, default: false },
        decimals: { type: Number }
    },
    { timestamps: true }
)

const Token = mongoose.model("Token", tokenSchema)
module.exports = Token