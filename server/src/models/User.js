import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema({
    label: { type: String, trim: true, default: "Home" },
    address: {
        type: String,
        required: [true, "Address is required"],
        trim: true,
    },
    // Same GeoJSON shape as Shop, so checkout can hand these coordinates
    // straight to the delivery calculator without converting anything.
    location: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: {
            type: [Number],
            required: [true, "Coordinates are required"],
        },
    },
    isDefault: { type: Boolean, default: false },
});

/**
 * A saved way to pay.
 *
 * Only Mobile Money is stored. A MoMo number is not a secret the way a card
 * number is - it is the same number a customer reads out to a merchant on the
 * phone.
 *
 * Cards are deliberately NOT storable. Keeping a card number would put this
 * project in PCI scope; the correct approach is to store a Paystack
 * authorization token instead of the card itself. That needs Paystack, which
 * is not connected, so the option does not exist rather than existing in a
 * broken or unsafe form.
 */
const paymentMethodSchema = new mongoose.Schema({
    type: { type: String, enum: ["momo"], default: "momo" },
    provider: {
        type: String,
        enum: ["MTN", "Vodafone", "AirtelTigo"],
        required: [true, "Choose a mobile money provider"],
    },
    phone: {
        type: String,
        required: [true, "A mobile money number is required"],
        trim: true,
    },
    isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
    {
        name: {
            type:String,
            required: [true, 'Name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters long'],
        },
        role: {
            type:String,
            enum: ['customer', 'merchant', 'admin'],
            default: 'customer',
        },
        // Subdocuments get their own _id, which is what the app uses to edit
        // or remove a single entry.
        addresses: [addressSchema],
        paymentMethods: [paymentMethodSchema],
    },
    {
        timestamps: true,
    }
)

userSchema.pre('save', async function (){
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
})

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;