const { createClient } = require('@supabase/supabase-js');

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
    return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
  }

  try {
    const entry = JSON.parse(event.body);
    
    // Validate required fields
    if (!entry.title || !entry.slug || !entry.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }
    
    const fields = {
      title: entry.title,
      slug: entry.slug,
      body: entry.body,
      cover_image: entry.cover_image,
      tags: entry.tags,
      published: entry.published
    };

    let queryError;
    if (entry.id) {
      const { error } = await supabase
        .from('journal_entries')
        .update(fields)
        .eq('id', entry.id);
      queryError = error;
    } else {
      const { error } = await supabase
        .from('journal_entries')
        .insert([fields]);
      queryError = error;
    }

    if (queryError) throw queryError;
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};