import { filterEvidenceMap, renderMapField, renderMapDetail } from './evidence-map-render.mjs';

for (const root of document.querySelectorAll('[data-evidence-map]')) {
  const data = JSON.parse(root.querySelector('[data-map-data]').textContent);
  const field = root.querySelector('[data-map-field]');
  const detail = root.querySelector('[data-map-detail]');
  const filters = root.querySelector('[data-map-filters]');
  let visible = data;
  let selected = { type: 'claim', id: data.claims[0].id };
  filters.hidden = false;
  root.classList.add('map-enhanced');

  function enhanceTargets() {
    for (const target of field.querySelectorAll('a[data-map-select]')) {
      target.setAttribute('role', 'button');
      target.setAttribute('aria-controls', 'map-selected-record');
      target.setAttribute('aria-pressed', String(target.dataset.mapId === selected?.id));
    }
  }
  detail.id = 'map-selected-record';
  enhanceTargets();

  function update() {
    field.innerHTML = renderMapField(visible, selected || { id: '', type: 'claim' });
    detail.innerHTML = renderMapDetail(data, selected);
    root.querySelector('[data-map-count]').textContent = `${visible.papers.length} papers · ${visible.claims.length} claims · ${visible.sourceLinks.length + visible.relations.length} connections`;
    enhanceTargets();
  }
  filters.addEventListener('change', () => {
    visible = filterEvidenceMap(data, filters.querySelector('[name="study"]').value, filters.querySelector('[name="method"]').value);
    selected = visible.claims.length ? { type: 'claim', id: visible.claims[0].id } : null;
    update();
  });
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-map-select]');
    if (!target || !root.contains(target)) return;
    event.preventDefault();
    selected = { type: target.dataset.mapSelect, id: target.dataset.mapId };
    // Detail links can lead to claims outside a filter; reveal their context rather than keep an invisible selection.
    const selectedEdge = selected.type === 'edge' ? [...data.sourceLinks, ...data.relations].find(edge => edge.id === selected.id) : null;
    const visibleIds = new Set([...visible.claims, ...visible.papers].map(item => item.id));
    if ((selected.type === 'claim' && !visibleIds.has(selected.id)) || (selectedEdge && (!visibleIds.has(selectedEdge.from) || !visibleIds.has(selectedEdge.to)))) {
      filters.querySelector('[name="study"]').value = 'all';
      filters.querySelector('[name="method"]').value = 'all';
      visible = data;
    }
    const keyboard = event.detail === 0;
    update();
    if (keyboard) {
      const replacement = [...root.querySelectorAll('a[data-map-select], button[data-map-select]')].find(item => item.dataset.mapId === selected.id);
      if (replacement) replacement.focus();
      else { detail.tabIndex = -1; detail.focus(); }
    }
  });
  root.addEventListener('keydown', event => {
    if (event.key === ' ' && event.target.matches('a[data-map-select]')) {
      event.preventDefault();
      event.target.click();
    }
  });
}
