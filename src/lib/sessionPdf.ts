import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Session } from '../types/session';
import { Drill, PdfSettings, defaultPdfSettings } from '../types/drill';

function formatTime(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}:${mins.toString().padStart(2, '0')}`;
}

function formatBulletPoints(text: string): string[] {
  return text
    .split(/\n|(?:\d+\.\s)/)
    .map(line => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

// Minimalistic SVG icons (inline, no emoji)
const icons = {
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  target: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  timer: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 3px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  note: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  checkbox: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`,
};

function buildSessionHtml(session: Session, drillDetails?: Record<string, Drill>, pdfSettings?: PdfSettings): string {
  const settings = pdfSettings || defaultPdfSettings;
  const totalDuration = session.activities.reduce((s, a) => s + a.duration_minutes, 0);

  const dateStr = session.session_date
    ? new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  let html = `
    <div style="font-family: -apple-system, 'Helvetica Neue', Helvetica, sans-serif; max-width: 780px; margin: 0 auto; padding: 20px 16px; color: #1a1a1a;">
      <!-- Header -->
      <div style="border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 16px;">
        <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #111;">${session.title || 'Training Session'}</h1>
        <div style="display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: #555; align-items: center;">
          ${dateStr ? `<span>${icons.calendar} ${dateStr}</span>` : ''}
          ${session.session_time ? `<span>${icons.clock} ${session.session_time}</span>` : ''}
          ${session.team_name ? `<span>${icons.users} ${session.team_name}</span>` : ''}
          <span>${icons.timer} ${totalDuration} min total</span>
        </div>
      </div>
  `;

  if (session.session_goals) {
    html += `
      <div style="background: #f0fdf4; border-left: 3px solid #16a34a; padding: 8px 12px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
        <div style="font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">${icons.target} Session Goals</div>
        <p style="margin: 0; font-size: 12px; color: #333; line-height: 1.5;">${session.session_goals}</p>
      </div>
    `;
  }

  // Activities
  html += `<div style="font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb;">Activities</div>`;

  let currentTime = 0;
  session.activities.forEach((activity) => {
    const title = activity.title || activity.drill_name || 'Activity';
    const description = activity.description || '';
    const drillData = activity.library_drill_id && drillDetails ? drillDetails[activity.library_drill_id] : null;
    const instructions = drillData?.instructions || activity.drill_instructions || '';
    const setup = drillData?.setup || activity.drill_setup || '';

    const showDiagram = settings.includeDiagram && activity.drill_svg_url;
    const showSetup = settings.includeSetup && setup;
    const showInstructions = settings.includeInstructions && instructions;
    const hasTextContent = showSetup || showInstructions || description;

    html += `
      <div style="margin-bottom: 12px; page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background: #f8fafc; padding: 6px 12px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 700; font-size: 12px; color: #111;">
            <span style="color: #16a34a; font-family: monospace; margin-right: 6px;">${formatTime(currentTime)}</span>
            ${title.toUpperCase()}
          </div>
          <div style="font-size: 11px; color: #666; font-weight: 600;">${icons.timer} ${activity.duration_minutes} min</div>
        </div>
        <div style="padding: 10px 12px;">
    `;

    if (showDiagram && hasTextContent) {
      // Diagram + text side by side
      html += `<div style="display: flex; gap: 10px; align-items: flex-start;">`;
      html += `
        <div style="flex-shrink: 0; border-radius: 6px; overflow: hidden; width: 220px;">
          <img src="${activity.drill_svg_url}" style="width: 100%; height: auto; display: block;">
        </div>
      `;
      html += `<div style="flex: 1; min-width: 0;">`;
      if (description) {
        html += `<p style="color: #444; font-size: 11px; line-height: 1.5; margin: 0 0 6px 0;">${description}</p>`;
      }
      if (showSetup) {
        const setupPoints = formatBulletPoints(setup);
        if (setupPoints.length > 0) {
          html += `
            <div style="margin-bottom: 6px;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Setup</div>
              <div style="padding-left: 2px;">
                ${setupPoints.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
      }
      if (showInstructions) {
        const points = formatBulletPoints(instructions);
        if (points.length > 0) {
          html += `
            <div style="margin-bottom: 6px;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Instructions</div>
              <div style="padding-left: 2px;">
                ${points.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
      }
      html += `</div></div>`;
    } else if (showDiagram && !hasTextContent) {
      // Diagram only
      html += `
        <div style="margin-bottom: 8px; border-radius: 6px; overflow: hidden; max-width: 280px;">
          <img src="${activity.drill_svg_url}" style="width: 100%; height: auto; display: block;">
        </div>
      `;
    } else if (!showDiagram && hasTextContent) {
      // No diagram — put setup and instructions side by side when both present
      if (description) {
        html += `<p style="color: #444; font-size: 11px; line-height: 1.5; margin: 0 0 6px 0;">${description}</p>`;
      }
      if (showSetup && showInstructions) {
        const setupPoints = formatBulletPoints(setup);
        const instrPoints = formatBulletPoints(instructions);
        html += `<div style="display: flex; gap: 12px; align-items: flex-start;">`;
        if (setupPoints.length > 0) {
          html += `
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Setup</div>
              <div style="padding-left: 2px;">
                ${setupPoints.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
        if (instrPoints.length > 0) {
          html += `
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Instructions</div>
              <div style="padding-left: 2px;">
                ${instrPoints.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
        html += `</div>`;
      } else if (showSetup) {
        const setupPoints = formatBulletPoints(setup);
        if (setupPoints.length > 0) {
          html += `
            <div style="margin-bottom: 6px;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Setup</div>
              <div style="padding-left: 2px;">
                ${setupPoints.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
      } else if (showInstructions) {
        const points = formatBulletPoints(instructions);
        if (points.length > 0) {
          html += `
            <div style="margin-bottom: 6px;">
              <div style="font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #16a34a; margin-bottom: 3px;">Instructions</div>
              <div style="padding-left: 2px;">
                ${points.map(p => `<div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 1px;">▸ ${p}</div>`).join('')}
              </div>
            </div>
          `;
        }
      }
    }

    if (activity.activity_notes) {
      html += `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 5px 10px; border-radius: 6px; margin-top: 6px;">
          <span style="font-size: 10px; color: #166534;">${icons.note} ${activity.activity_notes}</span>
        </div>
      `;
    }

    html += '</div></div>';
    currentTime += activity.duration_minutes;
  });

  // Equipment
  if (session.equipment.length > 0) {
    html += `
      <div style="margin-top: 16px; page-break-inside: avoid;">
        <div style="font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb;">Equipment Checklist</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${session.equipment.map(e => `<span style="display: inline-flex; align-items: center; gap: 5px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 16px; padding: 4px 12px; font-size: 11px;">${icons.checkbox} ${e.name}${e.quantity ? ` (×${e.quantity})` : ''}</span>`).join('')}
        </div>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

/**
 * Generate a PDF from a session and return the file URI.
 */
export async function exportSessionToPDF(
  session: Session,
  drillDetails?: Record<string, Drill>,
  pdfSettings?: PdfSettings,
): Promise<string> {
  const html = buildSessionHtml(session, drillDetails, pdfSettings);

  const fullHtml = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          @media print {
            body { margin: 0; }
            @page { margin: 12mm; }
          }
        </style>
      </head>
      <body style="margin: 0; background: white;">
        ${html}
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({
    html: fullHtml,
    base64: false,
  });

  return uri;
}

/**
 * Generate PDF and immediately open native share sheet.
 */
export async function exportAndSharePDF(
  session: Session,
  drillDetails?: Record<string, Drill>,
  pdfSettings?: PdfSettings,
): Promise<void> {
  const uri = await exportSessionToPDF(session, drillDetails, pdfSettings);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `${session.title || 'Session'} PDF`,
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Generate PDF and return the URI for use with email/SMS composing.
 */
export async function generatePDFUri(
  session: Session,
  drillDetails?: Record<string, Drill>,
  pdfSettings?: PdfSettings,
): Promise<string> {
  return exportSessionToPDF(session, drillDetails, pdfSettings);
}
