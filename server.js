const express    = require('express');
const cors       = require('cors');
const cp         = require('child_process');
const ffmpeg     = require('fluent-ffmpeg');
const ytDlpPath  = require('yt-dlp-static');

// Set up Express
const app = express();
app.use(cors());

// Root endpoint
app.get('/', (_, res) => {
  res.send('🚀 YouTube→MP3 siap! Gunakan /download?url=YOUTUBE_URL');
});

app.get('/download', (req, res) => {
  let url = req.query.url;
  if (!url) return res.status(400).send('❌ url tidak disertakan.');

  // fallback short-link youtu.be
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1];
    url = `https://www.youtube.com/watch?v=${id}`;
  }

  // Validasi URL minimal
  if (!/^https?:\/\/(www\.)?youtube\.com\/watch\?v=/.test(url)) {
    return res.status(400).send('❌ url invalid.');
  }

  // Headers untuk unduhan MP3
  res.set({
    'Content-Type':        'audio/mpeg',
    'Content-Disposition': 'attachment; filename="audio.mp3"'
  });

  // 1) Spawn yt-dlp → output ke stdout (audio terbaik, format m4a)
  const ytdlp = cp.spawn(ytDlpPath, [
    url,
    '-f', 'bestaudio',
    '--no-playlist',
    '--extract-audio',
    '--audio-format', 'm4a',
    '-o', '-'         // kirim ke stdout
  ]);

  // 2) Pipe stdout yt-dlp ke FFmpeg untuk convert m4a→mp3
  const ffmpegProc = ffmpeg(ytdlp.stdout)
    .format('mp3')
    .audioBitrate(128)
    .on('error', err => {
      console.error('FFmpeg error:', err.message);
      if (!res.headersSent) res.status(500).send('❌ Gagal convert audio.');
    })
    .pipe(res, { end: true });

  // 3) Tangani error yt-dlp
  ytdlp.on('error', err => {
    console.error('yt-dlp spawn error:', err);
    if (!res.headersSent) res.status(500).send('❌ Gagal mengunduh audio.');
  });
  ytdlp.stderr.on('data', chunk => {
    // yt-dlp logs ke stderr; bisa diabaikan atau dipantau
    // console.error(`yt-dlp stderr: ${chunk}`);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
