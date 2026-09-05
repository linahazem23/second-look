const PATHS: Record<string, string> = {
  overview: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  users: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  listings: '<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="4" y1="10" x2="20" y2="10"/>',
  flag: '<path d="M5 3v18"/><path d="M5 4h11l-2 4 2 4H5"/>',
  orders: '<path d="M3 7h18l-2 12H5L3 7Z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
  moderation: '<path d="M12 2 3 6v6c0 5 4 8.5 9 10 5-1.5 9-5 9-10V6l-9-4Z"/>',
  chats: '<path d="M21 12a8 8 0 1 1-3.2-6.4"/>',
  appeals: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>',
  reviews: '<path d="M12 2 15 9l7 1-5 5 1.5 7L12 18l-6.5 4L7 15 2 10l7-1 3-7Z"/>',
  ads: '<rect x="3" y="4" width="18" height="12" rx="1"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: PATHS[name] ?? '' }} />
  );
}
