// Shrinks the site header (logo hides, only the account widget stays) once the page scrolls
// past a small threshold. Include on every page that uses the shared .topbar markup.
(function(){
  var header = document.querySelector('.topbar');
  if(!header) return;
  var THRESHOLD = 30;
  var ticking = false;
  function apply(){
    header.classList.toggle('shrink', window.scrollY > THRESHOLD);
    ticking = false;
  }
  window.addEventListener('scroll', function(){
    if(!ticking){ requestAnimationFrame(apply); ticking = true; }
  }, { passive: true });
  apply();
})();
