// Custom image widget that uses your Netlify Function
const CustomImageWidget = createClass({
  handleChange: function(e) {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    // Show loading state
    this.props.onChange('_loading');
    
    fetch('/.netlify/functions/upload-image', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.url) {
        this.props.onChange(data.url);
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
    
    return h('div', { className: 'custom-image-widget' }, [
      value && value !== '_loading' && h('div', { className: 'image-preview' }, [
        h('img', { src: value, style: { maxWidth: '100%', maxHeight: '200px' } })
      ]),
      value === '_loading' && h('div', { className: 'loading' }, 'Uploading...'),
      h('input', {
        type: 'file',
        onChange: this.handleChange,
        accept: 'image/*',
        style: { marginTop: '10px' }
      }),
      value && value !== '_loading' && h('button', {
        onClick: () => this.props.onChange(''),
        style: { marginLeft: '10px' }
      }, 'Remove')
    ]);
  }
});

// Register the widget
CMS.registerWidget('customImage', CustomImageWidget);