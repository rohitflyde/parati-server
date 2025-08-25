export const notFound = (req, res, next) => {
    res.status(404).json({ message: 'Route not found' });
};

export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
};
