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

    // Wipe and reload — simpler and more reliable than upsert for a full schedule sync
    const { error: deleteError } = await supabase
      .from('teaching_classes')
      .delete()
      .not('id', 'is', null);

    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
      .from('teaching_classes')
      .insert(records);

    if (insertError) throw insertError;

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
