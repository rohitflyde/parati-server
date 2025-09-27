import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import OTP from '../models/OTP.js';
import { generateOtp } from '../utils/generateOtp.js'
import { OAuth2Client } from 'google-auth-library';
import { SendSMS } from '../utils/sendSMS.js';
import { sendEmail } from '../utils/sendEmail.js';
import crypto from 'crypto'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);



const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '200d' } // short-lived
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.REFRESH_SECRET,
        { expiresIn: '500d' } // long-lived
    );
};

export const refreshToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "No refresh token provided.",
            });
        }

        jwt.verify(token, process.env.REFRESH_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({
                    success: false,
                    message:
                        err.name === "TokenExpiredError"
                            ? "Refresh token has expired."
                            : "Invalid refresh token.",
                });
            }

            const newAccessToken = generateAccessToken({
                _id: decoded.id,
                role: decoded.role,
            });


            return res.json({
                success: true,
                accessToken: newAccessToken,
            });
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Failed to refresh token.",
            error: error.message,
        });
    }
};


// ADMIN CONTROLLERS
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users', error: error.message });
    }
};



export const googleAuthHandler = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token is required' });

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name, sub: googleId } = payload;

        let user = await User.findOne({ email });
        // console.log('existing: ', user)

        // Create new user if not exist
        if (!user) {
            user = await User.create({
                name,
                email,
                password: googleId, // or a random string, won't be used
                role: 'customer',
                isGoogleUser: true,
            });
        }

        // After user is fetched/created:
        if (!user.phone || !user.isPhoneVerified) {
            return res.json({
                success: true,
                needsPhone: true,
                message: 'Phone number required to complete registration.',
                userId: user._id,
                email: user.email,
            });
        }

        // if phone verified → return tokens + user
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        return res.json({
            success: true,
            needsPhone: false,
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isPhoneVerified: user.isPhoneVerified,
            }
        });



    } catch (error) {
        console.error('Google auth error:', error.message);
        return res.status(401).json({ message: 'Google authentication failed', error: error.message });
    }
};


export const registerUser = async (req, res) => {
    try {
        const { name, email, phone, password, role = 'customer' } = req.body;

        if (role !== 'admin' && role !== 'customer') {
            return res.status(403).json({ message: 'Unauthorized role' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const user = await User.create({
            name,
            email,
            phone,
            password,
            role,
            isPhoneVerified: false
        });

        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await OTP.create({ email, otp, expiresAt });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        return res.status(200).json({
            success: true,
            message: 'OTP sent to email',
            accessToken,
            refreshToken,
            name: user.name,
            userId: user._id,
            email: user.email,
            phone: user.phone,
            needsOtp: true
        });

    } catch (error) {
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};


export const loginUser = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        if (role !== 'admin' && role !== 'customer') {
            return res.status(403).json({ message: 'Unauthorized role' });
        }

        const user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.role !== role) {
            return res.status(403).json({ message: 'Role mismatch' });
        }

        if (role === 'customer') {
            // ✅ If phone is already verified, login directly
            if (user.isPhoneVerified) {
                const accessToken = generateAccessToken(user);
                const refreshToken = generateRefreshToken(user);

                return res.json({
                    accessToken,
                    refreshToken,
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
                        role: user.role,
                        isPhoneVerified: user.isPhoneVerified,
                    },
                });
            }

            // Otherwise, send OTP
            const otp = generateOtp();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            await OTP.create({ email, otp, expiresAt });

            return res.json({ success: true, message: 'OTP sent to email', email });
        }

        // Admin login
        const token = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        return res.json({
            accessToken: token,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                isPhoneVerified: user.isPhoneVerified,
                role: user.role,
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
};



export const sendOtpForUser = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        const normalizedPhone = phone.replace(/\D/g, '');
        if (normalizedPhone.length !== 10) {
            return res.status(400).json({ success: false, message: "Please enter a valid 10-digit phone number" });
        }

        let user = await User.findOne({ phone: normalizedPhone });
        const existedBefore = !!user;

        if (!user) {
            user = await User.create({
                name: name || 'User',
                email: email || `${normalizedPhone}@temp.com`,
                phone: normalizedPhone,
                password: `${normalizedPhone}_temp`,
                role: 'customer',
                isPhoneVerified: false
            });
        }

        // flags for frontend flow
        const needsDetails = !user.name || (user.email || '').endsWith('@temp.com');

        // Generate OTP (overwrite if exists)
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // store OTP against BOTH identifiers to be robust
        await OTP.deleteMany({ $or: [{ email: user.email }, { phone: normalizedPhone }] });
        await OTP.create({ email: user.email, phone: normalizedPhone, otp, expiresAt });

        // Send SMS
        try {
            const smsText = `Your OTP to log in to ExPro is ${otp}. It is valid for 10 minutes. Do not share it with anyone.`;
            await SendSMS({ phone: normalizedPhone, message: smsText });
        } catch (err) {
            await OTP.deleteMany({ $or: [{ email: user.email }, { phone: normalizedPhone }] });
            return res.status(500).json({ success: false, message: "Failed to send OTP via SMS" });
        }

        // NOTE: tokens optional here; typically issue after verify
        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            phone: normalizedPhone,
            userId: user._id,
            isNewUser: !existedBefore,
            needsDetails
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        return res.status(500).json({ success: false, message: "Failed to send OTP", error: error.message });
    }
};





export const updateUserDetails = async (req, res) => {
    try {
        const { name, email } = req.body;
        const userId = req.user.id; // from auth middleware

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "Name and email are required"
            });
        }

        // Check if email is already taken by another user (only if it's a real email, not temp)
        if (!email.includes('@temp.com')) {
            const existingUser = await User.findOne({
                email,
                _id: { $ne: userId }
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Email is already registered with another account"
                });
            }
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                name: name.trim(),
                email: email.trim().toLowerCase()
            },
            {
                new: true,
                runValidators: true
            }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User details updated successfully",
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role,
                isPhoneVerified: updatedUser.isPhoneVerified
            }
        });

    } catch (error) {
        console.error('Update user error:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to update user details",
            error: error.message
        });
    }
};


export const verifyOtp = async (req, res) => {
    try {
        const { email, otp, phone } = req.body;

        // Find user by phone if provided, otherwise by email
        let user;
        let userEmail = email; // Use a different variable name to avoid const reassignment

        if (phone) {
            const normalizedPhone = phone.replace(/\D/g, '');
            user = await User.findOne({ phone: normalizedPhone });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            // Use the user's email for OTP lookup
            userEmail = user.email;
        }

        // Find the most recent OTP
        const record = await OTP.findOneAndUpdate(
            { email: user.email },
            { otp },
            { upsert: true, new: true }
        ).sort({ createdAt: -1 });

        if (!record || record.otp !== otp) {
            return res.status(401).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        if (record.expiresAt < new Date()) {
            return res.status(410).json({
                success: false,
                message: 'OTP expired'
            });
        }

        // If user not found by phone, find by email
        if (!user) {
            user = await User.findOne({ email: userEmail });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
        }

        // Update user with phone verification
        const updatedUser = await User.findOneAndUpdate(
            { _id: user._id },
            {
                isPhoneVerified: true,
                ...(phone && !user.phone && { phone: phone.replace(/\D/g, '') }) // Add phone if provided and not exists
            },
            { new: true }
        );

        // Generate new tokens after verification
        const accessToken = generateAccessToken(updatedUser);
        const refreshToken = generateRefreshToken(updatedUser);

        // Clean up OTPs
        // Clean up OTPs for this user (both email & phone based)
        await OTP.deleteMany({
            $or: [
                { email: updatedUser.email },
                { phone: updatedUser.phone }
            ]
        });


        return res.json({
            success: true,
            message: 'OTP verified successfully',
            accessToken,
            refreshToken,
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role,
                isPhoneVerified: true
            }
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'OTP verification failed',
            error: error.message
        });
    }
};


export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await user.remove();
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete user', error: error.message });
    }
};

export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        };

        if (user.role === 'customer') {
            userResponse.addresses = user.addresses || [];
        }

        res.json(userResponse);
    } catch (error) {
        res.status(500).json({ message: 'Failed to get profile', error: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        if (req.body.password) user.password = req.body.password;

        // 🔍 Address update only for customer
        if (user.role === 'customer' && Array.isArray(req.body.addresses)) {
            user.addresses = req.body.addresses;
        }

        const updatedUser = await user.save();

        res.json({
            id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            addresses: updatedUser.addresses || []
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Both current and new password are required." });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found." });

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: "Current password is incorrect." });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: "Password updated successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to change password", error: error.message });
    }
};


export const forgotPassword = async (req, res) => {
    const { input } = req.body;

    try {
        let user;
        let identifierType;

        // Check if input is phone
        if (/^\d{10}$/.test(input)) {
            user = await User.findOne({ phone: input });
            identifierType = 'phone';
            console.log('phone');
        }
        // Check if input is email
        else if (/^\S+@\S+\.\S+$/.test(input)) {
            user = await User.findOne({ email: input.toLowerCase() });
            identifierType = 'email';
            console.log('email');
        }
        // Invalid input
        else {
            return res.status(400).json({
                message: 'Enter a valid 10-digit phone number or email address'
            });
        }

        if (!user) {
            return res.status(404).json({
                message: `${identifierType === 'phone' ? 'Phone number' : 'Email'} not found`
            });
        }

        // Phone OTP flow - Send both SMS and email
        if (identifierType === 'phone') {
            const otp = generateOtp();

            await OTP.deleteOne({ phone: input });

            // Create and save new OTP document directly
            await OTP.create({
                phone: input,  // Only phone provided
                otp: otp
            });

            // Send SMS
            const smsMessage = `Your OTP to log in to ExPro is ${otp}. It is valid for 10 minutes. Do not share it with anyone.`;
            await SendSMS({ phone: input, message: smsMessage });


            // Also send email with token (similar to email flow)
            const token = crypto.randomBytes(32).toString('hex');
            await User.findByIdAndUpdate(user._id, {
                resetPasswordToken: token,
                resetPasswordExpires: Date.now() + 3600000 // 1 hour
            });

            const resetLink = `${process.env.CLIENT_URL}/auth/reset-password/${token}`;

            if (user.email) {
                await sendEmail({
                    to: user.email,
                    subject: 'Reset your password',
                    html: `
                        <h3>Password Reset Request</h3>
                        <p>We received a password reset request for your account linked to phone number ${input}.</p>
                        <p>An OTP has been sent to your phone. You can also reset using this link:</p>
                        <p>Your OTP to log in to ExPro is ${otp}. It is valid for 10 minutes. Do not share it with anyone.</p>
                        <a href="${resetLink}">Reset Password</a>
                        <p>This link expires in 1 hour.</p>
                        <p>If you didn't request this, please ignore this email.</p>
                    `,
                });
            }

            return res.json({
                method: 'phone',
                message: 'OTP sent to your phone and reset options sent to your email',
                phone: input, // Include phone in response
                nextStep: '/verify-forgot-otp' // New route for forgot password OTP verification
            });
        }

        // Email flow (original implementation)
        const token = crypto.randomBytes(32).toString('hex');
        await User.findByIdAndUpdate(user._id, {
            resetPasswordToken: token,
            resetPasswordExpires: Date.now() + 3600000 // 1 hour
        });

        const resetLink = `${process.env.CLIENT_URL}/auth/reset-password/${token}`;

        await sendEmail({
            to: user.email,
            subject: 'Reset your password',
            html: `
                <h3>Password Reset Request</h3>
                <p>Click below to reset your password:</p>
                <a href="${resetLink}">Reset Password</a>
                <p>This link expires in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `,
        });

        return res.json({
            method: 'email',
            message: 'Reset link sent to your email',
            nextStep: '/check-email' // Frontend can show "check your email" page
        });

    } catch (err) {
        console.error('Forgot Password Error:', err);
        return res.status(500).json({
            message: 'Failed to process password reset request'
        });
    }
};

export const verifyResetToken = async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        }).select('_id');

        if (!user) {
            console.log('Invalid token or expired:', req.params.token);
            return res.json({ valid: false });
        }

        return res.json({ valid: true });
    } catch (err) {
        console.error('Token verification error:', err);
        return res.status(500).json({ valid: false });
    }
}

export const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        // Update password
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (err) {
        res.status(500).json({ message: 'Error resetting password' });
    }
}


// Verify Forgot Password OTP
export const verifyForgotOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        // Find OTP record
        const otpRecord = await OTP.findOne({ phone });

        if (!otpRecord || otpRecord.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (otpRecord.expiresAt < new Date()) {
            return res.status(400).json({ message: 'OTP has expired' });
        }

        // Generate password reset token
        const token = crypto.randomBytes(32).toString('hex');
        await User.findOneAndUpdate(
            { phone },
            {
                resetPasswordToken: token,
                resetPasswordExpires: Date.now() + 3600000 // 1 hour
            }
        );

        // Delete used OTP
        await OTP.deleteOne({ phone });

        return res.json({
            success: true,
            token,
            message: 'OTP verified successfully',
            nextStep: '/reset-password' // Frontend can redirect to password reset
        });

    } catch (error) {
        console.error('Forgot OTP verification error:', error);
        return res.status(500).json({
            message: 'Failed to verify OTP',
            error: error.message
        });
    }
};

// Resend Forgot Password OTP
export const resendForgotOtp = async (req, res) => {
    try {
        const { phone } = req.body;

        // Generate new OTP
        const otp = generateOtp();

        // Update OTP record
        await OTP.deleteOne({ phone });
        await OTP.create({
            phone,
            otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

        // Send SMS
        const smsMessage = `Your OTP to log in to ExPro is ${otp}. It is valid for 10 minutes. Do not share it with anyone.`;
        await SendSMS({ phone, message: smsMessage });

        return res.json({
            success: true,
            message: 'New OTP sent successfully'
        });

    } catch (error) {
        console.error('Resend forgot OTP error:', error);
        return res.status(500).json({
            message: 'Failed to resend OTP',
            error: error.message
        });
    }
};