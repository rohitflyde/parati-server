import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, required: true },      // e.g. House No. 123
    line2: { type: String },                      // Optional landmark or society
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
    phone: { type: String, required: false },
    label: { type: String, enum: ['Home', 'Office', 'Other'], default: 'home' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    role: {
      type: String,
      enum: ['customer', 'admin', 'guest'],
      default: 'customer',
    },
    isGoogleUser: {
      type: Boolean,
      default: false,
    },
    phone: { type: String, required: true, unique: true },
    isPhoneVerified: { type: Boolean, default: false },

    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    addresses: [addressSchema],
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next(); // <-- add this check
  this.password = await bcrypt.hash(this.password, 12);
  next();
});


// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
