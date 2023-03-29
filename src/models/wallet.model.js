const mongoose = require('mongoose')
const Schema = mongoose.Schema

const walletSchema = Schema(
    {
        id: { type: Number, default: 1 },
        service: { type: String, required: true, unique: true },
        xpub: { type: String },
        hotWallet: { type: String },
        xpriv: { type: String },
        mnemonic: { type: String },
        coldWallet: { type: String }
    },
    {
        timestamps: true
    }
)

walletSchema.pre("save", async function () {
    const latestId = await Wallet.find().sort({ "id": -1 });
    if (latestId.length) this.id = latestId[0].id + 1
})

const Wallet = mongoose.model("Wallet", walletSchema)
module.exports = Wallet