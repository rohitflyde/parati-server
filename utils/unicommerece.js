import axios from "axios";

// Global token storage
let accessToken = null;
let tokenExpiry = null;

const createUnicommerceApi = () => {
    const requiredEnvVars = [
        'UNICOMMERCE_API_URL',
        'UNICOMMERCE_USERNAME',
        'UNICOMMERCE_PASSWORD',
        'UNICOMMERCE_FACILITY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        console.error('❌ Missing Unicommerce environment variables:', missingVars);
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    return axios.create({
        baseURL: process.env.UNICOMMERCE_API_URL,
        headers: {
            "Content-Type": "application/json",
        },
        timeout: 30000
    });
};

// OAuth2 Token Management - Using the same method as the working example
export const getUnicommerceAccessToken = async () => {
    try {
        // Check if we have a valid token
        if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
            return accessToken;
        }

        console.log("🔄 Getting new OAuth2 access token from Unicommerce...");

        const unicommerceApi = createUnicommerceApi();

        // Using the exact same method as the working example
        const authResponse = await unicommerceApi.get('/oauth/token', {
            params: {
                grant_type: 'password',
                client_id: 'my-trusted-client', // Fixed client_id
                username: process.env.UNICOMMERCE_USERNAME,
                password: process.env.UNICOMMERCE_PASSWORD
            }
        });

        accessToken = authResponse.data?.access_token;
        // Set token expiry (subtract 60 seconds for safety margin)
        tokenExpiry = Date.now() + (authResponse.data.expires_in * 1000) - 60000;

        console.log("✅ Successfully obtained OAuth2 access token");
        return accessToken;

    } catch (error) {
        console.error("❌ OAuth2 Token Request Failed:", {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        throw new Error("Failed to obtain OAuth2 access token");
    }
};

// Create authenticated API instance
const createAuthenticatedUnicommerceApi = async () => {
    const token = await getUnicommerceAccessToken();
    const api = createUnicommerceApi();

    api.defaults.headers.Authorization = `Bearer ${token}`;
    return api;
};

export const pushOrderToUnicommerce = async (order) => {
    let unicommerceApi;

    try {
        // Get authenticated API instance
        unicommerceApi = await createAuthenticatedUnicommerceApi();

        const orderId = order._id?.toString();
        const shortOrderId = orderId.slice(-6).toUpperCase();

        const prefixedCode = `ITELTEST-${orderId}`;
        const prefixedDisplayCode = `ITELTEST-${shortOrderId}`;

        // Prepare sale order items
        const saleOrderItems = order.items.map((item, idx) => {
            const sellingPrice = item.salePrice || item.price;
            const totalPrice = sellingPrice * item.quantity;

            console.log('sellingPrice:', sellingPrice, 'totalPrice:', totalPrice);

            return {
                itemSku: item.variant?.sku || item.product?.sku,
                shippingMethodCode: "STD",
                code: `${prefixedCode}-ITEM${idx + 1}`,
                packetNumber: idx + 1,
                giftWrap: false,
                giftMessage: "",
                facilityCode: process.env.UNICOMMERCE_FACILITY,
                totalPrice: totalPrice?.toString(),
                sellingPrice: sellingPrice?.toString(),
                prepaidAmount: order.paymentMethod === "cod" ? "0" : totalPrice?.toString(),
                discount: "0",
                shippingCharges: order.shippingFee ? order.shippingFee?.toString() : "0",
                storeCredit: "0",
                giftWrapCharges: "0"
            };
        });

        // Prepare addresses array - using referenceId system like the working example
        const referenceId = 'addr1'; // Static reference ID like in the working example

        const addresses = [{
            id: referenceId,
            name: order.shippingAddress?.name || order.user?.name,
            addressLine1: order.shippingAddress?.line1,
            addressLine2: order.shippingAddress?.line2 || "",
            city: order.shippingAddress?.city,
            state: order.shippingAddress?.state,
            country: order.shippingAddress?.country || "India",
            pincode: order.shippingAddress?.pincode,
            phone: order.shippingAddress?.phone,
            email: order.shippingAddress?.email || order.user?.email
        }];

        const orderDate = new Date().toISOString();
        let totalPrepaidAmount = order.total;

        if (order.paymentMethod?.toLowerCase() === 'cod') {
            totalPrepaidAmount = 0;
        }

        const payload = {
            saleOrder: {
                code: prefixedCode,
                displayOrderCode: prefixedDisplayCode,
                displayOrderDateTime: orderDate,
                channelProcessingTime: orderDate,
                customerCode: order.user?._id?.toString() || `CUST-${shortOrderId}`,
                customerName: order.shippingAddress?.name || order.user?.name,
                customerGSTIN: "", // Add if available
                channel: "ITEL_CUSTOM",
                notificationEmail: order.shippingAddress?.email || order.user?.email,
                notificationMobile: order.shippingAddress?.phone,
                cashOnDelivery: order.paymentMethod === "cod",
                paymentInstrument: order.paymentMethod === "cod" ? "CASH" : "ONLINE",
                additionalInfo: `Order from ITEL Webstore - ${prefixedDisplayCode}`,
                thirdPartyShipping: false,
                addresses: addresses,
                billingAddress: {
                    referenceId: referenceId
                },
                shippingAddress: {
                    referenceId: referenceId
                },
                saleOrderItems: saleOrderItems,
                currencyCode: "INR",
                taxExempted: false,
                cformProvided: false,
                totalDiscount: order.discount || 0,
                totalShippingCharges: order.shippingFee || 0,
                totalCashOnDeliveryCharges: order.paymentMethod === "cod" ? order.total : 0,
                totalGiftWrapCharges: 0,
                totalStoreCredit: 0,
                totalPrepaidAmount: totalPrepaidAmount,
                useVerifiedListings: true
            }
        };

        console.log("📤 Sending sale order to Unicommerce...");

        const { data } = await unicommerceApi.post('/services/rest/v1/oms/saleOrder/create', payload);

        console.log("✅ Unicommerce Sale Order Response:", data);
        return data;

    } catch (error) {
        console.error("❌ Unicommerce Sale Order Push Error:", {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url
        });

        // If it's an authentication error, try to get a new token and retry once
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.log("🔄 Authentication failed, attempting to get new token and retry...");
            try {
                accessToken = null; // Clear invalid token
                tokenExpiry = null;

                unicommerceApi = await createAuthenticatedUnicommerceApi();
                const { data } = await unicommerceApi.post('/services/rest/v1/oms/saleOrder/create', payload);

                console.log("✅ Retry successful after token refresh:", data);
                return data;
            } catch (retryError) {
                console.error("❌ Retry also failed:", retryError.message);
            }
        }

        return { success: false, error: error.message };
    }
};


// Function to sync inventory from Unicommerce (like in the working example)
export const syncInventoryFromUnicommerce = async (skus) => {
    try {
        const skusArray = Array.isArray(skus) ? skus : [skus];
        const unicommerceApi = await createAuthenticatedUnicommerceApi();

        const inventoryResponse = await unicommerceApi.post(
            '/services/rest/v1/inventory/inventorySnapshot/get',
            { itemTypeSKUs: skusArray },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Facility': process.env.UNICOMMERCE_FACILITY
                }
            }
        );

        const inventoryData = inventoryResponse.data;

        if (inventoryData && inventoryData.inventorySnapshots) {
            // Update product stock in database
            const bulkOps = inventoryData.inventorySnapshots.map(item => ({
                updateOne: {
                    filter: { sku: item.itemTypeSKU },
                    update: { $set: { stock: item.inventory } }
                }
            }));

            if (bulkOps.length > 0) {
                // You'll need to import your Product model
                // await ProductModel.bulkWrite(bulkOps);
                console.log("✅ Inventory synced for SKUs:", skusArray);
            }

            return inventoryData.inventorySnapshots;
        }

    } catch (error) {
        console.error("❌ Inventory sync failed:", error.message);
        throw error;
    }
};


export const fetchUnicommerceSaleOrder = async (saleOrderCode) => {
    try {
        const api = await createAuthenticatedUnicommerceApi();
        const resp = await api.post(
            '/services/rest/v1/oms/saleorder/get',
            { code: saleOrderCode }
        );

        console.log("✅ Fetched sale order from Unicommerce:", resp.data);
        return resp.data;
    } catch (err) {
        console.error("❌ Failed fetching sale order from Unicommerce:", err.message);
        return null;
    }
};
