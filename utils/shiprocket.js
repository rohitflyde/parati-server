import axios from "axios";

let shiprocketToken = null;
let tokenExpiry = null;

// 🚀 Login & get token
export async function getShiprocketToken() {
    if (shiprocketToken && tokenExpiry && Date.now() < tokenExpiry) {
        return shiprocketToken;
    }

    const response = await axios.post("https://apiv2.shiprocket.in/v1/external/auth/login", {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD
    });

    shiprocketToken = response.data.token;
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 hours

    return shiprocketToken;
}

// 🚀 Create Shiprocket Order
export async function createShiprocketOrder(order) {

    console.log('order: ', order)
    try {
        const token = await getShiprocketToken();

        // Get product names safely
        const orderItems = order.items.map(item => {
            const product = item.product || {};
            const shipping = product.shipping || {};

            return {
                name: product.name || product.title || "Product",
                sku: product.sku?.toString().trim() || product._id?.toString() || `item_${Date.now()}`,
                units: item.quantity,
                selling_price: Number(item.price || product.basePrice || product.sp || 1),
                hsn: product.hsn || 7113,

                // ✅ Pull from product schema
                length: shipping?.dimensions?.length || 5,
                breadth: shipping?.dimensions?.width || 5,
                height: shipping?.dimensions?.height || 5,
                weight: shipping?.weight || 5
            };
        });

        // Ensure all required address fields are present
        const shippingAddress = order.shippingAddress || {};

        const totalPrice = order.remainingCOD > 1 ? order.remainingCOD : order.total

        const payload = {
            order_id: order._id?.toString()?.slice(-8)?.toUpperCase(),
            order_date: new Date(order.createdAt || Date.now()).toISOString(),
            channel: "expro",
            pickup_location: "Home",
            channel_id: 8124395,
            billing_customer_name: shippingAddress.name || "Customer",
            billing_last_name: "",
            billing_address: `${shippingAddress.line1 || ""} ${shippingAddress.line2 || ""}`.trim(),
            billing_address_2: "",
            billing_city: shippingAddress.city || "",
            billing_pincode: shippingAddress.pincode || "",
            billing_state: shippingAddress.state || "",
            billing_country: shippingAddress.country || "India",
            billing_email: shippingAddress.email || "noemail@example.com",
            billing_phone: shippingAddress.phone || "",
            shipping_is_billing: true,
            shipping_customer_name: shippingAddress.name || "Customer",
            shipping_last_name: "",
            shipping_address: `${shippingAddress.line1 || ""} ${shippingAddress.line2 || ""}`.trim(),
            shipping_address_2: "",
            shipping_city: shippingAddress.city || "",
            shipping_pincode: shippingAddress.pincode || "",
            shipping_state: shippingAddress.state || "",
            shipping_country: shippingAddress.country || "India",
            shipping_email: shippingAddress.email || "noemail@example.com",
            shipping_phone: shippingAddress.phone || "",
            order_items: orderItems,
            payment_method: order.paymentMethod === "cod" ? "COD" : "Prepaid",
            total_discount: 0,
            sub_total: totalPrice,
            length: shippingAddress.shipping?.dimensions?.length || 5,
            breadth: shippingAddress.shipping?.dimensions?.length || 5,
            height: shippingAddress.shipping?.dimensions?.length || 5,
            weight: shippingAddress.shipping?.weight || 5,
            customer_gstin: "",
            vendor_gstin: "",
            qc_check: true
        };

        console.log('Shiprocket payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            }
        );

        console.log('Shiprocket response:', response.data);
        return response.data;

    } catch (error) {
        console.error("❌ Failed to create Shiprocket order:", error.message);

        if (error.response) {
            // The request was made and the server responded with a status code
            console.error('Shiprocket error response:', error.response.data);
            console.error('Status code:', error.response.status);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from Shiprocket');
        }

        throw error; // Re-throw to handle in the calling function
    }
}

// 🚀 Assign Courier / AWB
export async function assignAWB(orderId, shipmentId) {
    const token = await getShiprocketToken();

    const response = await axios.post(
        "https://apiv2.shiprocket.in/v1/external/courier/assign/awb",
        { shipment_id: shipmentId, courier_id: "" }, // courier_id blank => auto-assign
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
}

// 🚀 Track Order
export async function trackShipment(awbCode) {
    const token = await getShiprocketToken();

    const response = await axios.get(
        `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awbCode}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
}


// 🚀 Generate Shipping Label
export async function generateShippingLabel(shiprocketOrderId) {
    try {
        const token = await getShiprocketToken();

        const response = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/courier/generate/label`,
            {
                params: { order_ids: shiprocketOrderId },
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        return response.data;
    } catch (error) {
        console.error("❌ Failed to generate shipping label:", error.message);
        throw error;
    }
}

// 🚀 Check Serviceability
export async function checkServiceability(pincode, weight = 0.2) {
    try {
        const token = await getShiprocketToken();

        const response = await axios.get(
            "https://apiv2.shiprocket.in/v1/external/courier/serviceability/",
            {
                params: {
                    pickup_postcode: "201010", // Your pickup pincode
                    delivery_postcode: pincode,
                    weight: weight,
                    cod: 1, // Check for COD serviceability
                    mode: "surface" // surface/air
                },
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        return response.data;
    } catch (error) {
        console.error("❌ Serviceability check failed:", error.message);
        throw error;
    }
}


// 🚀 NEW: Get Shipment Tracking Details
export async function getShipmentTracking(shiprocketOrderId) {
    try {
        const token = await getShiprocketToken();

        const response = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/orders/track/${shiprocketOrderId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    } catch (error) {
        console.error("❌ Failed to fetch tracking details:", error.message);
        throw error;
    }
}

// 🚀 NEW: Generate Invoice
// 🚀 Generate Invoice (FIXED)
export async function generateInvoice(shiprocketOrderId) {
    console.log('generate invoice: ', shiprocketOrderId);
    try {
        const token = await getShiprocketToken();
        console.log('token', token);

        const response = await axios.post(
            `https://apiv2.shiprocket.in/v1/external/orders/print/invoice`,
            { ids: [shiprocketOrderId] }, // Shiprocket expects an array
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        console.log('res: ', response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Failed to generate invoice:", error.response?.data || error.message);
        throw error;
    }
}


// 🚀 NEW: Track by AWB
export async function trackByAWB(awbCode) {
    try {
        const token = await getShiprocketToken();

        const response = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awbCode}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    } catch (error) {
        console.error("❌ Failed to track by AWB:", error.message);
        throw error;
    }
}

// 🚀 NEW: Get Order Details
export async function getOrderDetails(shiprocketOrderId) {
    try {
        const token = await getShiprocketToken();

        const response = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/orders/show/${shiprocketOrderId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    } catch (error) {
        console.error("❌ Failed to get order details:", error.message);
        throw error;
    }
}

// 🚀 NEW: Generate Manifest
export async function generateManifest(shiprocketOrderId) {
    try {
        const token = await getShiprocketToken();

        const response = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/manifests/generate`,
            {
                params: { order_ids: shiprocketOrderId },
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        return response.data;
    } catch (error) {
        console.error("❌ Failed to generate manifest:", error.message);
        throw error;
    }
}

// 🚀 NEW: Cancel Order in Shiprocket
export async function cancelShiprocketOrder(shiprocketOrderId) {
    try {
        const token = await getShiprocketToken();

        const response = await axios.post(
            `https://apiv2.shiprocket.in/v1/external/orders/cancel`,
            {
                ids: [shiprocketOrderId]
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    } catch (error) {
        console.error("❌ Failed to cancel order in Shiprocket:", error.message);
        throw error;
    }
}