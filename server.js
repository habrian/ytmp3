const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ytdlp = require('yt-dlp-exec');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

const downloadsDir = path.join(__dirname, 'downloads');
const FILE_EXPIRE_HOURS = 6; // ⏰ 檔案保存時間（小時）

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// 字串安全化：把檔名中的奇怪字元去掉
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
}

// 自動清除過期檔案
function cleanOldFiles() {
  fs.readdir(downloadsDir, (err, files) => {
    if (err) {
      console.error('Failed to read downloads directory:', err);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(downloadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error('Failed to stat file:', err);
          return;
        }

        const now = Date.now();
        const modifiedTime = new Date(stats.mtime).getTime();
        const ageHours = (now - modifiedTime) / (1000 * 60 * 60);

        if (ageHours > FILE_EXPIRE_HOURS) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error('Failed to delete old file:', err);
            } else {
              console.log('Deleted old file:', file);
            }
          });
        }
      });
    });
  });
}

// 每 30 分鐘掃一次
setInterval(cleanOldFiles, 30 * 60 * 1000);

// POST /download
app.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'No URL provided.' });
  }

  try {
    // 先取得標題
    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
    });

    const title = info.title || 'downloaded_audio';
    const safeTitle = sanitizeFilename(title);
    const filename = `${safeTitle}_${Date.now()}.mp3`;
    const outputPath = path.join(downloadsDir, filename);

    // 下載 MP3
    await ytdlp(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      output: outputPath,
    });

    res.json({
      fileUrl: `https://${req.hostname}/downloads/${encodeURIComponent(filename)}`,
      title: title,
    });

  } catch (error) {
    console.error('Download or title fetch error:', error);
    res.status(500).json({ error: 'Failed to download or fetch video info.' });
  }
});

// 啟動 server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running at http://localhost:${port}`);
});
