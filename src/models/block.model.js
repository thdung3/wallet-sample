const mongoose = require('mongoose')
const Schema = mongoose.Schema

const blockSchema = Schema(
    {
        service: { type: String, required: true, unique: true },
        height: { type: Number, required: true, default: 0 }
    },
    {
        timestamps: true
    }
)

const Block = mongoose.model('Block', blockSchema)

module.exports = Block