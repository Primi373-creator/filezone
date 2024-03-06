const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    expirationDate: Date,
});

const File = mongoose.model('File', fileSchema);

module.exports = File;
