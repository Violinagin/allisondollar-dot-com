const SYNC_URL = 'https://allisondollar.com/.netlify/functions/sync-schedule';

const LOCATIONS = [
  { name: 'Boca Park',   slug: 'bocapark' },
  { name: 'Town Square', slug: 'townsquare' }
];

// Restore saved password on open
chrome.storage.local.get('syncPassword', ({ syncPassword }) => {
  if (syncPassword) document.getElementById('password').value = syncPassword;
});

document.getElementById('syncBtn').addEventListener('click', async () => {
  const btn      = document.getElementById('syncBtn');
  const status   = document.getElementById('status');
  const password = document.getElementById('password').value.trim();

  if (!password) {
    status.textContent = 'Enter your admin password first.';
    status.className   = 'error';
    return;
  }

  // Save password for next time
  chrome.storage.local.set({ syncPassword: password });

  btn.disabled       = true;
  status.textContent = 'Fetching schedule…';
  status.className   = '';

  try {
    // 1. Pull admin schedule
    const scheduleRes = await fetch('https://admin.pinotspalette.com/ArtistPortal/GetScheduleData', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    if (!scheduleRes.ok) throw new Error('Could not reach admin portal. Make sure you are logged in.');
    const { Data: rawClasses } = await scheduleRes.json();

    status.textContent = `Got ${rawClasses.length} classes. Fetching public event links (3 months)…`;

    // 2. Build name+date → public event URL maps per location
    const eventMaps = {};
    for (const loc of LOCATIONS) {
      eventMaps[loc.name] = await buildPublicEventMap(loc.slug);
    }

    // 3. Parse and enrich — only Regular classes are stored
    const discrepancies = [];
    const records = rawClasses
      .filter(c => c.ClassType === 'Regular')
      .map(c => {
        const paintingName = stripHtml(c.Painting);
        const { start, end } = parseClassTime(c.ClassTime);
        const locSlug    = LOCATIONS.find(l => l.name === c.Location)?.slug || '';
        const mapKey     = buildMapKey(paintingName, start);
        const eventEntry = eventMaps[c.Location]?.[mapKey];

        const showOnCalendar =
          (c.Role === 'Instructor') ||
          (c.Role === 'Assistant' && c.ReservationCount >= 20);

        if (!eventEntry && showOnCalendar) {
          const similar = Object.keys(eventMaps[c.Location] || {})
            .filter(k => k.startsWith(paintingName + '||'));
          discrepancies.push({
            name:       paintingName,
            date:       mapKey.split('||')[1],
            location:   c.Location,
            type:       similar.length ? 'mismatch' : 'missing',
            publicTime: similar.map(k => k.split('||')[1]).join(', ')
          });
        }

        return {
          class_name:         paintingName,
          start_time:         start.toISOString(),
          end_time:           end.toISOString(),
          location:           c.Location,
          location_slug:      locSlug,
          room:               c.Room || null,
          class_type:         c.ClassType,
          role:               c.Role,
          status:             c.Status,
          seats_taken:        c.ReservationCount,
          painting_image_url: extractHref(c.PaintingLink) || null,
          booking_url:        eventEntry
                                ? `https://www.pinotspalette.com/${locSlug}/event/${eventEntry.eventId}`
                                : null,
          show_on_calendar:   showOnCalendar,
          updated_at:         new Date().toISOString()
        };
      });

    // Reset discrepancy panel for this sync run
    const discDiv = document.getElementById('discrepancies');
    discDiv.style.display = 'none';
    discDiv.innerHTML = '';

    status.textContent = `Upserting ${records.length} records…`;

    // 4. Send to Netlify function (which uses service role key server-side)
    const syncRes = await fetch(SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${password}`
      },
      body: JSON.stringify(records)
    });

    if (!syncRes.ok) {
      const err = await syncRes.json().catch(() => ({ error: syncRes.statusText }));
      if (syncRes.status === 401) throw new Error('Wrong password.');
      throw new Error(err.error || `Server error ${syncRes.status}`);
    }

    const shown = records.filter(r => r.show_on_calendar).length;
    status.textContent = `✓ Synced ${records.length} classes (${shown} shown on calendar).`;
    status.className   = 'success';

    if (discrepancies.length) {
      discDiv.style.display = 'block';
      discDiv.innerHTML = `<div class="disc-header">⚠️ ${discrepancies.length} class${discrepancies.length === 1 ? '' : 'es'} without a booking link:</div>`
        + discrepancies.map(d => `
          <div class="disc-item">
            <span class="disc-tag ${d.type}">${d.type === 'mismatch' ? 'Time differs' : 'Not on public site'}</span><br>
            <strong>${d.name}</strong><br>
            ${d.date} · ${d.location}${d.type === 'mismatch' ? `<br>Public site has: ${d.publicTime}` : ''}
          </div>`).join('');
    }

  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.className   = 'error';
  } finally {
    btn.disabled = false;
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

function extractHref(html) {
  const m = html.match(/href='([^']+)'/);
  return m ? m[1] : null;
}

/**
 * Parse admin ClassTime like "Su. 06/21/26 11:00-1:00PM" into
 * start/end Date objects. Las Vegas is PDT (UTC-7) in summer.
 */
function parseClassTime(str) {
  const match = str.match(
    /\w+\.\s+(\d{2})\/(\d{2})\/(\d{2})\s+(\d+):(\d+)-(\d+):(\d+)(AM|PM)/i
  );
  if (!match) throw new Error(`Cannot parse time: ${str}`);

  const [, month, day, yr, startH, startM, endH, endM, ampm] = match;

  let startHour = parseInt(startH);
  let endHour   = parseInt(endH);
  const isPM    = ampm.toUpperCase() === 'PM';

  if (isPM) {
    endHour = endHour === 12 ? 12 : endHour + 12;
    const startAsPM = startHour === 12 ? 12 : startHour + 12;
    startHour = startAsPM <= endHour ? startAsPM : (startHour === 12 ? 0 : startHour);
  } else {
    if (endHour === 12) {
      // "10:00-12:00AM" means class ends at midnight — start must be evening (PM)
      endHour   = 0;
      startHour = startHour === 12 ? 12 : startHour + 12;
    } else {
      startHour = startHour === 12 ? 0 : startHour;
    }
  }

  const pad      = n => String(n).padStart(2, '0');
  const tzOffset = '-07:00'; // PDT — Las Vegas summer
  const startISO = `20${yr}-${month}-${day}T${pad(startHour)}:${startM}:00${tzOffset}`;
  const endISO   = `20${yr}-${month}-${day}T${pad(endHour)}:${endM}:00${tzOffset}`;

  return { start: new Date(startISO), end: new Date(endISO) };
}

function buildMapKey(name, startDate) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long', month: 'short', day: '2-digit',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).formatToParts(startDate);
  const get = t => parts.find(p => p.type === t)?.value || '';
  return `${name}||${get('weekday')}, ${get('month')} ${get('day')}, ${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
}

async function buildPublicEventMap(locationSlug, monthsAhead = 2) {
  const map = {};
  const now = new Date();

  for (let i = 0; i <= monthsAhead; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const month = d.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    // Same AJAX endpoint the site's "Load More" uses — pageSize=130 covers a full month in one shot
    const url   = `https://www.pinotspalette.com/${locationSlug}/events?month=${month}&pageSize=130`;
    console.log(`[sync] Fetching ${locationSlug} — ${label}: ${url}`);

    try {
      const res  = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const html = await res.text();
      const doc  = new DOMParser().parseFromString(html, 'text/html');

      let found = 0;
      doc.querySelectorAll('[id^="tooltip_content--"]').forEach(div => {
        const eventId = div.id.replace('tooltip_content--', '');
        const name    = div.querySelector('h3')?.textContent?.trim();
        if (!name) return;

        const walker = doc.createTreeWalker(div, NodeFilter.SHOW_TEXT, null, false);
        let dateText = '';
        let node;
        while ((node = walker.nextNode())) {
          const t = node.textContent.trim();
          if (/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)day,/.test(t)) { dateText = t; break; }
        }
        if (!dateText) return;

        const key = `${name}||${dateText.split(' - ')[0]}`;
        map[key]  = { eventId };
        found++;
      });

      console.log(`[sync] ${locationSlug} — ${label}: ${found} events mapped`);
    } catch (e) {
      console.warn(`[sync] ${locationSlug} — ${label} fetch failed:`, e.message);
    }
  }

  return map;
}
