// sites/journal/entries.11tydata.js
module.exports = {
  eleventyComputed: {
    permalink: (data) => {
      if (data.entry) {
        return `/journal/${data.entry.slug}/`;
      }
      return false;
    },
    layout: () => 'journal.njk',
    title: (data) => data.entry?.title,
    date: (data) => data.entry?.date,
    tags: (data) => data.entry?.tags,
    body: (data) => data.entry?.body,
    cover_image: (data) => data.entry?.cover_image,
    
    previousEntry: (data) => {
      if (!data.collections?.journal || !data.entry) return null;
      const index = data.collections.journal.findIndex(e => e.slug === data.entry.slug);
      return index > 0 ? data.collections.journal[index - 1] : null;
    },
    nextEntry: (data) => {
      if (!data.collections?.journal || !data.entry) return null;
      const index = data.collections.journal.findIndex(e => e.slug === data.entry.slug);
      return index < data.collections.journal.length - 1 ? data.collections.journal[index + 1] : null;
    }
  }
};