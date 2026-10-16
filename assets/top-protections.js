document.querySelectorAll('.best-sellers-section').forEach(section => {
  const tabs = [...section.querySelectorAll('.home-category-tab')];
  const panels = [...section.querySelectorAll('.home-category-panel')];

  const selectCategory = (tab, focus = false) => {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = panels.find(candidate => candidate.id === item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus();
  };

  const requestedCategory = section.dataset.defaultCategory;
  const initialTab = tabs.find(tab => tab.id === `tab-${requestedCategory}`)
    || tabs.find(tab => tab.getAttribute('aria-selected') === 'true')
    || tabs[0];

  if (initialTab) {
    selectCategory(initialTab);
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectCategory(tab));
      tab.addEventListener('keydown', event => {
        let nextIndex;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        selectCategory(tabs[nextIndex], true);
      });
    });
  }

});
