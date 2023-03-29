const mongoose = require('mongoose')
const Schema = mongoose.Schema

const addressSchema = Schema(
    {
        id: { type: Number, default: 1 },
        service: { type: String, required: true },
        address: { type: String, required: true },
        memo: { type: String },
        path: { type: String, required: true },
        type: { type: String, enum: ["settlement", "user"] },
    },
    { timestamps: true }
)

addressSchema.pre("save", async function () {
    const latestId = await Address.find().sort({ "id": -1 });
    if (latestId.length) this.id = latestId[0].id + 1
})

const Address = mongoose.model("Address", addressSchema)
module.exports = Address