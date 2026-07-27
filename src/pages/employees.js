/**
 * GovSpirit Workforce productivity.
 *
 * Renders only what the uploaded employee file actually contains. With no
 * workforce data the page says so plainly rather than charting placeholders.
 */
(function initEmployeesPage(GovSpirit) {
  'use strict';

  const { Html, Format, Collections, Store, Components, Charts, Exporters } = GovSpirit.require(
    'Html',
    'Format',
    'Collections',
    'Store',
    'Components',
    'Charts',
    'Exporters'
  );

  const { html } = Html;
  const { metricCard, chartPanel, panel, pageHeader, dataTable, emptyState } = Components;

  const firstName = (value) =>
    String(value ?? '')
      .trim()
      .split(/\s+/)[0] || 'N/A';

  function render() {
    const kpis = Store.kpis();
    const employees = Store.rawData().employees || [];

    if (!employees.length) {
      return html`
        <div class="page-content">
          ${pageHeader({
            title: 'Workforce productivity',
            subtitle: 'Pick rates, accuracy and shift coverage',
          })}
          ${emptyState({
            title: 'No workforce data loaded',
            body:
              'Upload an employee or roster export containing names, roles, shifts and pick rates ' +
              'to populate this page. The demo dataset includes one.',
            icon: 'users',
          })}
        </div>
      `;
    }

    const byShift = Collections.countBy(employees, 'shift');
    const shifts = Object.keys(byShift).length;

    return html`
      <div class="page-content">
        ${pageHeader({
          title: 'Workforce productivity',
          subtitle: 'Pick rates, accuracy and shift coverage',
          actions: html`<button
            type="button"
            class="btn btn-secondary btn-sm"
            id="btn-export-staff"
          >
            Export
          </button>`,
        })}

        <div class="metric-grid">
          ${metricCard({
            id: 'emp-headcount',
            title: 'Records on file',
            value: Format.number(employees.length),
            subtitle: `${shifts} shift pattern${shifts === 1 ? '' : 's'}`,
            icon: 'users',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'emp-picks',
            title: 'Average picks per hour',
            value: kpis.avgPicksPerHour === null ? 'N/A' : Format.number(kpis.avgPicksPerHour, 1),
            subtitle: 'Picking and packing roles only',
            icon: 'database',
            tone: 'accent',
          })}
          ${metricCard({
            id: 'emp-accuracy',
            title: 'Average pick accuracy',
            value: Format.percent(kpis.avgPickAccuracy),
            subtitle: 'Across all recorded staff',
            icon: 'target',
            tone: kpis.avgPickAccuracy >= 98 ? 'positive' : 'caution',
          })}
          ${metricCard({
            id: 'emp-orders',
            title: 'Consignments handled',
            value: Format.number(Collections.sumBy(employees, 'orders_completed')),
            subtitle: 'Attributed to a named member of staff',
            icon: 'package',
            tone: 'accent',
          })}
        </div>

        <div class="panel-grid-2">
          ${chartPanel({
            id: 'chart-emp-picks',
            title: 'Picks per hour',
            subtitle: 'Picking and packing roles',
            summary: 'Bar chart of hourly pick rate per member of staff.',
          })}
          ${chartPanel({
            id: 'chart-emp-accuracy',
            title: 'Pick accuracy',
            subtitle: 'Percentage of picks without an error',
            summary: 'Bar chart of pick accuracy per member of staff.',
          })}
        </div>

        ${panel({
          title: 'Staff detail',
          body: dataTable({
            rows: employees,
            caption: 'Recorded performance for each member of warehouse staff',
            columns: [
              { key: 'employee_name', label: 'Name' },
              { key: 'role', label: 'Role', format: (v) => Components.status(v || 'N/A', 'info') },
              { key: 'shift', label: 'Shift' },
              {
                key: 'picks_per_hour',
                label: 'Picks/hr',
                numeric: true,
                format: (v) => (Format.isNumeric(v) && Number(v) > 0 ? Format.number(v, 1) : 'N/A'),
              },
              {
                key: 'accuracy_rate',
                label: 'Accuracy',
                numeric: true,
                format: (v) => Format.percent(v),
              },
              {
                key: 'orders_completed',
                label: 'Consignments',
                numeric: true,
                format: (v) => Format.number(v),
              },
              {
                key: 'performance_score',
                label: 'Score',
                numeric: true,
                format: (v) => {
                  const score = Format.toNumber(v, 0);
                  const tone = score >= 90 ? 'success' : score >= 75 ? 'warning' : 'danger';
                  return Components.status(Math.round(score), tone);
                },
              },
            ],
          }),
        })}
      </div>
    `;
  }

  function mount() {
    const employees = Store.rawData().employees || [];
    const pickers = employees.filter((e) => Format.toNumber(e.picks_per_hour, 0) > 0);

    if (pickers.length) {
      Charts.create(
        'chart-emp-picks',
        {
          type: 'bar',
          data: {
            labels: pickers.map((e) => firstName(e.employee_name)),
            datasets: [
              {
                label: 'Picks per hour',
                data: pickers.map((e) => Format.toNumber(e.picks_per_hour, 0)),
                backgroundColor: pickers.map((_, i) => Charts.alpha(Charts.color(i), 0.85)),
                borderRadius: 5,
              },
            ],
          },
        },
        { label: 'Picks per hour by member of staff' }
      );
    }

    const withAccuracy = employees.filter((e) => Format.isNumeric(e.accuracy_rate));
    if (withAccuracy.length) {
      // Accuracy clusters in the high nineties, so a 0–100 axis would flatten
      // every bar. The axis starts just below the lowest observed value.
      const values = withAccuracy.map((e) => Format.toNumber(e.accuracy_rate, 0));
      const floor = Math.max(0, Math.floor(Math.min(...values) - 2));

      Charts.create(
        'chart-emp-accuracy',
        {
          type: 'bar',
          data: {
            labels: withAccuracy.map((e) => firstName(e.employee_name)),
            datasets: [
              {
                label: 'Accuracy',
                data: values,
                backgroundColor: Charts.alpha('#10b981', 0.85),
                borderRadius: 5,
              },
            ],
          },
          options: {
            scales: { y: { min: floor, max: 100, ticks: { callback: (v) => `${v}%` } } },
          },
        },
        { label: 'Pick accuracy by member of staff' }
      );
    }

    document.getElementById('btn-export-staff')?.addEventListener('click', () => {
      Exporters.downloadCSV(employees, 'workforce');
    });
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.employees = { title: 'Workforce', render, mount };
})(window.GovSpirit);
