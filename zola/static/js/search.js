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
    var raw = this.value.trim();

    if (raw === "") {
        while(suggestions.lastChild){
            suggestions.removeChild(suggestions.lastChild);
        }
        suggestions.classList.add('d-none');
        return;
    }

    var groups = parseQuery(raw);
    var scored = [];

    if (groups.length > 0 && typeof page_data !== 'undefined') {
        for (var i = 0; i < page_data.length; i++) {
            var item = page_data[i];
            var score = scorePage(item, groups);
            if (score >= 0) {
                scored.push({ item: item, score: score });
            }
        }
    }

    scored.sort(function(a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return (b.item.modified || 0) - (a.item.modified || 0);
    });

    var allTerms = [];
    groups.forEach(function(group) {
        group.forEach(function(term) { allTerms.push(term); });
    });

    var results = scored.slice(0, 15).map(function(s) {
        return { title: s.item.title, url: s.item.url, content: s.item.content || "" };
    });

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
      d.innerHTML = makeTeaser(page.content, allTerms);
    });

    while(suggestions.childNodes.length > len){
        suggestions.removeChild(suggestions.lastChild);
    }
  }

  /*
  Query syntax: space-separated terms are AND'ed together; a standalone
  "OR" token starts a new alternative group, e.g. "foo bar OR baz" means
  (foo AND bar) OR (baz). Returns an array of groups, each an array of
  lowercased AND-terms.
  */
  function parseQuery(raw) {
      var normalized = raw.replace(/　/g, ' ').trim();
      if (!normalized) return [];

      var groups = [];
      var current = [];
      normalized.split(/\s+/).forEach(function(tok) {
          if (tok.toUpperCase() === 'OR') {
              if (current.length) groups.push(current);
              current = [];
          } else {
              current.push(tok.toLowerCase());
          }
      });
      if (current.length) groups.push(current);

      return groups.filter(function(g) { return g.length > 0; });
  }

  /*
  A page matches if at least one OR-group has all of its AND-terms present
  (in title or content). Relevance score is the best-matching group's score:
  title hits are weighted heavily, content hits count per occurrence (capped
  per term so one very repeated term can't dominate). Returns -1 for no match.
  */
  function scorePage(item, groups) {
      var titleLower = item.title.toLowerCase();
      var contentLower = (item.content || '').toLowerCase();

      var matched = false;
      var bestScore = -1;

      groups.forEach(function(terms) {
          var allMatch = true;
          var groupScore = 0;

          terms.forEach(function(term) {
              var inTitle = titleLower.indexOf(term) !== -1;
              var contentCount = countOccurrences(contentLower, term);

              if (!inTitle && contentCount === 0) {
                  allMatch = false;
              }
              if (inTitle) groupScore += 10;
              groupScore += Math.min(contentCount, 20);
          });

          if (allMatch) {
              matched = true;
              if (groupScore > bestScore) bestScore = groupScore;
          }
      });

      return matched ? bestScore : -1;
  }

  function countOccurrences(haystack, needle) {
      if (!needle) return 0;
      var count = 0, pos = 0;
      while ((pos = haystack.indexOf(needle, pos)) !== -1) {
          count++;
          pos += needle.length;
      }
      return count;
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

  function makeTeaser(body, terms) {
      if (!body) return "";
      let clean = body.replace(/^[#>\-\*]+\s/gm, "")
                      .replace(/[*`_]/g, "")
                      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                      .replace(/\n+/g, " ");

      var bodyLower = clean.toLowerCase();

      var bestIndex = -1, bestTerm = "";
      (terms || []).forEach(function(term) {
          if (!term) return;
          var idx = bodyLower.indexOf(term);
          if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
              bestIndex = idx;
              bestTerm = term;
          }
      });

      if (bestIndex === -1) {
          return clean.substring(0, 100) + "...";
      }
      var start = Math.max(0, bestIndex - 30);
      var end = Math.min(clean.length, bestIndex + bestTerm.length + 30);
      var teaser = (start > 0 ? "..." : "") +
                   clean.substring(start, bestIndex) +
                   "<b>" + clean.substring(bestIndex, bestIndex + bestTerm.length) + "</b>" +
                   clean.substring(bestIndex + bestTerm.length, end) +
                   (end < clean.length ? "..." : "");
      return teaser;
  }

}());
