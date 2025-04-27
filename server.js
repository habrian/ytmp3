const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

const downloadsDir = path.join(__dirname, 'downloads');

app.use(cors());
app.use(bodyParser.json());
app.use('/downloads', express.static(downloadsDir));

// 確保下載資料夾存在
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// 定時清除舊檔案（每 1 小時清一次）
setInterval(() => {
  fs.readdir(downloadsDir, (err, files) => {
    if (err) return;
    files.forEach(file => {
      const filePath = path.join(downloadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        const now = Date.now();
        if (now - stats.mtimeMs > 3600 * 1000) { // 超過 1 小時刪除
          fs.unlink(filePath, () => {});
        }
      });
    });
  });
}, 3600 * 1000);

app.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).send('No URL provided.');

  try {
    // 取得影片標題
    const title = await new Promise((resolve, reject) => {
      exec(`yt-dlp --get-title "${url}"`, { encoding: 'utf8' }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.trim());
      });
    });

    const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const filename = `${Date.now()}_${safeTitle}.mp3`;
    const outputPath = path.join(downloadsDir, filename);

    // 下載 mp3
    exec(`yt-dlp -f bestaudio --extract-audio --audio-format mp3 -o "${outputPath}" "${url}"`, { encoding: 'utf8' }, (err) => {
      if (err) {
        console.error('Download error:', err);
        return res.status(500).send('Download failed.');
      }
      const fileUrl = `${req.protocol}://${req.get('host')}/downloads/${filename}`;
      res.json({ fileUrl, title });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Server error.');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
