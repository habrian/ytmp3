# 使用官方 Node.js 20 LTS 版本
FROM node:20

# 安裝 Python3, pip, ffmpeg, yt-dlp
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install yt-dlp

# 設定工作目錄
WORKDIR /app

# 複製 package.json 並安裝 npm 套件
COPY package*.json ./
RUN npm install

# 複製其他程式碼
COPY . .

# 對外開放 port 3000
EXPOSE 3000

# 啟動 server
CMD ["node", "server.js"]
