const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
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
    
    const { data, error } = await supabase
      .from('journal_entries')
      .insert([{
        title: entry.title,
        slug: entry.slug,
        body: entry.body,
        cover_image: entry.cover_image,
        date: entry.date,
        tags: entry.tags,
        published: entry.published
      }]);
    
    if (error) throw error;
    
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