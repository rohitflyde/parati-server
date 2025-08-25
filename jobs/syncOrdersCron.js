import cron from 'node-cron';
import Order from '../models/Order.js';
import { fetchUnicommerceSaleOrder } from '../utils/unicommerece.js';

cron.schedule('*/30 * * * *', async () => {
    console.log("⏳ Syncing Unicommerce order statuses...");

    const ordersToSync = await Order.find({
        status: { $in: ['confirmed', 'processing', 'shipped'] }
    });

    for (const order of ordersToSync) {
        const orderCode = `ITELTEST-${order._id}`;
        const data = await fetchUnicommerceSaleOrder(orderCode);

        if (data?.saleOrderDTO) {
            const dto = data.saleOrderDTO;
            const newStatus = dto.status?.toLowerCase(); // Adjust mapping if needed
            const pkg = dto.shippingPackages?.[0];
            const courierName = pkg?.shippingProvider;
            const trackingUrl = pkg?.trackingNumber || '';

            await Order.findByIdAndUpdate(order._id, {
                status: newStatus,
                courierName,
                trackingUrl
            });

            console.log(`✅ Order ${order._id} synced: ${newStatus}`);
        }
    }
});