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

    status.textContent = `Got ${rawClasses.length} classes. Fetching public event links…`;

    // 2. Build name+date → public event URL maps per location
    const eventMaps = {};
    for (const loc of LOCATIONS) {
      eventMaps[loc.name] = await buildPublicEventMap(loc.slug);
    }

    // 3. Parse and enrich — only Regular classes are stored
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
    if (endHour !== 12) endHour += 12;
    if (startHour !== 12 && startHour < endHour - 12) {
      // start is AM, leave as-is
    } else {
      if (startHour !== 12) startHour += 12;
    }
  } else {
    if (endHour === 12) endHour = 0;
  }

  const pad      = n => String(n).padStart(2, '0');
  const tzOffset = '-07:00'; // PDT — Las Vegas summer
  const startISO = `20${yr}-${month}-${day}T${pad(startHour)}:${startM}:00${tzOffset}`;
  const endISO   = `20${yr}-${month}-${day}T${pad(endHour)}:${endM}:00${tzOffset}`;

  return { start: new Date(startISO), end: new Date(endISO) };
}

function buildMapKey(name, startDate) {
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const localStr = startDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const local    = new Date(localStr);
  const hr       = local.getHours();
  const min      = String(local.getMinutes()).padStart(2, '0');
  const ampm     = hr >= 12 ? 'PM' : 'AM';
  const hr12     = hr % 12 || 12;
  return `${name}||${days[local.getDay()]}, ${months[local.getMonth()]} ${local.getDate()}, ${hr12}:${min} ${ampm}`;
}

async function buildPublicEventMap(locationSlug) {
  const res  = await fetch(`https://www.pinotspalette.com/${locationSlug}/events`);
  const html = await res.text();
  const doc  = new DOMParser().parseFromString(html, 'text/html');
  const map  = {};

  doc.querySelectorAll('[id^="tooltip_content--"]').forEach(div => {
    const eventId = div.id.replace('tooltip_content--', '');
    const name    = div.querySelector('h3')?.textContent?.trim();
    if (!name) return;

    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null, false);
    let dateText = '';
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      if (/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)day,/.test(t)) { dateText = t; break; }
    }
    if (!dateText) return;

    const key = `${name}||${dateText.split(' - ')[0]}`;
    map[key]  = { eventId };
  });

  return map;
}
