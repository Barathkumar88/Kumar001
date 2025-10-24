require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const crypto = require("crypto");
const path = require("path");

const app = express();
app.use(express.json());

const mongoURI = process.env.MONGO_URI;
const port = process.env.PORT || 5000;

// Mongo connection
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let gfs, gridfsBucket;
conn.once("open", () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads",
  });
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
  console.log("MongoDB connected and GridFS initialized ✅");
});

// Storage setup
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) return reject(err);
        const filename =
          buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
        };
        resolve(fileInfo);
      });
    });
  },
});
const upload = multer({ storage });

// 🟢 Upload file
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({
    success: true,
    file: req.file,
    url: `/files/${req.file.filename}`,
  });
});

// 🔵 Get all files
app.get("/files", async (req, res) => {
  const files = await gfs.files.find().toArray();
  if (!files || files.length === 0) {
    return res.status(404).json({ message: "No files found" });
  }
  res.json(files);
});

// 🟣 Get file by filename
app.get("/files/:filename", async (req, res) => {
  const file = await gfs.files.findOne({ filename: req.params.filename });
  if (!file) return res.status(404).json({ message: "File not found" });

  const readStream = gridfsBucket.openDownloadStreamByName(req.params.filename);
  readStream.pipe(res);
});

// 🔴 Delete file
app.delete("/files/:id", async (req, res) => {
  try {
    await gridfsBucket.delete(new mongoose.Types.ObjectId(req.params.id));
    res.json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    res.status(404).json({ error: "File not found or already deleted" });
  }
});

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
