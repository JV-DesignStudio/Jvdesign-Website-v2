document.addEventListener("DOMContentLoaded", function(){
  if(window.EmberGuide) EmberGuide.init({ id: "character-designer", steps: [{"target":"#preview","title":"Character","text":"Pick a template then randomise parts."},{"target":"button[onclick*=\"export\"]","title":"Export","text":"Stamp to Pixel Studio or export PNG."}] });
});
