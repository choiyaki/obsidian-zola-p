(function() {
  var suggestions = document.getElementById('suggestions');
  var userinput = document.getElementById('userinput');

  if (!userinput) return;

  document.addEventListener('keydown', inputFocus);

  function inputFocus(e) {
    if (e.keyCode === 191
        && document.activeElement.tagName !== "INPUT"
        && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      userinput.focus();
    }
    if (e.keyCode === 27 ) {
      userinput.blur();
      suggestions.classList.add('d-none');
    }
  }

  document.addEventListener('click', function(event) {
    var isClickInsideElement = suggestions.contains(event.target);
    if (!isClickInsideElement) {
      suggestions.classList.add('d-none');
    }
  });

  document.addEventListener('keydown',suggestionFocus);

  function suggestionFocus(e){
    const focusableSuggestions= suggestions.querySelectorAll('a');
    if (suggestions.classList.contains('d-none')
        || focusableSuggestions.length === 0) {
      return;
    }
    const focusable= [...focusableSuggestions];
    const index = focusable.indexOf(document.activeElement);

    let nextIndex = 0;

    if (e.keyCode === 38) {
      e.preventDefault();
      nextIndex= index > 0 ? index-1 : 0;
      focusableSuggestions[nextIndex].focus();
    }
    else if (e.keyCode === 40) {
      e.preventDefault();
      nextIndex= index+1 < focusable.length ? index+1 : index;
      focusableSuggestions[nextIndex].focus();
    }
  }

  userinput.addEventListener('input', show_results, true);
  suggestions.addEventListener('click', accept_suggestion, true);

  function show_results(){
    var value = this.value.trim().toLowerCase();
    
    if (value === "") {
        while(suggestions.lastChild){
            suggestions.removeChild(suggestions.lastChild);
        }
        suggestions.classList.add('d-none');
        return;
    }

    var results = [];
    if (typeof page_data !== 'undefined') {
        for (var i = 0; i < page_data.length; i++) {
            var item = page_data[i];
            var titleMatch = item.title.toLowerCase().indexOf(value) !== -1;
            var contentMatch = item.content && item.content.toLowerCase().indexOf(value) !== -1;
            
            if (titleMatch || contentMatch) {
                results.push({
                    title: item.title,
                    url: item.url,
                    content: item.content || ""
                });
            }
            if (results.length >= 15) break; 
        }
    }

    var entry, childs = listToArray(suggestions.childNodes);
    var len = results.length;
    suggestions.classList.remove('d-none');

    results.forEach(function(page, idx) {
      if (idx < childs.length) {
          entry = childs[idx];
      } else {
          entry = document.createElement('div');
          entry.innerHTML = '<a href><span></span><span></span></a>';
          suggestions.appendChild(entry);
      }

      var a = entry.querySelector('a'),
          t = entry.querySelector('span:first-child'),
          d = entry.querySelector('span:nth-child(2)');
      
      a.href = page.url;
      t.textContent = page.title;
      d.innerHTML = makeTeaser(page.content, value);
    });

    while(suggestions.childNodes.length > len){
        suggestions.removeChild(suggestions.lastChild);
    }
  }
  
  function listToArray(obj) {
      var arr = [];
      for(var i = 0, l = obj.length; i < l; i++) {
          arr.push(obj[i]);
      }
      return arr;
  }

  function accept_suggestion(){
      while(suggestions.lastChild){
          suggestions.removeChild(suggestions.lastChild);
      }
      suggestions.classList.add('d-none');
      return false;
  }

  function makeTeaser(body, term) {
      if (!body) return "";
      let clean = body.replace(/^[#>\-\*]+\s/gm, "")
                      .replace(/[*`_]/g, "")
                      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                      .replace(/\n+/g, " ");

      var bodyLower = clean.toLowerCase();
      var termIndex = bodyLower.indexOf(term);
      if (termIndex === -1) {
          return clean.substring(0, 100) + "...";
      }
      var start = Math.max(0, termIndex - 30);
      var end = Math.min(clean.length, termIndex + term.length + 30);
      var teaser = (start > 0 ? "..." : "") + 
                   clean.substring(start, termIndex) + 
                   "<b>" + clean.substring(termIndex, termIndex + term.length) + "</b>" + 
                   clean.substring(termIndex + term.length, end) + 
                   (end < clean.length ? "..." : "");
      return teaser;
  }

}());
