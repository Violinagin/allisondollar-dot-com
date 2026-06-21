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
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const records = JSON.parse(event.body);

    if (!Array.isArray(records) || records.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Expected a non-empty array of records' }) };
    }

    const { error } = await supabase
      .from('teaching_classes')
      .upsert(records, { onConflict: 'class_name,start_time' });

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, count: records.length })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
