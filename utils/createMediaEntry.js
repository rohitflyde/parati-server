import Media from '../models/Media.js'

export const createMediaEntry = async (file, uploadedBy) => {
    const now = new Date();

    const media = await Media.create({
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        fileType: file.mimetype,
        title: file.originalname,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        date: now.getDate(),
        uploadedBy,
    });

    return media._id; 
};
