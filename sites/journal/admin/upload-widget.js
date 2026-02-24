// Custom image widget that uses your Netlify Function
const CustomImageWidget = createClass({
  handleClick: function(e) {
    // Stop Decap from seeing this click
    e.stopPropagation();
    e.preventDefault();
  },
  
  handleChange: function(e) {
    // Stop propagation again to be safe
    e.stopPropagation();
    e.preventDefault();
    
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    fetch('/.netlify/functions/upload-image', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      this.props.onChange(data.url);
    })
    .catch(err => {
      console.error(err);
      alert('Upload failed');
    });
  },
  
  render: function() {
    const { value } = this.props;
    
    return h('div', { 
      onClick: this.handleClick,
      style: { border: '1px solid #ccc', padding: '1rem' }
    }, [
      value && h('img', { src: value, style: { maxWidth: '200px' } }),
      h('input', {
        type: 'file',
        onChange: this.handleChange,
        onClick: this.handleClick, // Stop propagation on click too
        accept: 'image/*'
      })
    ]);
  }
});
// Register the widget
CMS.registerWidget('customImage', CustomImageWidget);