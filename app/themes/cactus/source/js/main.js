/**
 * Sets up Justified Gallery.
 */
if (!!$.prototype.justifiedGallery) {
  var options = {
    rowHeight: 140,
    margins: 4,
    lastRow: "justify"
  };
  $(".article-gallery").justifiedGallery(options);
}

$(document).ready(function() {
  /**
   * Sidebar collapse/expand for post pages.
   */
  var layout = document.querySelector('.layout');
  var divider = document.getElementById('divider');
  var expandTab = document.getElementById('expand-tab');

  if (divider && layout) {
    divider.addEventListener('click', function() {
      layout.classList.add('collapsed');
    });
  }

  if (expandTab && layout) {
    expandTab.addEventListener('click', function() {
      layout.classList.remove('collapsed');
    });
  }
});
