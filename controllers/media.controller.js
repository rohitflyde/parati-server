import Media from '../models/Media.js';

// Get all media (with optional filters like year/month)
export const getAllMedia = async (req, res) => {
    try {
        const { year, month, uploadedBy } = req.query;

        const filter = {};
        if (year) filter.year = parseInt(year);
        if (month) filter.month = parseInt(month);
        if (uploadedBy) filter.uploadedBy = uploadedBy;

        const mediaItems = await Media.find(filter).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Media fetched successfully',
            count: mediaItems.length,
            data: mediaItems,
        });
    } catch (error) {
        console.error('Error fetching media:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching media',
        });
    }
};

// Get single media by ID
export const getMediaById = async (req, res) => {
    try {
        const media = await Media.findById(req.params.id);

        if (!media) {
            return res.status(404).json({
                success: false,
                message: 'Media not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Media fetched successfully',
            data: media,
        });
    } catch (error) {
        console.error('Error fetching media by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching media',
        });
    }
};

// Delete media by ID
export const deleteMedia = async (req, res) => {
    try {
        const media = await Media.findById(req.params.id);

        if (!media) {
            return res.status(404).json({
                success: false,
                message: 'Media not found',
            });
        }

        await Media.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Media deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting media:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting media',
        });
    }
};

// (Optional) Update media title
export const updateMediaTitle = async (req, res) => {
    try {
        const { title } = req.body;

        const media = await Media.findByIdAndUpdate(
            req.params.id,
            { title, updatedAt: new Date() },
            { new: true }
        );

        if (!media) {
            return res.status(404).json({
                success: false,
                message: 'Media not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Media title updated successfully',
            data: media,
        });
    } catch (error) {
        console.error('Error updating media title:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating media',
        });
    }
};
