const catalogue = window.COURSE_CATALOGUE;
const topicInfo = window.TOPICS;
const prerequisites = window.PREREQUISITES;
const searchForm = document.querySelector('#search-form');
const searchInput = document.querySelector('#search-input');
const results = document.querySelector('#results');
const outlines = 'https://psychology.uwo.ca/undergraduate/course_information/undergradcourseoutlines.html';

function cleanCourse(value) {
  return String(value).toUpperCase().replace(/PSYCH(?:OLOGY)?/g, '').replace(/[^0-9]/g, '').slice(0, 4);
}

function recommendations(source) {
  const ranked = catalogue.filter(c => c.n !== source.n).map(course => {
    const shared = course.topics.filter(t => source.topics.includes(t));
    const score = shared.length / Math.sqrt(course.topics.length * source.topics.length);
    return {...course, shared, score};
  }).filter(c => c.shared.length).sort((a,b) => b.score - a.score || a.n.localeCompare(b.n));

  const groups = source.topics.map(topic => ({
    topic,
    courses: ranked.filter(c => c.shared.includes(topic)).slice(0, 3)
  })).filter(g => g.courses.length);

  const used = new Set();
  groups.forEach(g => { g.courses = g.courses.filter(c => !used.has(c.n) && used.add(c.n)); });
  return groups.filter(g => g.courses.length).slice(0, 6);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[character]));
}

function stemToken(value) {
  let word = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const families = {
    cognition:'cognit', cognitive:'cognit',
    development:'develop', developmental:'develop',
    evolution:'evolut', evolutionary:'evolut',
    biology:'biolog', biological:'biolog',
    psychology:'psycholog', psychological:'psycholog',
    perception:'percept', perceptual:'percept',
    education:'educat', educational:'educat',
    organization:'organiz', organizational:'organiz',
    statistics:'statist', statistical:'statist',
    language:'language', linguistic:'language',
    children:'child', people:'person'
  };
  if (families[word]) return families[word];
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0,-3) + 'y';
  if (word.length > 5 && /(sses|ches|shes|xes|zes)$/.test(word)) return word.slice(0,-2);
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0,-3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0,-2);
  if (word.length > 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0,-1);
  return word;
}

function textMatches(text, term) {
  const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedTerm = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalizedText.includes(normalizedTerm)) return true;
  const termRoot = stemToken(normalizedTerm);
  return normalizedText.split(/[^a-z0-9]+/).some(token => stemToken(token) === termRoot);
}

function card(course, showTopics = false) {
  return `<article class="card">
    <span class="course-code">Psychology ${course.n}${course.s}</span>
    <h4>${course.t}</h4><p>${course.d}</p>
    <p class="instructor"><span aria-hidden="true">👤</span> ${course.p}</p>
    ${showTopics ? `<div class="topic-chips">${course.topics.slice(0,4).map(topic => `<span>${topicInfo[topic].label}</span>`).join('')}</div>` : ''}
    <details class="prerequisites"><summary>Prerequisites</summary><p>${prerequisites[course.n] || 'See the current Academic Calendar.'}</p></details>
    <a href="${outlines}" target="_blank" rel="noopener" aria-label="View official listing for Psychology ${course.n}, ${course.t}"></a>
  </article>`;
}

function showCourse(number) {
  const source = catalogue.find(c => c.n === cleanCourse(number));
  results.hidden = false;
  if (!source) {
    results.innerHTML = `<div class="empty"><div class="big-icon">🔎</div><h2>We couldn’t find that course.</h2><p>Try a four-digit Psychology course number from the 2000 or 3000 level, such as 2135 or 2720.</p><button type="button" data-focus>Try another number</button></div>`;
    results.querySelector('[data-focus]').addEventListener('click', () => { searchInput.focus(); searchInput.select(); });
    results.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  const groups = recommendations(source);
  results.innerHTML = `<div class="result-head"><div><p>You enjoyed</p><h2>Psychology ${source.n}: ${source.t}</h2></div><button class="reset" type="button">New search</button></div>
    ${groups.map(({topic,courses}) => `<section class="topic-group"><div class="topic-title"><span class="topic-icon" aria-hidden="true">${topicInfo[topic].icon}</span><div><h3>${topicInfo[topic].label}</h3><p>${topicInfo[topic].note}</p></div></div><div class="cards">${courses.map(card).join('')}</div></section>`).join('')}`;
  results.querySelector('.reset').addEventListener('click', () => { searchInput.value=''; searchInput.focus(); window.scrollTo({top:0,behavior:'smooth'}); });
  results.scrollIntoView({behavior:'smooth',block:'start'});
}

function searchCatalogue(value) {
  const query = value.trim().toLowerCase();
  results.hidden = false;
  if (!query) {
    results.innerHTML = `<div class="empty"><div class="big-icon">💡</div><h2>What interests you?</h2><p>Enter a topic such as memory, relationships, mental health, or statistics—or the first or last name of a professor.</p><button type="button" data-focus>Enter a search</button></div>`;
    results.querySelector('[data-focus]').addEventListener('click', () => searchInput.focus());
    results.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }

  const terms = query.split(/\s+/).filter(Boolean);
  const matches = catalogue.map(course => {
    const topicText = course.topics.flatMap(topic => [topic, topicInfo[topic].label, topicInfo[topic].note]).join(' ');
    const title = course.t.toLowerCase();
    const professor = course.p.toLowerCase();
    const description = course.d.toLowerCase();
    const haystack = `${course.n} ${title} ${professor} ${description} ${topicText.toLowerCase()}`;
    if (!terms.every(term => textMatches(haystack, term))) return null;
    let score = 0;
    terms.forEach(term => {
      if (textMatches(professor, term)) score += 8;
      if (textMatches(title, term)) score += 6;
      if (course.topics.some(topic => textMatches(`${topic} ${topicInfo[topic].label}`, term))) score += 5;
      if (textMatches(description, term)) score += 2;
    });
    return {...course, score};
  }).filter(Boolean).sort((a,b) => b.score - a.score || a.n.localeCompare(b.n));

  if (!matches.length) {
    results.innerHTML = `<div class="empty"><div class="big-icon">🔎</div><h2>No courses matched “${escapeHtml(value.trim())}.”</h2><p>Try a broader term, a related word, or part of a professor’s name.</p><button type="button" data-focus>Revise the search</button></div>`;
    results.querySelector('[data-focus]').addEventListener('click', () => { searchInput.focus(); searchInput.select(); });
    results.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }

  results.innerHTML = `<div class="result-head"><div><p>Catalogue search</p><h2>Courses matching “${escapeHtml(value.trim())}”</h2></div><button class="reset" type="button">New search</button></div>
    <p class="search-summary">${matches.length} ${matches.length === 1 ? 'course' : 'courses'} found in the 2026–27 catalogue.</p>
    <section class="topic-group"><div class="cards">${matches.map(course => card(course, true)).join('')}</div></section>`;
  results.querySelector('.reset').addEventListener('click', () => { searchInput.value=''; searchInput.focus(); window.scrollTo({top:0,behavior:'smooth'}); });
  results.scrollIntoView({behavior:'smooth',block:'start'});
}

function runSearch(value) {
  const looksLikeCourseNumber = /^(?:psych(?:ology)?\s*)?\d{4}[abfg]?$/i.test(value.trim());
  if (looksLikeCourseNumber) showCourse(value);
  else searchCatalogue(value);
}

searchForm.addEventListener('submit', event => { event.preventDefault(); runSearch(searchInput.value); });
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => { searchInput.value=button.dataset.query; runSearch(searchInput.value); }));
