const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');
const crypto = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Parse the multipart form data
    const busboy = Busboy({ headers: event.headers });
    
    return new Promise((resolve, reject) => {
      const fileBuffers = [];
      let fileName = '';
      
      busboy.on('file', (fieldname, file, info) => {
        const uniqueId = crypto.randomUUID();
        fileName = `${uniqueId}-${info.filename}`;
        
        file.on('data', (data) => {
          fileBuffers.push(data);
        });
      });
      
      busboy.on('finish', async () => {
        try {
          const fileBuffer = Buffer.concat(fileBuffers);
          
          const { data, error } = await supabase.storage
            .from('journal-images')
            .upload(fileName, fileBuffer, {
              contentType: 'image/jpeg', // You might want to detect this
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
      
      // Pass the raw body to busboy
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