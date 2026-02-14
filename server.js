import express from 'express';
import cors from 'cors';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 3001;

// Endpoint to render video
app.post('/render-video', async (req, res) => {
  console.log('📹 Render request received');

  try {
    const { script, title } = req.body;

    if (!script || !script.scenes || script.scenes.length === 0) {
      return res.status(400).json({ error: 'Invalid script provided' });
    }

    console.log('📦 Bundling Remotion project...');

    // Bundle the Remotion project
    const bundleLocation = await bundle({
      entryPoint: path.join(__dirname, 'src', 'remotion', 'index.tsx'),
      webpackOverride: (config) => config,
    });

    console.log('✅ Bundle created at:', bundleLocation);

    // Get composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'VideoComposition',
      inputProps: { script },
    });

    console.log('🎬 Composition selected:', composition.id);
    console.log('⏱️  Duration:', composition.durationInFrames, 'frames');

    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'rendered-videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const safeTitle = (title || 'video').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const outputPath = path.join(outputDir, `${safeTitle}_${timestamp}.mp4`);

    console.log('🎥 Starting render to:', outputPath);

    // Render the video
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: { script },
      onProgress: ({ progress }) => {
        console.log(`Rendering: ${(progress * 100).toFixed(1)}%`);
      },
    });

    console.log('✅ Render complete!');

    // Send the file
    res.download(outputPath, `${safeTitle}.mp4`, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }

      // Clean up: delete the file after sending
      setTimeout(() => {
        try {
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
            console.log('🗑️  Temporary file deleted:', outputPath);
          }
        } catch (error) {
          console.error('Error deleting file:', error);
        }
      }, 5000);
    });

  } catch (error) {
    console.error('❌ Render error:', error);
    res.status(500).json({
      error: 'Failed to render video',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Render server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Render server running on http://localhost:${PORT}`);
  console.log(`📹 Ready to render videos!`);
});
