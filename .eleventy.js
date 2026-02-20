require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);

module.exports = function(eleventyConfig) {
  // Copy assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  
  // ===== FILTERS (shared) =====
  eleventyConfig.addFilter('currentYear', () => new Date().getFullYear());
  
  eleventyConfig.addFilter('youtubeThumbnail', (url) => {
    if (!url) return '';
    if (url.length === 11) return `https://img.youtube.com/vi/${url}/maxresdefault.jpg`;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    const id = (match && match[2].length === 11) ? match[2] : url;
    return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  });

  eleventyConfig.addFilter('youtubeEmbedUrl', (url) => {
    if (!url) return '';
    if (url.length === 11) return `https://www.youtube.com/embed/${url}`;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    const id = (match && match[2].length === 11) ? match[2] : url;
    return `https://www.youtube.com/embed/${id}`;
  });

  eleventyConfig.addFilter('readableDate', (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });
  });

  // ===== PORTFOLIO DATA =====
  eleventyConfig.addGlobalData('projects', async () => {
  console.log('Fetching projects...');
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('display_order', { ascending: true });
  
  if (error) {
    console.error('Supabase error:', error);
    return [];
  }
  
  // Force the promise to resolve before build continues
  return JSON.parse(JSON.stringify(data)) || [];
});

  eleventyConfig.addCollection('portfolio', async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('display_order', { ascending: true })
    return data || [];
  });

 // Journal collection
eleventyConfig.addCollection('journal', async () => {
  const { data } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('published', true)
    .order('date', { ascending: false });
  
  return data || [];
});

// Journal global data (for index page)

eleventyConfig.addGlobalData('journalEntries', async () => {
  console.log('🔍 Fetching journal entries...');
  
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('published', true)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Journal fetch error:', error);
    return [];  // Return empty array on error
  }
  
  // If data is null, return empty array
  console.log(`Found ${data?.length || 0} journal entries`);
  return data || [];  // This ensures we always return an array
});
// Test the journal query immediately
(async () => {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('count', { count: 'exact', head: true });
  
  if (error) {
    console.log('Journal table check: Failed -', error.message);
  } else {
    console.log('Journal table check: OK -', data?.length || 0, 'entries');
  }
})();
  // ===== MULTI-SITE CONFIGURATION =====
  // This tells Eleventy to look in the sites/ folder
  return {
    dir: {
      input: 'sites',
      output: 'dist',
      includes: '../src/_includes',
      layouts: '../src/_includes',
      data: '../src/_data'
    },
    templateFormats: ['njk', 'md', 'html'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
     pathPrefix: "/",
  };
};