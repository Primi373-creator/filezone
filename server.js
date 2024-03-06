// server.js
const express = require('express');
const mongoose = require('mongoose');
const { customAlphabet } = require('nanoid');
const axios = require('axios');

const app = express();
const port = 3000;
const domain = 'yourdomain.com'; // Replace with your actual domain

// Connect to MongoDB for file storage
mongoose.connect('mongodb+srv://uploader4:uploader4@uploader4.qpxbp5y.mongodb.net/?retryWrites=true&w=majority&appName=uploader4');

// Connect to MongoDB for URL storage
const urlDb = mongoose.createConnection('mongodb+srv://uploader2:uploader2@uploader2.uhnmx1u.mongodb.net/?retryWrites=true&w=majority&appName=uploader2');

const { Schema } = mongoose;

const storage = new Schema({
  filename: String,
  contentType: String,
  expirationDate: Date,
  shortId: String,
  fileData: Buffer,
});

const fileModel = mongoose.model('File', storage);

const urlModel = urlDb.model('Url', new Schema({
  originalUrl: { type: String, required: true },
  shortId: { type: String, required: true, unique: true },
}));

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 6);

const shortenUrl = (shortId) => `http://${domain}/${shortId}`;

app.use(express.json());
app.use(express.static('public'));
// Common handler for both GET and POST requests
const handleRequest = async (req, res, handler) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(error);
    if (error.code === 'BAD_REQUEST') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

app.route('/upload')
  .all((req, res) => handleRequest(req, res, async (req, res) => {
    const { url } = req.body || req.query;

    if (!url) {
      const error = new Error('Please provide a URL');
      error.code = 'BAD_REQUEST';
      throw error;
    }

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const fileData = Buffer.from(response.data, 'binary');

    const randomFileName = nanoid();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 3);
    const shortId = nanoid();

    const newFile = new fileModel({
      filename: randomFileName,
      contentType: response.headers['content-type'],
      expirationDate,
      shortId,
      fileData,
    });

    await newFile.save();

    await new urlModel({
      originalUrl: url,
      shortId,
    }).save();

    const shortUrl = shortenUrl(shortId);

    res.json({
      originalUrl: url,
      shortUrl,
    });
  }));

app.route('/:id')
  .all((req, res) => handleRequest(req, res, async (req, res) => {
    const fileId = req.params.id;

    const file = await fileModel.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', file.contentType);
    res.send(file.fileData);
  }));

app.route('/shorten/:id')
  .all((req, res) => handleRequest(req, res, async (req, res) => {
    const shortId = req.params.id;

    const urlDoc = await urlModel.findOne({ shortId });

    if (urlDoc) {
      res.json({ originalUrl: urlDoc.originalUrl, shortUrl: shortenUrl(urlDoc.shortId) });
    } else {
      res.status(404).json({ error: 'Shortened URL not found' });
    }
  }));

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
