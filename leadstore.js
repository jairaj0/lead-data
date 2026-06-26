/*
 * leadstore — saara JSON read/write logic. Database = ek folder ki .json files.
 * Koi CSV nahi. main.js isko DATA_DIR de kar use karta hai.
 */
const fs = require('fs');
const path = require('path');

const STATUSES = ['new', 'contacted', 'interested', 'follow-up', 'not-interested', 'closed'];

function guessWhatsapp(phone) {
  if (!phone) return false;
  let d = String(phone).replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  return d.length === 10 && '6789'.includes(d[0]);
}

function phoneIntl(phone) {
  if (!phone) return '';
  let d = String(phone).replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  return d.length === 10 ? '91' + d : d;
}

// alag-alag JSON me key naam alag ho sakte hain — inhe canonical naam pe map karo.
// matching: lowercase + sirf letters/numbers (space, _, - sab hata ke).
const KEY_ALIASES = {
  name: ['name', 'doctorname', 'doctor', 'title', 'businessname', 'business', 'leadname'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobileno', 'mobilenumber', 'contact', 'contactnumber', 'number', 'tel', 'telephone', 'whatsappnumber', 'phoneno'],
  specialty: ['specialty', 'speciality', 'category', 'type', 'profession', 'department'],
  clinic_name: ['clinicname', 'clinic', 'hospital', 'hospitalname', 'company'],
  location: ['location', 'address', 'fulladdress', 'addr', 'area'],
  website: ['website', 'url', 'site', 'web', 'weblink', 'websiteurl', 'link'],
  map_url: ['mapurl', 'map', 'maps', 'googlemaps', 'mapsurl', 'gmap', 'maplink', 'googlemap'],
  rating: ['rating', 'stars', 'googlerating', 'star', 'ratings'],
  reviews_count: ['reviewscount', 'reviews', 'reviewcount', 'totalreviews', 'numreviews', 'noofreviews'],
  full_name: ['fullname', 'longname', 'displayname'],
  email: ['email', 'mail', 'emailid', 'emailaddress'],
};
const CANON = {};
for (const [canon, aliases] of Object.entries(KEY_ALIASES)) {
  for (const a of aliases) CANON[a] = canon;
}
function slimKey(k) { return String(k).toLowerCase().replace(/[^a-z0-9]/g, ''); }

function remapKeys(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const canon = CANON[slimKey(k)];
    // canonical naam pehle aaye to use rakho; warna jo mila wahi (overwrite mat karo)
    if (canon) { if (out[canon] === undefined || out[canon] === '' || out[canon] === null) out[canon] = v; }
    else if (out[k] === undefined) out[k] = v;
  }
  return out;
}

function normalizeLead(rawIn, idx) {
  const raw = remapKeys(rawIn);
  const lead = Object.assign({}, raw);
  if (lead.id === undefined || lead.id === null || lead.id === '') lead.id = idx + 1;
  if (lead.whatsapp === undefined) lead.whatsapp = guessWhatsapp(lead.phone);
  if (!lead.phone_intl) lead.phone_intl = phoneIntl(lead.phone);
  lead.contacted = !!lead.contacted;
  if (lead.status === undefined) lead.status = 'new';
  if (lead.response === undefined) lead.response = '';
  if (lead.notes === undefined) lead.notes = '';
  if (lead.follow_up === undefined) lead.follow_up = '';
  if (lead.quality === undefined) lead.quality = ''; // bad | average | best (user manually marks)
  return lead;
}

module.exports = function createStore(DATA_DIR) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  function safe(name) {
    if (!name) return null;
    name = path.basename(String(name));
    if (!name.toLowerCase().endsWith('.json')) return null;
    return path.join(DATA_DIR, name);
  }

  function listFiles() {
    return fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.json')).sort();
  }

  function readLeads(file) {
    const p = safe(file);
    if (!p || !fs.existsSync(p)) return null;
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    const arr = Array.isArray(d) ? d : (Array.isArray(d.leads) ? d.leads : []);
    return arr.map(normalizeLead);
  }

  function writeLeads(file, arr) {
    const p = safe(file);
    if (!p) throw new Error('bad file name');
    fs.writeFileSync(p, JSON.stringify(arr, null, 2), 'utf8');
  }

  function importJSON(name, raw) {
    let n = path.basename(String(name || 'imported'));
    if (!n.toLowerCase().endsWith('.json')) n += '.json';
    const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.leads) ? raw.leads : null);
    if (!arr) throw new Error('JSON ek array hona chahiye (ya {leads:[...]})');
    const leads = arr.map(normalizeLead);
    let finalName = n;
    if (fs.existsSync(path.join(DATA_DIR, finalName))) {
      const stem = n.replace(/\.json$/i, '');
      let k = 2;
      while (fs.existsSync(path.join(DATA_DIR, `${stem}-${k}.json`))) k++;
      finalName = `${stem}-${k}.json`;
    }
    writeLeads(finalName, leads);
    return { file: finalName, count: leads.length };
  }

  function addLead(file, body) {
    const leads = readLeads(file);
    if (leads === null) throw new Error('file not found');
    const nextId = leads.reduce((m, l) => Math.max(m, Number(l.id) || 0), 0) + 1;
    const lead = normalizeLead(Object.assign({ status: 'new' }, body, { id: nextId }), leads.length);
    leads.push(lead);
    writeLeads(file, leads);
    return lead;
  }

  function updateLead(file, id, patch) {
    const leads = readLeads(file);
    if (leads === null) throw new Error('file not found');
    const idx = leads.findIndex(l => String(l.id) === String(id));
    if (idx === -1) throw new Error('lead not found');
    delete patch.id;
    const updated = normalizeLead(Object.assign({}, leads[idx], patch), idx);
    if (patch.phone !== undefined) updated.phone_intl = phoneIntl(updated.phone);
    leads[idx] = updated;
    writeLeads(file, leads);
    return updated;
  }

  function deleteLead(file, id) {
    const leads = readLeads(file);
    if (leads === null) throw new Error('file not found');
    const idx = leads.findIndex(l => String(l.id) === String(id));
    if (idx === -1) throw new Error('lead not found');
    const [removed] = leads.splice(idx, 1);
    writeLeads(file, leads);
    return removed;
  }

  return { STATUSES, dir: DATA_DIR, listFiles, readLeads, writeLeads, importJSON, addLead, updateLead, deleteLead };
};
