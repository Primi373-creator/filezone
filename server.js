// server.js
const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const { customAlphabet } = require('nanoid');

const app = express();
const port = 3000;
const domain = 'yourdomain.com'; // Replace with your actual domain

// Connect to MongoDB for file storage
mongoose.connect('mongodb+srv://uploader3:uploader3@uploader3...');

// Connect to MongoDB for URL storage
const urlDb = mongoose.createConnection('mongodb+srv://uploader3:uploader3@uploader3...');

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!allowedTypes.includes(file.mimetype)) {
            const error = new Error('Only image files are allowed');
            error.code = 'UNSUPPORTED_MEDIA_TYPE';
            return cb(error, false);
        }
        cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// File model for storing file metadata
const File = require('./model');

// URL model for storing original URLs and short IDs
const Url = urlDb.model('Url', new mongoose.Schema({
    originalUrl: { type: String, required: true },
    shortId: { type: String, required: true, unique: true },
}));

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 6); // Customize the short ID length if needed

// Shorten URL function using short ID
const shortenUrl = (shortId) => `http://${domain}/${shortId}`;

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            const error = new Error('Please upload an image file');
            error.code = 'BAD_REQUEST';
            throw error;
        }

        const randomFileName = crypto.randomBytes(10).toString('hex');
        const fileExtension = path.extname(req.file.originalname);

        // Store metadata in MongoDB
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 3);

        const shortId = nanoid(); // Generate a short ID
        const newFile = new File({
            filename: randomFileName + fileExtension,
            contentType: req.file.mimetype,
            expirationDate: expirationDate,
            shortId: shortId, // Store the short ID in the MongoDB document
            fileData: req.file.buffer, // Store the file data in the MongoDB document
        });

        const savedFile = await newFile.save();

        // Construct the streaming link with the short ID
        const shortUrl = shortenUrl(shortId);

        // Store the original URL and short ID in the URL MongoDB collection
        await new Url({ originalUrl: `http://${domain}/${savedFile._id}`, shortId: shortId }).save();

        res.json({ 
            originalUrl: `http://${domain}/${savedFile._id}`,
            shortUrl: shortUrl 
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'UNSUPPORTED_MEDIA_TYPE' || error.code === 'BAD_REQUEST') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/:id', async (req, res) => {
    try {
        const fileId = req.params.id;

        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Set the appropriate Content-Type header
        res.setHeader('Content-Type', file.contentType);
        // Stream the file data directly from the MongoDB document
        res.send(file.fileData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/shorten/:id', async (req, res) => {
    try {
        const shortId = req.params.id;

        // Retrieve the original URL from the URL MongoDB collection
        const urlDoc = await Url.findOne({ shortId });

        if (urlDoc) {
            res.json({ originalUrl: urlDoc.originalUrl, shortUrl: shortenUrl(urlDoc.shortId) });
        } else {
            res.status(404).json({ error: 'Shortened URL not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
