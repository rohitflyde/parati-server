import dotenv from 'dotenv';
dotenv.config();

import cron from 'node-cron';
import Cart from '../models/Cart.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { SendSMS } from '../utils/sendSMS.js';

const storeUrl = process.env.STORE_URL;
const storeName = process.env.STORE_NAME;

const REMINDER_SCHEDULE = [
    {
        interval: 1 * 60 * 1000, // 1 minute (testing purpose)
        template: (storeName, urlSlug) =>
            `You have items from ${storeName} left in your cart, Please click on expro.store/${urlSlug} to complete the checkout via ExPro.`
    },
    {
        interval: 10 * 60 * 1000, // 10 minutes (replace with 2 hours in prod)
        template: (storeName, urlSlug) =>
            `You have items from ${storeName} left in your cart, Please click on expro.store/${urlSlug} to complete the checkout via ExPro.`
    },
    {
        interval: 15 * 60 * 1000, // 15 minutes (replace with 24 hours in prod)
        template: (storeName, urlSlug) =>
            `You have items from ${storeName} left in your cart, Please click on expro.store/${urlSlug} to complete the checkout via ExPro.`
    }
];

async function processAbandonedCarts() {
    try {
        const now = new Date();
        // console.log(`🔄 Processing abandoned carts at: ${now.toISOString()}`);

        for (let stage = 0; stage < REMINDER_SCHEDULE.length; stage++) {
            const { interval, template } = REMINDER_SCHEDULE[stage];
            const cutoffTime = new Date(now.getTime() - interval);

            // console.log(`📊 Stage ${stage}: Looking for carts older than ${cutoffTime.toISOString()}`);

            const carts = await Cart.aggregate([
                {
                    $match: {
                        reminderStage: stage,
                        createdAt: { $lte: cutoffTime },
                        $or: [
                            { lastReminderAt: { $lte: cutoffTime } },
                            { lastReminderAt: { $exists: false } }
                        ],
                        userId: { $exists: true },
                        isActive: true
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'productId',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                { $unwind: '$user' },
                { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } }
            ]);

            // console.log(`📱 Found ${carts.length} carts for stage ${stage} reminder`);

            for (const cart of carts) {
                try {
                    if (!cart.user?.phone) {
                        console.log(`⚠️ No phone number for user: ${cart.user?._id}`);
                        continue;
                    }

                    const phoneNumber = cart.user.phone.toString().replace(/\D/g, '');
                    if (phoneNumber.length !== 10) {
                        console.log(`⚠️ Invalid phone number: ${cart.user.phone}`);
                        continue;
                    }

                    const smsMessage = template(storeName, 'cart');

                    console.log(`📤 Sending SMS to ${phoneNumber}: ${smsMessage.substring(0, 60)}...`);

                    const smsResult = await SendSMS({
                        phone: phoneNumber,
                        message: smsMessage
                    });

                    console.log(`✅ SMS Response:`, smsResult);

                    await Cart.updateOne(
                        { _id: cart._id },
                        {
                            $set: {
                                reminderStage: stage + 1,
                                lastReminderAt: now
                            }
                        }
                    );

                    console.log(`✅ Stage ${stage + 1} SMS sent to ${phoneNumber}`);

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (smsError) {
                    console.error(`❌ Failed to send SMS to ${cart.user.phone}:`, smsError);
                }
            }
        }
    } catch (err) {
        console.error('❌ Reminder job failed:', err);
    }
}

// console.log('🚀 Cron job service started at:', new Date());
// console.log('🏪 Store Name:', storeName);
// console.log('🔗 Store URL:', storeUrl);

cron.schedule('* * * * *', () => {
    console.log('⏰ Cron heartbeat - running at:', new Date());
    processAbandonedCarts();
});

export { processAbandonedCarts };
