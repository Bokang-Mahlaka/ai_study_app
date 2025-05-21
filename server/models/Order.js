import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    menuItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Menu',
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    customizations: [{
        name: String,
        selectedOption: String
    }],
    price: {
        type: Number,
        required: true
    }
});

const orderSchema = new mongoose.Schema({
    customer: {
        name: String,
        phone: {
            type: String,
            required: true
        },
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String
        }
    },
    items: [orderItemSchema],
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'upi'],
        required: true
    },
    estimatedDeliveryTime: Date,
    actualDeliveryTime: Date,
    notes: String,
    whatsappMessageId: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
orderSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Order = mongoose.model('Order', orderSchema);

export default Order; 