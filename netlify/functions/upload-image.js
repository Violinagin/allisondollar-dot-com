const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');
const crypto = require('crypto');
const sharp = require('sharp');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const auth = event.headers.authorization || '';
  if (auth !== `Bearer ${process.env.JOURNAL_SECRET}`) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const busboy = Busboy({ headers: event.headers });

    return new Promise((resolve) => {
      const fileBuffers = [];
      let originalName = 'image';

      busboy.on('file', (fieldname, file, info) => {
        originalName = info.filename || 'image';
        file.on('data', (data) => fileBuffers.push(data));
      });

      busboy.on('finish', async () => {
        try {
          const rawBuffer = Buffer.concat(fileBuffers);

          // Resize to max 1200px wide, convert to JPEG
          const resizedBuffer = await sharp(rawBuffer)
            .resize(1200, null, { withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

          const baseName = originalName.replace(/\.[^.]+$/, '');
          const uniqueId = crypto.randomUUID();
          const fileName = `${uniqueId}-${baseName}.jpg`;

          const { error } = await supabase.storage
            .from('journal-images')
            .upload(fileName, resizedBuffer, {
              contentType: 'image/jpeg',
              cacheControl: '3600'
            });

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('journal-images')
            .getPublicUrl(fileName);

          resolve({
            statusCode: 200,
            body: JSON.stringify({ url: publicUrl })
          });
        } catch (error) {
          resolve({
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
          });
        }
      });

      const buffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
      busboy.end(buffer);
    });
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
