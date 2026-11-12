(function(){
const paths={
home:'<path d="m3 10 9-7 9 7v10H5V10"/><path d="M9 20v-7h6v7"/>',
arrow:'<path d="M19 12H5m6-6-6 6 6 6"/>',chevron:'<path d="m9 5 7 7-7 7"/>',
shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/>',
shieldCheck:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
snowflake:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M3.6 10.6l4.1-1.1-1.1-4.1M17.4 18.6l-1.1-4.1 4.1-1.1M6.6 18.6l1.1-4.1-4.1-1.1M20.4 10.6l-4.1-1.1 1.1-4.1"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',check:'<path d="m5 12 4 4L19 6"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
users:'<circle cx="9" cy="8" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6M18 14a6 6 0 0 1 4 6"/>',
wallet:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="m4 5 13-3v3M21 11h-6v5h6"/><path d="M17 13.5h.1"/>',
alert:'<path d="M10.3 3.8 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
phone:'<path d="M8 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-4l-5-2-2 3a15 15 0 0 1-7-7l3-2z"/>',
mobile:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>',
chat:'<path d="M21 15a3 3 0 0 1-3 3H9l-6 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/><path d="M7 8h10M7 12h7"/>',
receipt:'<path d="M5 3h14v19l-3-2-4 2-4-2-3 2zM8 7h8M8 11h8M8 15h5"/>',
lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
transfer:'<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
bell:'<path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 22h4"/>',
search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
card:'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h4"/>',
qr:'<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM14 14h3v3h4v4h-7v-3m6-5v2"/>',
plus:'<path d="M12 4v16M4 12h16"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3zM12 8h4a3 3 0 1 0-3-3z"/>',
share:'<path d="M12 16V2m-5 5 5-5 5 5M4 13v8h16v-8"/>',refresh:'<path d="M20 7a9 9 0 1 0 1 7M20 2v5h-5"/>',
document:'<path d="M14 2H4v20h16V8zM14 2v6h6M8 12h8M8 16h8"/>'
};
window.ProtectionIcon=(name,size=24)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.shield}</svg>`;
})();
