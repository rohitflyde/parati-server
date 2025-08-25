// utils/sendEmail.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, html }) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Itel <onboarding@resend.dev>',
            to,
            subject,
            html
        });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Email send error:', err);
        throw new Error('Failed to send email');
    }
};
