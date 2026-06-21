const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  const auth = event.headers.authorization || '';
  if (auth !== `Bearer ${process.env.JOURNAL_SECRET}`) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const records = JSON.parse(event.body);

    if (!Array.isArray(records) || records.length === 0) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Expected a non-empty array of records' }) };
    }

    const { error } = await supabase
      .from('teaching_classes')
      .upsert(records, { onConflict: 'class_name,start_time' });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, count: records.length })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
