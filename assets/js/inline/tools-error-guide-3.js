document.addEventListener('DOMContentLoaded', function(){
  if(window.EmberGuide) EmberGuide.init({ id: 'error-guide', steps: [
    { target: '#searchInput', fallback: ['.search-wrap'], title: 'Search', text: 'Type an error word like undefined or null to find the fix.' },
    { target: '.error-card', fallback: ['.guide-container'], title: 'Fixes', text: 'Plain-language fixes with example code. Use Copy fix, or tap any code snippet to copy it.' }
  ] });
});
