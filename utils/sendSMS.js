import axios from 'axios';

export const SendSMS = async ({ phone, message }) => {
    const smsUrl = 'http://sms.smswaale.com/V2/http-api.php';

    // Validate inputs
    if (!phone || !message) {
        throw new Error('Phone number and message are required');
    }

    // Clean and validate phone number
    const cleanPhone = phone.toString().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
        throw new Error(`Invalid phone number format: ${phone}`);
    }

    const params = {
        apikey: process.env.SMSWAALE_API_KEY,
        senderid: process.env.SMSWAALE_SENDER_ID,
        number: `91${cleanPhone}`,
        message: message.trim(),
        format: 'json',
    };

    // Log for debugging
    console.log('📤 SMS Params:', {
        ...params,
        apikey: '***hidden***', // Don't log API key
        message: message
    });

    try {
        const response = await axios.get(smsUrl, {
            params,
            timeout: 10000 // 10 second timeout
        });

        console.log('📱 SMS API Response:', response.data);

        // Check if SMS was sent successfully
        if (response.data.status === 'success' || response.data.status === 'OK') {
            return {
                success: true,
                data: response.data,
                phone: cleanPhone
            };
        } else {
            throw new Error(`SMS API returned error: ${JSON.stringify(response.data)}`);
        }

    } catch (error) {
        console.error('❌ SMS sending failed:', {
            phone: cleanPhone,
            error: error.message,
            response: error.response?.data
        });

        // Return error details for better debugging
        throw new Error(`Failed to send SMS to ${cleanPhone}: ${error.message}`);
    }
};

// Test function for debugging
export const testSMS = async (phone, message = 'Test message from cart service') => {
    try {
        console.log('🧪 Testing SMS service...');
        const result = await SendSMS({ phone, message });
        console.log('✅ SMS test successful:', result);
        return result;
    } catch (error) {
        console.error('❌ SMS test failed:', error.message);
        throw error;
    }
};