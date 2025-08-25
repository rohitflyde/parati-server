// utils/orderEmailTemplate.js
export const generateOrderEmail = (order) => {
    console.log('order: ', order)
    const orderIdShort = order._id.toString().slice(-6).toUpperCase();
    const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount).replace('₹', '₹');
    };

    // Generate items HTML
    const itemsHtml = order.items.map(item => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 15px;">
      <tr>
        <td width="80" valign="top">
<img src="${item.product.featuredImage?.filePath || 'https://via.placeholder.com/70'}" 
     alt="${item.product.name}"
     width="70"
     height="70"
     style="width:70px; height:70px; border-radius:6px; display:block; border:0;"
/>
        </td>
        <td style="padding-left: 15px;">
          <p style="margin: 0; font-weight: bold; color: #333;">${item.product.name}</p>
          <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Qty: ${item.quantity}</p>
          <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Price: ${formatCurrency(item.salePrice)}</p>
        </td>
      </tr>
    </table>
  `).join('');

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Order Confirmation</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f8f8;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f8f8; padding: 20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            <!-- Header -->
            <tr>
              <td style="padding: 20px; text-align: center;">
               <img src="https://admin.itelshopindia.com/uploads/2024/08/23/itel-logo-70x-2-1724408311903.svg" 
     alt="Itel Logo" 
     width="120" 
     height="40"
     style="height:40px; width:auto; display:block; margin:0 auto; border:0;"
/>
              </td>
            </tr>

            <!-- Thank You Message -->
            <tr>
              <td style="padding: 0 30px 20px 30px; text-align: center;">
                <h2 style="margin: 0; color: #333;">Thank you for your order!</h2>
                <p style="color: #555;">We're processing it and will let you know once it's shipped.</p>
              </td>
            </tr>

            <!-- Order Summary -->
            <tr>
              <td style="padding: 20px 30px;">
                <h3 style="margin: 0 0 10px; color: #333;">Order Summary</h3>
                <p style="margin: 0; font-size: 14px; color: #666;">Order ID: <strong>#${orderIdShort}</strong></p>
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Placed on: <strong>${orderDate}</strong></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />

                ${itemsHtml}

                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />

                <!-- Total -->
                <p style="font-size: 16px; color: #333;"><strong>Total: ${formatCurrency(order.total)}</strong></p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 20px 30px; text-align: center; background-color: #fafafa; color: #999; font-size: 12px;">
                For help, contact us at <a href="mailto:support@itelshopindia.com" style="color: #555; text-decoration: none;">support@itelshopindia.com</a><br />
                &copy; 2025 Itel Shop India. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};