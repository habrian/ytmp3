const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

const downloadsDir = path.join(__dirname, 'downloads');

// 確保下載資料夾存在
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// 自動刪除過舊的檔案（設定 1小時刪除）
const clearOldFiles = () => {
  const files = fs.readdirSync(downloadsDir);
  const now = Date.now();
  const oneHour = 1000 * 60 * 60;

  files.forEach(file => {
    const filePath = path.join(downloadsDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > oneHour) {
      fs.unlinkSync(filePath);
      console.log(`刪除舊檔案: ${file}`);
    }
  });
};

// 每小時清一次
setInterval(clearOldFiles, 60 * 60 * 1000);

const ytDlpPath = path.join(__dirname, 'yt-dlp');

app.post('/download', async (req, res) => {
  const url = req.body.url;
  if (!url) {
    return res.status(400).send('No URL provided.');
  }

  const filename = `${Date.now()}.mp3`;
  const outputPath = path.join(downloadsDir, filename);

  try {
    // 取得影片標題
    const titleCmd = `${ytDlpPath} --no-warnings --encoding utf-8 --get-title "${url}"`;
    const title = await new Promise((resolve, reject) => {
      exec(titleCmd, (err, stdout, stderr) => {
        if (err) reject(stderr);
        else resolve(stdout.trim());
      });
    });

    // 開始下載
    const cmd = `${ytDlpPath} -f bestaudio --extract-audio --audio-format mp3 -o "${outputPath}" "${url}"`;
    exec(cmd, (error) => {
      if (error) {
        console.error(' Download error:', error);
        return res.status(500).send('Download failed.');
      }
      res.json({
        fileUrl: `https://${req.headers.host}/downloads/${filename}`,
        title: title,
      });
    });

  } catch (error) {
    console.error('Title fetch error:', error);
    res.status(500).send('Error fetching title');
  }
});

app.listen(port, () => {
  console.log(` Server running at http://localhost:${port}`);
});
