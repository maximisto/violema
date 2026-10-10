// ARIA tabs over plain anchor links: without JavaScript each link jumps to its panel.
// Automatic activation, roving tabindex, Left/Right/Home/End keys.
export function enhanceTabs(list, { onSelect, initial = 0 } = {}) {
  const tabs = [...list.querySelectorAll('a[href^="#"]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('href').slice(1)));
  if (!tabs.length || panels.some(panel => !panel)) return null;

  list.setAttribute('role', 'tablist');
  tabs.forEach((tab, i) => {
    if (!tab.id) tab.id = `tab-${panels[i].id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panels[i].id);
    panels[i].setAttribute('role', 'tabpanel');
    if (!panels[i].hasAttribute('aria-labelledby')) panels[i].setAttribute('aria-labelledby', tab.id);
  });

  function select(index, { focus = false, notify = true } = {}) {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    if (focus) tabs[index].focus();
    if (notify) onSelect?.(panels[index].id, index);
  }

  list.addEventListener('click', event => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    select(tabs.indexOf(tab));
  });
  list.addEventListener('keydown', event => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    if (event.key === ' ') { event.preventDefault(); select(current); return; }
    const target = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select((target + tabs.length) % tabs.length, { focus: true });
  });

  select(initial, { notify: false });
  return {
    select(panelId, options) {
      const index = panels.findIndex(panel => panel.id === panelId);
      if (index >= 0) select(index, options);
    },
  };
}
