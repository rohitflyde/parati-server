import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => { 
        try {
            console.log('💾 Multer File Type:', file.mimetype);
            return {
                folder: 'itel/test',
                public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
                resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET, 
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME
            };
        } catch (err) {
            console.error('💥 Error inside CloudinaryStorage.params:', err);
            throw err;
        }
    }
});


export { cloudinary, storage };
