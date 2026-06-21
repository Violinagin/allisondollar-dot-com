require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);

module.exports = function(eleventyConfig) {
  // Copy assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Expose Supabase credentials to templates (used by client-side JS in njk files)
  eleventyConfig.addGlobalData('supabaseUrl', process.env.NEXT_PUBLIC_SUPABASE_URL);
  eleventyConfig.addGlobalData('supabaseKey', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY);

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

  eleventyConfig.addFilter('paragraphs', (str) => {
    if (!str) return '';
    return str.split('\n\n').map(p => `<p>${p}</p>`).join('');
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

    return JSON.parse(JSON.stringify(data)) || [];
  });

  eleventyConfig.addCollection('portfolio', async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('display_order', { ascending: true });
    return data || [];
  });

  // Journal entries fetched at build time for the home page preview (index.njk uses journalEntries.slice(0,3))
  eleventyConfig.addGlobalData('journalEntries', async () => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Journal fetch error:', error);
      return [];
    }

    return data || [];
  });

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