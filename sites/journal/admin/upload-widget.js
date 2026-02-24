// Custom image widget that uses your Netlify Function
const CustomImageWidget = createClass({
  handleChange: function(e) {
  const file = e.target.files[0];
  const formData = new FormData();
  formData.append('file', file);
  
  this.props.onChange('_loading');
  
  fetch('/.netlify/functions/upload-image', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.url) {
      // Create a media file object that Decap expects
      const mediaFile = {
        path: data.url,           // The URL
        url: data.url,            // Also provide as url
        name: file.name,          // Original filename
        size: file.size,          // File size
        // Any other fields Decap might need
      };
      this.props.onChange(mediaFile);
    } else {
      alert('Upload failed: ' + (data.error || 'Unknown error'));
      this.props.onChange('');
    }
  })
  .catch(err => {
    alert('Upload failed: ' + err.message);
    this.props.onChange('');
  });
},

render: function() {
  const { value } = this.props;
  
  // Handle both string URLs and media objects
  const imageUrl = value && typeof value === 'object' ? value.url : value;
  
  return h('div', { className: 'custom-image-widget' }, [
    imageUrl && imageUrl !== '_loading' && h('div', { className: 'image-preview' }, [
      h('img', { src: imageUrl, style: { maxWidth: '100%', maxHeight: '200px' } })
    ]),
    value === '_loading' && h('div', { className: 'loading' }, 'Uploading...'),
    h('input', {
      type: 'file',
      onChange: this.handleChange,
      accept: 'image/*',
      style: { marginTop: '10px' }
    }),
    imageUrl && h('button', {
      onClick: () => this.props.onChange(''),
      style: { marginLeft: '10px' }
    }, 'Remove')
  ]);
}
});

// Register the widget
CMS.registerWidget('customImage', CustomImageWidget);