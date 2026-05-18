import mongoose from 'mongoose';

const InventoryItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    qty: { type: Number, default: 1 },
    acquiredAt: { type: Date, default: Date.now },
    // Reserved for future Web3 use: when the item is tokenized this holds the on-chain ref.
    tokenId: { type: String, default: null },
  },
  { _id: false },
);

const PlayerProfileSchema = new mongoose.Schema(
  {
    privyId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    email: { type: String, default: '' },
    walletAddress: { type: String, default: '' },
    coins: { type: Number, default: 0 },
    inventory: { type: [InventoryItemSchema], default: [] },
    unlockedZones: { type: [String], default: [] },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

PlayerProfileSchema.methods.toClientJSON = function toClientJSON() {
  return {
    privyId: this.privyId,
    username: this.username,
    coins: this.coins,
    inventory: this.inventory,
    unlockedZones: this.unlockedZones,
    walletAddress: this.walletAddress,
    createdAt: this.createdAt,
  };
};

export const PlayerProfile = mongoose.model('PlayerProfile', PlayerProfileSchema);
