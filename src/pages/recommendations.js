/**
 * GovSpirit Recommendations.
 */
(function initRecommendationsPage(GovSpirit) {
  'use strict';

  const { Html, Icons, Store, Components, Exporters } = GovSpirit.require(
    'Html',
    'Icons',
    'Store',
    'Components',
    'Exporters'
  );

  const { html, styleAttr, inlineMarkdown, actionList } = Html;
  const { pageHeader, emptyState } = Components;

  const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  function summaryBar(counts) {
    const rows = [
      { key: 'CRITICAL', label: 'Critical', cls: 'rec-critical' },
      { key: 'HIGH', label: 'High', cls: 'rec-high' },
      { key: 'MEDIUM', label: 'Medium', cls: 'rec-medium' },
      { key: 'LOW', label: 'Low', cls: 'rec-low' },
    ];

    return html`
      <div class="priority-summary">
        ${rows.map(
          (row) => html`
            <div class="rec-summary-item ${row.cls}">
              <span class="priority-count">${counts[row.key] || 0}</span>
              <span>${row.label}</span>
            </div>
          `
        )}
      </div>
    `;
  }

  function card(rec) {
    return html`
      <article class="recommendation" ${styleAttr({ '--priority-colour': rec.priorityColor })}>
        <div class="recommendation-meta">
          <span
            class="priority-badge"
            ${styleAttr({
              background: `${rec.priorityColor}22`,
              color: rec.priorityColor,
            })}
          >
            ${Icons.render(rec.priorityIcon, { size: 13 })} ${rec.priorityLabel}
          </span>
          <span class="category-badge">${rec.category}</span>
        </div>

        <h2 class="recommendation-title">${rec.title}</h2>

        ${
          rec.metrics?.length
            ? html`<dl class="recommendation-metrics">
                ${rec.metrics.map(
                  (metric) => html`
                    <div class="recommendation-metric">
                      ${Icons.render(metric.icon, { size: 16 })}
                      <div>
                        <dd>${metric.value}</dd>
                        <dt>${metric.label}</dt>
                      </div>
                    </div>
                  `
                )}
              </dl>`
            : ''
        }

        <div class="recommendation-block">
          <h3>Situation</h3>
          <div class="recommendation-text">${inlineMarkdown(rec.description)}</div>
        </div>

        <div class="recommendation-block">
          <h3>Expected effect</h3>
          <div class="recommendation-text">${inlineMarkdown(rec.impact)}</div>
        </div>

        <div class="recommendation-block recommendation-action">
          <h3>Recommended action</h3>
          <div class="recommendation-text">${actionList(rec.action)}</div>
        </div>

        <footer class="recommendation-footer">
          <span>${rec.id}</span>
          <span>${rec.type}</span>
        </footer>
      </article>
    `;
  }

  function render() {
    const recommendations = Store.getState().recommendations;

    const counts = PRIORITY_ORDER.reduce((acc, key) => {
      acc[key] = recommendations.filter((r) => r.priority === key).length;
      return acc;
    }, {});

    return html`
      <div class="page-content">
        ${pageHeader({
          title: 'Recommendations',
          subtitle:
            'Deterministic, rule-based findings from the loaded data. Every threshold is documented in the source.',
          actions: recommendations.length
            ? html`<button type="button" class="btn btn-secondary btn-sm" id="btn-export-recs">
                Export
              </button>`
            : '',
        })}
        ${summaryBar(counts)}
        ${
          recommendations.length
            ? html`<div class="recommendation-list">${recommendations.map(card)}</div>`
            : emptyState({
                title: 'Nothing to flag',
                body: 'No rule thresholds were crossed by this dataset. That is a good result.',
                icon: 'checkCircle',
              })
        }
      </div>
    `;
  }

  function mount() {
    document.getElementById('btn-export-recs')?.addEventListener('click', () => {
      const rows = Store.getState().recommendations.map((rec) => ({
        id: rec.id,
        priority: rec.priorityLabel,
        category: rec.category,
        title: rec.title,
        situation: rec.description.replace(/\*\*/g, ''),
        expected_effect: rec.impact.replace(/\*\*/g, ''),
        recommended_action: rec.action.replace(/\*\*/g, '').replace(/\n/g, ' | '),
      }));
      Exporters.downloadCSV(rows, 'recommendations');
    });
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.recommendations = { title: 'Recommendations', render, mount };
})(window.GovSpirit);
