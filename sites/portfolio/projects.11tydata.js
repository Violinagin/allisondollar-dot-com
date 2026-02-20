// projects/11tydata.js
module.exports = {
  eleventyComputed: {
    permalink: (data) => {
      if (data.project) {
        return `/projects/${data.project.slug}/`;
      }
      return false;
    },
    layout: () => 'project.njk',
    title: (data) => data.project?.title,
    embed_url: (data) => data.project?.embed_url,
    client: (data) => data.project?.client,
    year: (data) => data.project?.year,
    type: (data) => data.project?.type,
    role: (data) => data.project?.role,
    description: (data) => data.project?.description,
    orientation: (data) => data.project?.orientation
  }
};